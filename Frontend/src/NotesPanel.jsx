// Panel Catatan (kolom kanan) SiberNote LM.
//
//  - useNotes()   : state + logika (daftar, sesi editor, validasi, auto-save, hapus/ganti nama)
//  - NotesPanel   : UI. State 1 = daftar catatan, State 2 = Text Editor.
//
// Editor memakai contentEditable + document.execCommand (tanpa dependensi tambahan).
// Isi catatan disimpan sebagai HTML di field `content` dan disanitasi saat dimuat/disimpan.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ApiError, createNote, deleteNote, getNotes, updateNote } from "./api";

/* ======================================================================
   Konstanta & pesan
   ====================================================================== */

const AUTOSAVE_DELAY_MS = 800;
const TITLE_MAX = 100;
const EMPTY_HTML = "<p><br></p>"; // API mewajibkan `content`, jadi catatan kosong tetap dikirim sebagai HTML kosong

const MSG_TITLE_REQUIRED = "Judul catatan wajib diisi (1–100 karakter)";
const MSG_NOTE_GONE = "Catatan tidak ditemukan atau sudah dihapus.";
const MSG_SAVE_FAILED = "Gagal menyimpan catatan. Coba lagi.";
const MSG_DELETE_FAILED = "Gagal menghapus catatan. Coba lagi.";
const MSG_LOAD_FAILED = "Gagal memuat catatan.";

const HEADINGS = [
  { value: "p", label: "Paragraf" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
];

const INITIAL_FORMAT = {
  bold: false,
  italic: false,
  underline: false,
  ul: false,
  ol: false,
  heading: "p",
  align: "left",
};

/* ======================================================================
   Helper: validasi, sanitasi HTML, teks
   ====================================================================== */

function isValidTitle(title) {
  const t = String(title ?? "").trim();
  return t.length >= 1 && t.length <= TITLE_MAX;
}

function normalizeNote(n) {
  return {
    id: n._id || n.id,
    title: n.title || "",
    content: typeof n.content === "string" ? n.content : "",
    updatedAt: n.updatedAt || n.createdAt || "",
  };
}

function sortNotes(list) {
  const time = (v) => Date.parse(v) || 0;
  return [...list].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Catatan lama yang berisi teks polos (bukan HTML) diubah jadi paragraf.
function plainToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "H1", "H2", "H3", "H4", "H5",
  "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "SPAN",
]);
const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT",
  "SVG", "MATH", "LINK", "META", "TITLE", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT",
]);
const ALIGN_RE = /text-align:\s*(left|center|right|justify)/i;

// Whitelist: hanya tag format dasar dan atribut text-align yang dipertahankan.
function cleanNode(parent) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) continue; // teks
    if (child.nodeType !== 1) {
      child.remove();
      continue;
    }
    const tag = child.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) {
      child.remove();
      continue;
    }
    cleanNode(child);
    if (!ALLOWED_TAGS.has(tag)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    const align = ALIGN_RE.exec(child.getAttribute("style") || "")?.[1]?.toLowerCase();
    for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
    if (align) child.setAttribute("style", `text-align: ${align}`);
  }
}

function sanitizeHtml(html) {
  // DOMParser menghasilkan dokumen "mati": skrip tidak jalan dan gambar tidak dimuat.
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

function toEditableHtml(content) {
  const raw = typeof content === "string" ? content : "";
  if (!raw.trim()) return EMPTY_HTML;
  const html = /<\/?[a-z][\s\S]*>/i.test(raw) ? raw : plainToHtml(raw);
  const clean = sanitizeHtml(html);
  return clean.trim() ? clean : EMPTY_HTML;
}

function isBlankHtml(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  return !doc.body.textContent.trim();
}

function serializeContent(html) {
  const clean = sanitizeHtml(html);
  return isBlankHtml(clean) ? EMPTY_HTML : clean;
}

function htmlToText(html) {
  const spaced = String(html ?? "").replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, " ");
  const doc = new DOMParser().parseFromString(spaced, "text/html");
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

function shallowEqual(a, b) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/* ======================================================================
   Hook: useNotes
   ====================================================================== */

export function useNotes({ notebookId, accessToken, notify }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // session === null -> State 1 (daftar). session berisi objek -> State 2 (editor).
  const [session, setSession] = useState(null);
  const [titleError, setTitleError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [creating, setCreating] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  // Nilai terbaru disimpan di ref agar fungsi di bawah tetap stabil.
  const tokenRef = useRef(accessToken);
  const notifyRef = useRef(notify);
  const notebookRef = useRef(notebookId);
  tokenRef.current = accessToken;
  notifyRef.current = notify;
  notebookRef.current = notebookId;

  const sessionRef = useRef(null);
  const sessionKeyRef = useRef(0);
  const idRef = useRef(null); // id catatan di server (null = draft yang belum tersimpan)
  const titleRef = useRef("");
  const contentRef = useRef(EMPTY_HTML);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const saveRef = useRef(null); // promise penyimpanan yang sedang berjalan

  /* ----- Memuat daftar ----- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    getNotes(notebookId, tokenRef.current)
      .then((data) => {
        if (cancelled) return;
        setNotes(sortNotes((data?.notes || []).map(normalizeNote)));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || MSG_LOAD_FAILED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const upsertNote = useCallback((saved) => {
    setNotes((list) => {
      const exists = list.some((n) => n.id === saved.id);
      const next = exists ? list.map((n) => (n.id === saved.id ? { ...n, ...saved } : n)) : [saved, ...list];
      return sortNotes(next);
    });
  }, []);

  const endSession = useCallback(() => {
    clearTimeout(timerRef.current);
    dirtyRef.current = false;
    idRef.current = null;
    sessionRef.current = null;
    setSession(null);
    setTitleError("");
    setSaveStatus("idle");
  }, []);

  const beginSession = useCallback(({ id, title, content }) => {
    idRef.current = id;
    titleRef.current = title;
    contentRef.current = content;
    dirtyRef.current = false;
    sessionKeyRef.current += 1;
    const next = { key: sessionKeyRef.current, id, title, content };
    sessionRef.current = next;
    setTitleError("");
    setSaveStatus("idle");
    setSession(next);
  }, []);

  // Server menjawab 404: catatan sudah tidak ada. Tampilkan toast, bersihkan daftar, kembali ke State 1.
  const handleGone = useCallback(
    (id) => {
      setNotes((list) => list.filter((n) => n.id !== id));
      if (idRef.current === id) endSession();
      notifyRef.current?.(MSG_NOTE_GONE);
    },
    [endSession]
  );

  /* ----- Auto-save ----- */

  // Satu kali penyimpanan. Hasil: "ok" | "invalid" | "gone" | "error"
  const saveOnce = useCallback(async () => {
    const title = titleRef.current.trim();
    if (!isValidTitle(title)) return "invalid"; // dirty tetap true, tersimpan begitu judul valid

    const content = serializeContent(contentRef.current);
    const wasNew = !idRef.current;
    dirtyRef.current = false; // edit yang masuk selama request akan menyetel ulang flag ini

    try {
      if (wasNew) {
        setCreating(true);
        const data = await createNote(notebookRef.current, { title, content }, tokenRef.current);
        if (!data?.note?._id) throw new ApiError(MSG_SAVE_FAILED);
        const saved = normalizeNote(data.note);
        idRef.current = saved.id;
        if (sessionRef.current) {
          sessionRef.current = { ...sessionRef.current, id: saved.id };
          setSession(sessionRef.current);
        }
        upsertNote(saved);
      } else {
        const id = idRef.current;
        const data = await updateNote(notebookRef.current, id, { title, content }, tokenRef.current);
        upsertNote(
          data?.note
            ? normalizeNote(data.note)
            : { id, title, content, updatedAt: new Date().toISOString() }
        );
      }
      return "ok";
    } catch (err) {
      dirtyRef.current = true;
      if (err instanceof ApiError && err.status === 404 && !wasNew) {
        handleGone(idRef.current);
        return "gone";
      }
      if (err instanceof ApiError && err.status === 400 && err.fieldErrors?.some?.((e) => e.field === "title")) {
        setTitleError(MSG_TITLE_REQUIRED);
        return "invalid";
      }
      setSaveStatus("error");
      notifyRef.current?.(err?.message || MSG_SAVE_FAILED);
      return "error";
    } finally {
      if (wasNew) setCreating(false);
    }
  }, [handleGone, upsertNote]);

  // Menyimpan secara berurutan (tidak pernah dua request sekaligus untuk satu catatan).
  const runSave = useCallback(() => {
    if (saveRef.current) return saveRef.current;
    const p = (async () => {
      let result = "ok";
      try {
        while (dirtyRef.current) {
          result = await saveOnce();
          if (result !== "ok") break;
        }
      } catch {
        result = "error";
      }
      if (result === "ok") setSaveStatus(dirtyRef.current ? "saving" : "saved");
      else if (result === "invalid") setSaveStatus("idle");
      return result;
    })();
    saveRef.current = p;
    p.finally(() => {
      if (saveRef.current === p) saveRef.current = null;
    });
    return p;
  }, [saveOnce]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runSave();
    }, AUTOSAVE_DELAY_MS);
  }, [runSave]);

  const changeTitle = useCallback(
    (value) => {
      titleRef.current = value;
      dirtyRef.current = true;
      if (isValidTitle(value)) {
        setTitleError("");
        scheduleSave();
      } else {
        clearTimeout(timerRef.current);
        setTitleError(MSG_TITLE_REQUIRED);
        setSaveStatus("idle");
      }
    },
    [scheduleSave]
  );

  const changeContent = useCallback(
    (html) => {
      contentRef.current = html;
      dirtyRef.current = true;
      if (isValidTitle(titleRef.current)) {
        setTitleError("");
        scheduleSave();
        return;
      }
      clearTimeout(timerRef.current);
      setSaveStatus("idle");
      // Draft yang benar-benar kosong belum perlu menegur; begitu ada isi, judul wajib.
      const untouchedDraft = !idRef.current && !titleRef.current.trim() && isBlankHtml(html);
      setTitleError(untouchedDraft ? "" : MSG_TITLE_REQUIRED);
    },
    [scheduleSave]
  );

  /* ----- Pindah state ----- */

  // Menutup editor (kembali ke daftar). Menyimpan dulu; return false jika harus tetap di editor.
  const closeEditor = useCallback(async () => {
    if (!sessionRef.current) return true;
    clearTimeout(timerRef.current);

    if (dirtyRef.current || saveRef.current) {
      const title = titleRef.current.trim();
      if (!isValidTitle(title)) {
        const emptyDraft = !idRef.current && !title && isBlankHtml(contentRef.current);
        if (!emptyDraft) {
          setTitleError(MSG_TITLE_REQUIRED);
          setFocusTick((t) => t + 1);
          return false;
        }
      } else {
        const result = await runSave();
        if (result === "gone") return true; // sesi sudah ditutup oleh handleGone
        if (result !== "ok" || dirtyRef.current) return false;
      }
    }
    endSession();
    return true;
  }, [endSession, runSave]);

  const addNote = useCallback(async () => {
    const draftIsBlank =
      sessionRef.current && !idRef.current && !titleRef.current.trim() && isBlankHtml(contentRef.current);
    if (draftIsBlank) {
      setFocusTick((t) => t + 1); // sudah ada draft kosong, cukup fokuskan
      return;
    }
    if (!(await closeEditor())) return;
    beginSession({ id: null, title: "", content: EMPTY_HTML });
  }, [beginSession, closeEditor]);

  const openNote = useCallback(
    async (note) => {
      if (sessionRef.current && idRef.current === note.id) return;
      if (!(await closeEditor())) return;
      beginSession({ id: note.id, title: note.title, content: note.content });
    },
    [beginSession, closeEditor]
  );

  /* ----- Hapus & ganti nama ----- */

  const removeNote = useCallback(
    async (id) => {
      try {
        await deleteNote(notebookRef.current, id, tokenRef.current);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          handleGone(id);
        } else {
          notifyRef.current?.(err?.message || MSG_DELETE_FAILED);
        }
        return false;
      }
      setNotes((list) => list.filter((n) => n.id !== id));
      if (idRef.current === id) endSession();
      return true;
    },
    [endSession, handleGone]
  );

  // Hapus catatan yang sedang dibuka di editor (atau buang draft yang belum tersimpan).
  const deleteActive = useCallback(async () => {
    clearTimeout(timerRef.current);
    dirtyRef.current = false;
    if (saveRef.current) await saveRef.current; // tunggu penyimpanan yang sedang jalan agar id-nya diketahui
    dirtyRef.current = false;
    const id = idRef.current;
    if (!id) {
      endSession();
      return true;
    }
    return removeNote(id);
  }, [endSession, removeNote]);

  // Melempar error (selain 404) agar dialog bisa menampilkannya.
  const renameNote = useCallback(
    async (note, title) => {
      try {
        const data = await updateNote(notebookRef.current, note.id, { title }, tokenRef.current);
        upsertNote({ ...note, ...(data?.note ? normalizeNote(data.note) : { title }) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          handleGone(note.id);
          return;
        }
        throw err;
      }
    },
    [handleGone, upsertNote]
  );

  /* ----- Pengaman: simpan sisa perubahan saat meninggalkan halaman ----- */
  useEffect(() => {
    function flushIfNeeded() {
      if (dirtyRef.current && isValidTitle(titleRef.current)) {
        clearTimeout(timerRef.current);
        runSave();
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushIfNeeded();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flushIfNeeded(); // unmount (mis. kembali ke dashboard)
    };
  }, [runSave]);

  useEffect(() => {
    if (saveStatus !== "saving" && saveStatus !== "error") return undefined;
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  return {
    notes,
    loading,
    loadError,
    reload,
    session,
    titleError,
    saveStatus,
    creating,
    focusTick,
    addNote,
    openNote,
    closeEditor,
    changeTitle,
    changeContent,
    removeNote,
    deleteActive,
    renameNote,
  };
}

/* ======================================================================
   Ikon
   ====================================================================== */

function Svg({ size = 18, children, strokeWidth = 1.8 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NoteIcon = ({ size }) => (
  <Svg size={size}>
    <rect x="4" y="3.5" width="16" height="17" rx="3" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Svg>
);
const BackIcon = () => (
  <Svg>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Svg>
);
const UndoIcon = () => (
  <Svg>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);
const RedoIcon = () => (
  <Svg>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Svg>
);
const MoreIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);
const BulletListIcon = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </Svg>
);
const NumberListIcon = () => (
  <Svg>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5.2 5.2 4.5V8" />
    <path d="M3.8 13.6c.3-.9 2.4-1.1 2.4.1 0 .9-1.2 1.4-2.4 2.5h2.5" />
  </Svg>
);
const AlignIcon = ({ kind }) => {
  const lines = {
    left: ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"],
    center: ["M4 6h16", "M7 10h10", "M4 14h16", "M7 18h10"],
    right: ["M4 6h16", "M10 10h10", "M4 14h16", "M10 18h10"],
    justify: ["M4 6h16", "M4 10h16", "M4 14h16", "M4 18h16"],
  }[kind];
  return (
    <Svg>
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </Svg>
  );
};
const CheckIcon = () => (
  <Svg size={14} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

/* ======================================================================
   Dialog (pola sama dengan Modal di App.jsx)
   ====================================================================== */

function Dialog({ label, className = "", canClose = true, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        if (canClose) onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current && canClose) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function RenameNoteDialog({ note, onClose, onRename }) {
  const [title, setTitle] = useState(note.title);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    const trimmed = title.trim();
    if (!isValidTitle(trimmed)) {
      setError(MSG_TITLE_REQUIRED);
      return;
    }
    if (trimmed === note.title) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onRename(note, trimmed);
      onClose();
    } catch (err) {
      setError(err?.message || MSG_SAVE_FAILED);
      setSaving(false);
    }
  }

  return (
    <Dialog label="Ganti nama catatan" canClose={!saving} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="rename-note-title" className="modal-label">Judul Catatan</label>
        <input
          id="rename-note-title"
          className="input modal-input"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          onFocus={(e) => e.target.select()}
          placeholder="Judul Catatan"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "rename-note-error" : undefined}
          autoComplete="off"
        />
        {error && (
          <p id="rename-note-error" className="msg-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="modal-save" disabled={saving}>
            Simpan
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ConfirmDeleteNoteDialog({ onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    await onConfirm();
  }

  return (
    <Dialog label="Konfirmasi hapus" className="modal--confirm" canClose={!deleting} onClose={onCancel}>
      <div className="modal-form">
        <p className="modal-message">Apakah Anda yakin ingin menghapus catatan ini?</p>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel} disabled={deleting}>
            Batal
          </button>
          <button type="button" className="modal-delete" onClick={handleConfirm} disabled={deleting}>
            Yakin
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ======================================================================
   State 1: daftar catatan
   ====================================================================== */

const SKELETON_WIDTHS = ["100%", "88%", "94%"];

function NoteRow({ note, menuOpen, onOpen, onMenu }) {
  const snippet = useMemo(() => htmlToText(note.content), [note.content]);
  return (
    <li className="note-item">
      <button type="button" className="note-open" onClick={() => onOpen(note)}>
        <span className="note-open-icon">
          <NoteIcon size={18} />
        </span>
        <span className="note-open-text">
          <span className="note-open-title">{note.title}</span>
          {snippet && <span className="note-open-snippet">{snippet}</span>}
        </span>
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Opsi untuk ${note.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => onMenu(e, note.id)}
      >
        ⋮
      </button>
    </li>
  );
}

function NotesList({ notes, onToggle, icons, onRename, onDelete }) {
  const [menu, setMenu] = useState(null);
  const menuNote = menu ? notes.notes.find((n) => n.id === menu.id) : null;

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  function toggleMenu(e, id) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu((cur) => (cur?.id === id ? null : { id, top: rect.bottom + 4, right: window.innerWidth - rect.right }));
  }

  function pick(action) {
    const note = menuNote;
    setMenu(null);
    if (note) action(note);
  }

  return (
    <div className="notes-view">
      <div className="panel-head">
        <h2 className="panel-title">Catatan</h2>
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggle}
          aria-label="Ciutkan panel Catatan"
          aria-expanded="true"
        >
          {icons.toggle}
        </button>
      </div>

      {notes.loading ? (
        <div className="notes-skeleton" role="status" aria-busy="true" aria-label="Memuat catatan">
          {SKELETON_WIDTHS.map((w, i) => (
            <div key={i} className="skeleton skeleton-line" style={{ width: w }} />
          ))}
        </div>
      ) : notes.loadError ? (
        <div className="notes-empty">
          <p className="msg-error" role="alert">{notes.loadError}</p>
          <button type="button" className="notes-retry" onClick={notes.reload}>
            Coba lagi
          </button>
        </div>
      ) : notes.notes.length === 0 ? (
        <div className="notes-empty">
          <p className="notes-empty-title">Belum ada catatan</p>
          <p className="notes-empty-hint">Catatan yang Anda buat akan muncul di sini.</p>
        </div>
      ) : (
        <ul className="note-list">
          {notes.notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              menuOpen={menu?.id === note.id}
              onOpen={notes.openNote}
              onMenu={toggleMenu}
            />
          ))}
        </ul>
      )}

      <div className="notes-footer">
        <button type="button" className="notes-add-btn" onClick={notes.addNote} disabled={notes.creating}>
          <NoteIcon size={16} />
          Tambahkan Catatan
        </button>
      </div>

      {menu && menuNote && (
        <>
          <div className="menu-backdrop" onClick={() => setMenu(null)} />
          <div className="dropdown-menu dropdown-menu--fixed" role="menu" style={{ top: menu.top, right: menu.right }}>
            <button type="button" role="menuitem" onClick={() => pick(onRename)}>
              {icons.rename} Ganti Judul
            </button>
            <button type="button" role="menuitem" className="danger" onClick={() => pick(onDelete)}>
              {icons.trash} Hapus
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ======================================================================
   State 2: Text Editor
   ====================================================================== */

function readFormat() {
  const q = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };
  let block = "";
  try {
    block = String(document.queryCommandValue("formatBlock") || "");
  } catch {
    /* abaikan */
  }
  block = block.replace(/[<>]/g, "").toLowerCase();
  return {
    bold: q("bold"),
    italic: q("italic"),
    underline: q("underline"),
    ul: q("insertUnorderedList"),
    ol: q("insertOrderedList"),
    heading: /^h[1-5]$/.test(block) ? block : "p",
    align: q("justifyCenter") ? "center" : q("justifyRight") ? "right" : q("justifyFull") ? "justify" : "left",
  };
}

function isEditorEmpty(el) {
  return !el.textContent && !el.querySelector("ul, ol");
}

function placeCaret(el, atEnd) {
  const sel = document.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(range);
}

function ToolButton({ label, shortcut, active, onClick, controls, expanded, children }) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}`}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active === undefined ? undefined : active}
      aria-controls={controls}
      aria-expanded={expanded}
      onMouseDown={(e) => e.preventDefault()} // jaga agar seleksi di editor tidak hilang
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ status }) {
  return (
    <span className="save-slot" aria-live="polite">
      {status === "saving" && (
        <span className="save-status">
          <span className="spinner" aria-hidden="true" />
          Menyimpan...
        </span>
      )}
      {status === "saved" && (
        <span className="save-status save-status--saved">
          <CheckIcon />
          Tersimpan
        </span>
      )}
      {status === "error" && <span className="save-status save-status--error">Gagal menyimpan</span>}
    </span>
  );
}

function NoteEditor({ notes, onToggle, icons, onRequestDelete }) {
  const { session, titleError, saveStatus, focusTick, changeTitle, changeContent, closeEditor } = notes;

  const [title, setTitle] = useState(session.title);
  const [moreOpen, setMoreOpen] = useState(false);
  const [format, setFormat] = useState(INITIAL_FORMAT);
  const [empty, setEmpty] = useState(true);
  const [closing, setClosing] = useState(false);

  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const savedRange = useRef(null);

  // Muat isi catatan sekali saat editor dibuka (editor tetap ter-mount saat panel menyusut).
  useLayoutEffect(() => {
    const el = editorRef.current;
    el.innerHTML = toEditableHtml(session.content);
    setEmpty(isEditorEmpty(el));
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("styleWithCSS", false, false);
    } catch {
      /* abaikan */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft baru: langsung fokus ke judul.
  useEffect(() => {
    if (!session.id && !session.title) titleInputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Penutupan yang diblokir validasi -> fokuskan judul.
  useEffect(() => {
    if (focusTick > 0) titleInputRef.current?.focus();
  }, [focusTick]);

  // Sinkronkan status tombol toolbar dengan posisi kursor, dan ingat seleksi terakhir.
  useEffect(() => {
    const el = editorRef.current;
    function sync() {
      const sel = document.getSelection();
      if (!sel || !sel.rangeCount || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
      savedRange.current = sel.getRangeAt(0).cloneRange();
      const next = readFormat();
      setFormat((prev) => (shallowEqual(prev, next) ? prev : next));
    }
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, []);

  function focusEditor() {
    const el = editorRef.current;
    el.focus();
    const sel = document.getSelection();
    if (!sel) return;
    const inside = sel.rangeCount && sel.anchorNode && el.contains(sel.anchorNode);
    if (inside) return;
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      placeCaret(el, true);
    }
  }

  function afterChange() {
    const el = editorRef.current;
    if (!el.innerHTML) {
      el.innerHTML = EMPTY_HTML; // editor tidak boleh benar-benar kosong
      placeCaret(el.firstChild, false);
    }
    setEmpty(isEditorEmpty(el));
    changeContent(el.innerHTML);
    const next = readFormat();
    setFormat((prev) => (shallowEqual(prev, next) ? prev : next));
  }

  function run(command, value) {
    focusEditor();
    document.execCommand(command, false, value);
    afterChange();
  }

  function handleKeyDown(e) {
    if (e.nativeEvent.isComposing) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const map = {
      z: () => run(e.shiftKey ? "redo" : "undo"),
      y: () => run("redo"),
      b: () => run("bold"),
      i: () => run("italic"),
      u: () => run("underline"),
    };
    if (map[key]) {
      e.preventDefault();
      map[key]();
    }
  }

  function handlePaste(e) {
    // Tempel sebagai teks polos agar format dari luar tidak mengotori catatan.
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (text) {
      document.execCommand("insertText", false, text);
      afterChange();
    }
  }

  function handleFocus() {
    const el = editorRef.current;
    if (!el.innerHTML) {
      el.innerHTML = EMPTY_HTML;
      placeCaret(el.firstChild, false);
    }
  }

  async function handleBack() {
    if (closing) return;
    setClosing(true);
    await closeEditor();
    setClosing(false);
  }

  function handleTitleChange(e) {
    setTitle(e.target.value);
    changeTitle(e.target.value);
  }

  function handleTitleKeyDown(e) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      focusEditor();
    }
  }

  const draftIsBlank = !session.id && !title.trim() && empty;

  return (
    <div className="notes-view note-editor">
      <div className="panel-head note-editor-head">
        <button type="button" className="tool-btn" onClick={handleBack} aria-label="Kembali ke daftar catatan" title="Kembali">
          <BackIcon />
        </button>
        <div className="note-editor-head-right">
          <SaveIndicator status={saveStatus} />
          <button
            type="button"
            className="icon-btn note-trash"
            aria-label="Hapus catatan"
            title="Hapus catatan"
            onClick={() => onRequestDelete(draftIsBlank)}
          >
            {icons.trash}
          </button>
          <button
            type="button"
            className="panel-toggle"
            onClick={onToggle}
            aria-label="Ciutkan panel Catatan"
            aria-expanded="true"
          >
            {icons.toggle}
          </button>
        </div>
      </div>

      <input
        ref={titleInputRef}
        className="input note-title-input"
        value={title}
        maxLength={TITLE_MAX}
        onChange={handleTitleChange}
        onKeyDown={handleTitleKeyDown}
        placeholder="Judul Catatan"
        aria-label="Judul Catatan"
        aria-invalid={titleError ? "true" : undefined}
        aria-describedby={titleError ? "note-title-error" : undefined}
        autoComplete="off"
      />
      {titleError && (
        <p id="note-title-error" className="msg-error note-title-error" role="alert">
          {titleError}
        </p>
      )}

      <div className="note-toolbar" role="toolbar" aria-label="Format teks">
        <ToolButton label="Urungkan" shortcut="Ctrl+Z" onClick={() => run("undo")}>
          <UndoIcon />
        </ToolButton>
        <ToolButton label="Ulangi" shortcut="Ctrl+Y" onClick={() => run("redo")}>
          <RedoIcon />
        </ToolButton>
        <span className="tool-sep" aria-hidden="true" />
        <select
          className="note-heading-select"
          aria-label="Gaya paragraf"
          value={format.heading}
          onChange={(e) => run("formatBlock", `<${e.target.value}>`)}
        >
          {HEADINGS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        <span className="tool-sep" aria-hidden="true" />
        <ToolButton label="Tebal" shortcut="Ctrl+B" active={format.bold} onClick={() => run("bold")}>
          <span className="tool-glyph tool-glyph--bold">B</span>
        </ToolButton>
        <ToolButton label="Miring" shortcut="Ctrl+I" active={format.italic} onClick={() => run("italic")}>
          <span className="tool-glyph tool-glyph--italic">I</span>
        </ToolButton>
        <span className="tool-spacer" />
        <ToolButton
          label="Alat lainnya"
          active={moreOpen}
          controls="note-more-tools"
          expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreIcon />
        </ToolButton>
      </div>

      {moreOpen && (
        <div id="note-more-tools" className="note-toolbar note-toolbar--more" role="toolbar" aria-label="Alat format tambahan">
          <ToolButton label="Garis bawah" shortcut="Ctrl+U" active={format.underline} onClick={() => run("underline")}>
            <span className="tool-glyph tool-glyph--underline">U</span>
          </ToolButton>
          <ToolButton label="Daftar berpoin" active={format.ul} onClick={() => run("insertUnorderedList")}>
            <BulletListIcon />
          </ToolButton>
          <ToolButton label="Daftar bernomor" active={format.ol} onClick={() => run("insertOrderedList")}>
            <NumberListIcon />
          </ToolButton>
          <span className="tool-sep" aria-hidden="true" />
          <ToolButton label="Rata kiri" active={format.align === "left"} onClick={() => run("justifyLeft")}>
            <AlignIcon kind="left" />
          </ToolButton>
          <ToolButton label="Rata tengah" active={format.align === "center"} onClick={() => run("justifyCenter")}>
            <AlignIcon kind="center" />
          </ToolButton>
          <ToolButton label="Rata kanan" active={format.align === "right"} onClick={() => run("justifyRight")}>
            <AlignIcon kind="right" />
          </ToolButton>
          <ToolButton label="Rata kiri-kanan" active={format.align === "justify"} onClick={() => run("justifyFull")}>
            <AlignIcon kind="justify" />
          </ToolButton>
        </div>
      )}

      <div className="note-area">
        {empty && (
          <span className="note-placeholder" aria-hidden="true">
            Tulis catatan Anda di sini...
          </span>
        )}
        <div
          ref={editorRef}
          className="note-content"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Isi catatan"
          spellCheck
          onInput={afterChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onDrop={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}

/* ======================================================================
   Panel utama
   ====================================================================== */

export function NotesPanel({ notes, collapsed, onToggle, icons = {} }) {
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id } untuk dari daftar, { active: true } dari editor

  const safeIcons = { toggle: icons.toggle ?? null, rename: icons.rename ?? null, trash: icons.trash ?? null };

  function requestDeleteFromEditor(draftIsBlank) {
    if (draftIsBlank) {
      notes.deleteActive();
      return;
    }
    setDeleteTarget({ active: true });
  }

  async function confirmDelete() {
    if (deleteTarget?.active) await notes.deleteActive();
    else if (deleteTarget?.id) await notes.removeNote(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <section className={`panel panel-notes${collapsed ? " is-collapsed" : ""}`} aria-label="Catatan">
      {collapsed && (
        <div className="panel-head">
          <button
            type="button"
            className="panel-toggle"
            onClick={onToggle}
            aria-label="Perluas panel Catatan"
            aria-expanded="false"
          >
            {safeIcons.toggle}
          </button>
        </div>
      )}

      {/* Tetap ter-mount saat menyusut supaya draft & riwayat undo tidak hilang. */}
      <div className="notes-body" hidden={collapsed}>
        {notes.session ? (
          <NoteEditor
            key={notes.session.key}
            notes={notes}
            onToggle={onToggle}
            icons={safeIcons}
            onRequestDelete={requestDeleteFromEditor}
          />
        ) : (
          <NotesList
            notes={notes}
            onToggle={onToggle}
            icons={safeIcons}
            onRename={setRenameTarget}
            onDelete={(note) => setDeleteTarget({ id: note.id })}
          />
        )}
      </div>

      {renameTarget && (
        <RenameNoteDialog note={renameTarget} onClose={() => setRenameTarget(null)} onRename={notes.renameNote} />
      )}
      {deleteTarget && <ConfirmDeleteNoteDialog onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
    </section>
  );
}