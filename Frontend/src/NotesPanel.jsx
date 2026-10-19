// Fitur Catatan (panel kanan workspace): daftar catatan, editor teks, dan auto-save.
// Modul mandiri: hanya bergantung pada ./api dan ./notes.css. Ikon diberikan lewat prop `icons`
// supaya sama dengan ikon di App.jsx.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, getNotes, createNote, updateNote, deleteNote } from "./api";
import "./notes.css";

const MSG_NOTE_NOT_FOUND = "Catatan tidak ditemukan atau sudah dihapus.";
const MSG_NOTE_TITLE_INVALID = "Judul catatan wajib diisi (1–100 karakter)";
const MSG_FORBIDDEN = "Anda tidak memiliki akses ke notebook ini";
const MSG_GENERIC_ERROR = "Terjadi kesalahan, silakan coba lagi.";

function errorToMessage(err) {
  if (err instanceof ApiError && err.status === 403) return MSG_FORBIDDEN;
  return err?.message || MSG_GENERIC_ERROR;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ----- Catatan (tersambung ke endpoint Notes) -----

const AUTOSAVE_DELAY_MS = 800; // jeda setelah berhenti mengetik sebelum disimpan otomatis
const NOTE_TITLE_MAX = 100;
const DEFAULT_NOTE_TITLE = "Catatan Tanpa Judul";
const EMPTY_NOTE_HTML = "<p><br></p>"; // backend mewajibkan content, jadi tidak boleh string kosong
const NOTE_ALLOWED_TAGS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "H1", "H2", "H3", "H4", "H5", "UL", "OL", "LI"]);
const NOTE_ALIGNS = ["left", "center", "right", "justify"];

const NOTE_ALIGN_TOOLS = [
  ["justifyLeft", "Rata kiri", "Kiri"],
  ["justifyCenter", "Rata tengah", "Tengah"],
  ["justifyRight", "Rata kanan", "Kanan"],
  ["justifyFull", "Rata kiri-kanan", "Penuh"],
];
const NOTE_BLOCK_TOOLS = [
  ["p", "Paragraf", "P"],
  ["h1", "Judul 1", "H1"],
  ["h2", "Judul 2", "H2"],
  ["h3", "Judul 3", "H3"],
  ["h4", "Judul 4", "H4"],
  ["h5", "Judul 5", "H5"],
];
const NOTE_STATE_COMMANDS = [
  "bold", "italic", "underline", "insertUnorderedList", "insertOrderedList",
  "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
];

/** Mengembalikan pesan error kalau judul tidak valid, atau "" kalau valid. */
function validateNoteTitle(title) {
  const length = title.trim().length;
  return length >= 1 && length <= NOTE_TITLE_MAX ? "" : MSG_NOTE_TITLE_INVALID;
}

/** 404 -> catatan tidak ditemukan; selain itu pakai pesan error umum. */
function noteErrorToMessage(err) {
  if (err instanceof ApiError && err.status === 404) return MSG_NOTE_NOT_FOUND;
  return errorToMessage(err);
}

function NotePlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "middle" }}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7 8h10" />
      <path d="M7 12h6" />
    </svg>
  );
}

/**
 * Membersihkan HTML catatan: hanya tag format yang diizinkan, semua atribut dibuang
 * kecuali text-align. Mencegah script/handler (XSS) ikut tersimpan atau tampil di editor.
 */
function sanitizeNoteHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const clean = (parent) => {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        return;
      }
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(node.tagName)) {
        node.remove();
        return;
      }
      if (!NOTE_ALLOWED_TAGS.has(node.tagName)) {
        // Tag tidak dikenal: buang tag-nya, pertahankan isinya.
        clean(node);
        node.replaceWith(...node.childNodes);
        return;
      }
      const align = node.style?.textAlign || node.getAttribute("align");
      [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
      if (NOTE_ALIGNS.includes(align)) node.style.textAlign = align;
      clean(node);
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Isi dari backend -> HTML untuk editor. Teks biasa (tanpa tag) dibungkus per baris. */
function toEditorHtml(content) {
  const text = content ?? "";
  if (!/<\/?[a-z][\s\S]*>/i.test(text)) {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.split("\n").map((line) => `<p>${line || "<br>"}</p>`).join("");
  }
  return sanitizeNoteHtml(text);
}

/** HTML editor -> isi yang dikirim ke backend (tidak pernah kosong). */
function serializeNoteHtml(html) {
  const clean = sanitizeNoteHtml(html);
  return clean.trim() ? clean : EMPTY_NOTE_HTML;
}

export function useNotes({ notebookId, accessToken, notify }) {
  const notifyRef = useRef(notify); // notify dipanggil lewat ref, jadi tidak perlu stabil
  notifyRef.current = notify;
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState(null); // null = daftar catatan, id = mode editor
  const [newNoteId, setNewNoteId] = useState(null); // catatan yang baru dibuat (fokus ke judul)
  const queue = useRef(Promise.resolve()); // simpan berurutan supaya versi lama tidak menimpa yang baru
  const deleted = useRef(new Set()); // catatan yang sudah dihapus: simpanan tertunda diabaikan

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNotes(notebookId, accessToken)
      .then((data) => {
        if (!cancelled) setNotes(data?.notes || []);
      })
      .catch((err) => {
        if (!cancelled) notifyRef.current(noteErrorToMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId, accessToken]);

  const removeLocal = useCallback((id) => {
    setNotes((list) => list.filter((n) => n._id !== id));
    setActiveId((current) => (current === id ? null : current));
  }, []);

  // Catatan dibuat dulu di backend dengan judul bawaan, lalu editor membuka dan menyimpan otomatis.
  async function addNote() {
    if (creating) return;
    setCreating(true);
    try {
      const data = await createNote(
        notebookId,
        { title: DEFAULT_NOTE_TITLE, content: EMPTY_NOTE_HTML },
        accessToken
      );
      if (data?.note) {
        setNotes((list) => [data.note, ...list]);
        setNewNoteId(data.note._id);
        setActiveId(data.note._id);
      }
    } catch (err) {
      notifyRef.current(noteErrorToMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // Dipakai auto-save. Mengembalikan true (berhasil), false (gagal), atau "gone" (catatan sudah tidak ada).
  const saveNote = useCallback(
    (id, patch) => {
      if (deleted.current.has(id)) return Promise.resolve("gone");
      // Perbarui tampilan lebih dulu supaya membuka ulang editor tidak menampilkan versi lama.
      setNotes((list) => list.map((n) => (n._id === id ? { ...n, ...patch } : n)));
      const run = queue.current.then(async () => {
        if (deleted.current.has(id)) return "gone";
        try {
          const data = await updateNote(notebookId, id, patch, accessToken);
          const updatedAt = data?.note?.updatedAt;
          if (updatedAt) setNotes((list) => list.map((n) => (n._id === id ? { ...n, updatedAt } : n)));
          return true;
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            const alreadyGone = deleted.current.has(id);
            deleted.current.add(id);
            if (!alreadyGone) notifyRef.current(MSG_NOTE_NOT_FOUND);
            removeLocal(id);
            return "gone";
          }
          return false; // status "Gagal menyimpan" tampil di header editor
        }
      });
      queue.current = run;
      return run;
    },
    [notebookId, accessToken, removeLocal]
  );

  // Melempar error kalau gagal; popup ganti nama menampilkan pesannya.
  async function renameNote(note, title) {
    try {
      const data = await updateNote(notebookId, note._id, { title }, accessToken);
      const updatedAt = data?.note?.updatedAt;
      setNotes((list) =>
        list.map((n) => (n._id === note._id ? { ...n, title, updatedAt: updatedAt ?? n.updatedAt } : n))
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        notifyRef.current(MSG_NOTE_NOT_FOUND);
        removeLocal(note._id);
        return;
      }
      throw err;
    }
  }

  // Tidak melempar error: kalau gagal, tampil sebagai toast.
  async function removeNote(id) {
    deleted.current.add(id);
    try {
      await deleteNote(notebookId, id, accessToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        notifyRef.current(MSG_NOTE_NOT_FOUND);
      } else {
        deleted.current.delete(id);
        notifyRef.current(noteErrorToMessage(err));
        return;
      }
    }
    removeLocal(id);
  }

  return { notes, loading, creating, activeId, setActiveId, newNoteId, addNote, saveNote, renameNote, removeNote };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Tombol toolbar. onMouseDown dicegah supaya seleksi teks di editor tidak hilang saat diklik. */
function ToolBtn({ label, active, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      className={`note-tool${active ? " is-active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Mode editor (State 2). Isi editor tidak dikontrol React (contentEditable) supaya riwayat
 * undo/redo bawaan browser (Ctrl+Z / Ctrl+Y) tetap utuh. Komponen ini di-remount per catatan (key).
 * onSave(id, patch) mengembalikan true | false | "gone".
 */
function NoteEditor({ note, focusTitle, icons, onBack, onSave, onDelete }) {
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const [title, setTitle] = useState(note.title);
  const [titleError, setTitleError] = useState("");
  const [status, setStatus] = useState("saved"); // "saved" | "saving" | "error"
  const [toolsOpen, setToolsOpen] = useState(false);
  const [active, setActive] = useState({});

  const latest = useRef({ title: note.title, html: note.content }); // nilai terbaru, dibaca saat menyimpan
  const dirty = useRef({ title: false, content: false });
  const pending = useRef(0); // jumlah simpanan yang sedang berjalan
  const timer = useRef(null);
  const onSaveRef = useRef(onSave);
  const runSaveRef = useRef(null);
  onSaveRef.current = onSave;

  useLayoutEffect(() => {
    editorRef.current.innerHTML = toEditorHtml(note.content);
    document.execCommand("defaultParagraphSeparator", false, "p"); // Enter membuat <p>, bukan <div>
    if (focusTitle) {
      titleRef.current.focus();
      titleRef.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tombol toolbar menyala sesuai format di posisi kursor.
  useEffect(() => {
    function update() {
      const el = editorRef.current;
      const anchor = document.getSelection()?.anchorNode;
      if (!el || !anchor || !el.contains(anchor)) return;
      try {
        const next = Object.fromEntries(NOTE_STATE_COMMANDS.map((c) => [c, document.queryCommandState(c)]));
        next.block = String(document.queryCommandValue("formatBlock")).toLowerCase().replace(/[<>]/g, "");
        setActive((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch {
        /* browser tidak mendukung query ini: abaikan */
      }
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function titleIsValid() {
    return !validateNoteTitle(latest.current.title);
  }

  async function runSave() {
    const sendTitle = dirty.current.title && titleIsValid(); // judul tidak valid tidak dikirim
    const sendContent = dirty.current.content;
    if (!sendTitle && !sendContent) return;

    const patch = {};
    if (sendTitle) patch.title = latest.current.title.trim();
    if (sendContent) patch.content = serializeNoteHtml(latest.current.html);
    if (sendTitle) dirty.current.title = false;
    if (sendContent) dirty.current.content = false;

    pending.current += 1;
    setStatus("saving");
    const result = await onSaveRef.current(note._id, patch);
    pending.current -= 1;

    if (result === false) {
      if (sendTitle) dirty.current.title = true;
      if (sendContent) dirty.current.content = true;
      setStatus("error");
    } else if (result === true && pending.current === 0) {
      const stillDirty = dirty.current.content || (dirty.current.title && titleIsValid());
      if (!stillDirty) setStatus("saved");
    }
  }
  runSaveRef.current = runSave;

  function markDirty(kind) {
    dirty.current[kind] = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSaveRef.current(), AUTOSAVE_DELAY_MS);
    if (kind === "content" || titleIsValid()) setStatus("saving");
  }

  // Keluar dari editor (kembali ke daftar, panel diciutkan, pindah halaman): simpan sisa perubahan.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      runSaveRef.current();
    },
    []
  );

  function syncContent() {
    if (editorRef.current) latest.current.html = editorRef.current.innerHTML;
    markDirty("content");
  }

  function exec(command, value) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncContent();
  }

  function handleTitleChange(e) {
    const value = e.target.value;
    setTitle(value);
    latest.current.title = value;
    setTitleError(validateNoteTitle(value));
    markDirty("title");
  }

  function handlePaste(e) {
    // Tempel sebagai teks biasa supaya format dari website/Word tidak ikut masuk.
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  }

  function handleKeyDown(e) {
    // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+B/I/U sudah bawaan browser; Ctrl/Cmd+Y dibuat seragam.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "y") {
      e.preventDefault();
      exec("redo");
    }
  }

  async function handleBack() {
    clearTimeout(timer.current);
    await runSave();
    onBack();
  }

  return (
    <div className="note-editor-wrap">
      <div className="note-bar">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label="Kembali ke daftar catatan">
          ←
        </button>
        <span className={`note-status note-status--${status}`} role="status" aria-live="polite">
          {status === "saving" && "Menyimpan..."}
          {status === "saved" && (
            <>
              <CheckIcon /> Tersimpan
            </>
          )}
          {status === "error" && "Gagal menyimpan"}
        </span>
        <button type="button" className="icon-btn" onClick={() => onDelete(note)} aria-label="Hapus catatan">
          {icons.trash}
        </button>
      </div>

      <input
        ref={titleRef}
        className="input note-title-input"
        value={title}
        onChange={handleTitleChange}
        onBlur={() => setTitleError(validateNoteTitle(title))}
        placeholder="Judul Catatan"
        aria-label="Judul Catatan"
        aria-invalid={titleError ? "true" : undefined}
        aria-describedby={titleError ? "note-title-error" : undefined}
        autoComplete="off"
      />
      {titleError && (
        <p className="msg-error" id="note-title-error" role="alert">
          {titleError}
        </p>
      )}

      <div className="note-toolbar" role="toolbar" aria-label="Format teks">
        <ToolBtn label="Urungkan (Ctrl+Z)" onClick={() => exec("undo")}>↶</ToolBtn>
        <ToolBtn label="Ulangi (Ctrl+Y)" onClick={() => exec("redo")}>↷</ToolBtn>
        <ToolBtn label="Tebal (Ctrl+B)" active={active.bold} onClick={() => exec("bold")}><b>B</b></ToolBtn>
        <ToolBtn label="Miring (Ctrl+I)" active={active.italic} onClick={() => exec("italic")}><i>I</i></ToolBtn>
        <ToolBtn label="Alat lainnya" active={toolsOpen} aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)}>
          ⋮
        </ToolBtn>
      </div>

      {toolsOpen && (
        <div className="note-tools" role="group" aria-label="Alat format lainnya">
          <ToolBtn label="Garis bawah (Ctrl+U)" active={active.underline} onClick={() => exec("underline")}><u>U</u></ToolBtn>
          <ToolBtn label="Daftar berpoin" active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")}>• ≡</ToolBtn>
          <ToolBtn label="Daftar bernomor" active={active.insertOrderedList} onClick={() => exec("insertOrderedList")}>1. ≡</ToolBtn>
          <span className="note-tools-sep" aria-hidden="true" />
          {NOTE_ALIGN_TOOLS.map(([command, label, text]) => (
            <ToolBtn key={command} label={label} active={active[command]} onClick={() => exec(command)}>{text}</ToolBtn>
          ))}
          <span className="note-tools-sep" aria-hidden="true" />
          {NOTE_BLOCK_TOOLS.map(([tag, label, text]) => (
            <ToolBtn key={tag} label={label} active={active.block === tag} onClick={() => exec("formatBlock", `<${tag}>`)}>{text}</ToolBtn>
          ))}
        </div>
      )}

      <div
        ref={editorRef}
        className="note-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Isi catatan"
        onInput={syncContent}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

/** Popup bawaan <dialog> yang memakai kelas .modal dari style utama (sama seperti Modal di App.jsx). */
function NoteDialog({ label, className = "", canClose = true, onClose, children }) {
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
    const invalid = validateNoteTitle(trimmed);
    if (invalid) {
      setError(invalid);
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
      setError(err?.message || MSG_GENERIC_ERROR);
      setSaving(false);
    }
  }

  return (
    <NoteDialog label="Ganti nama catatan" canClose={!saving} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="rename-note-title" className="modal-label">Judul Catatan</label>
        <input
          id="rename-note-title"
          className="input modal-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          onFocus={(e) => e.target.select()}
          placeholder="Judul Catatan"
          aria-invalid={error ? "true" : undefined}
          autoComplete="off"
        />
        {error && <p className="msg-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose} disabled={saving}>Batal</button>
          <button type="submit" className="modal-save" disabled={saving}>Simpan</button>
        </div>
      </form>
    </NoteDialog>
  );
}

function ConfirmDeleteNoteDialog({ onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    await onConfirm();
  }
  return (
    <NoteDialog label="Konfirmasi hapus catatan" className="modal--confirm" canClose={!deleting} onClose={onCancel}>
      <div className="modal-form">
        <p className="modal-message">Apakah Anda yakin ingin menghapus catatan ini?</p>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel} disabled={deleting}>Batal</button>
          <button type="button" className="modal-delete" onClick={handleDelete} disabled={deleting}>Hapus</button>
        </div>
      </div>
    </NoteDialog>
  );
}

/**
 * Panel kanan: daftar catatan (State 1) atau editor (State 2), bisa diciutkan.
 * Props: notes = hasil useNotes(), collapsed, onToggle, icons = { toggle, rename, trash } (elemen ikon dari App.jsx).
 */
export function NotesPanel({ notes: api, collapsed, onToggle, icons }) {
  const { notes, loading, creating, activeId, setActiveId, newNoteId, addNote, saveNote, renameNote, removeNote } = api;
  const [menu, setMenu] = useState(null); // { id, top, right }
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeNote = notes.find((n) => n._id === activeId) || null;
  const sorted = [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const menuNote = menu ? notes.find((n) => n._id === menu.id) : null;

  // Menu memakai posisi "fixed" supaya tidak terpotong daftar yang bisa di-scroll.
  function toggleMenu(e, id) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu((m) => (m?.id === id ? null : { id, top: rect.bottom + 4, right: window.innerWidth - rect.right }));
  }

  function pick(action) {
    const note = menuNote;
    setMenu(null);
    if (note) action(note);
  }

  return (
    <>
      <section className={`panel panel-notes${collapsed ? " is-collapsed" : ""}`} aria-label="Catatan">
        <div className="panel-head">
          {!collapsed && <h2 className="panel-title">Catatan</h2>}
          <button
            type="button"
            className="panel-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Perluas panel Catatan" : "Ciutkan panel Catatan"}
            aria-expanded={!collapsed}
          >
            {icons.toggle}
          </button>
        </div>

        {!collapsed && activeNote && (
          <NoteEditor
            key={activeNote._id}
            note={activeNote}
            focusTitle={activeNote._id === newNoteId}
            icons={icons}
            onBack={() => setActiveId(null)}
            onSave={saveNote}
            onDelete={setDeleteTarget}
          />
        )}

        {!collapsed && !activeNote && (
          <>
            <ul className="notes-list" aria-busy={loading}>
              {loading && <li className="notes-empty">Memuat catatan...</li>}
              {!loading && sorted.length === 0 && <li className="notes-empty">Belum ada catatan.</li>}
              {sorted.map((n) => (
                <li key={n._id} className="note-item">
                  <button type="button" className="note-open" onClick={() => setActiveId(n._id)}>
                    <span className="note-title" title={n.title}>{n.title}</span>
                    <span className="note-date">{formatDate(n.updatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Opsi untuk ${n.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === n._id}
                    onClick={(e) => toggleMenu(e, n._id)}
                  >
                    ⋮
                  </button>
                </li>
              ))}
            </ul>

            <button type="button" className="upload-btn notes-add-btn" onClick={addNote} disabled={creating}>
              Tambahkan Catatan
            </button>

            {menu && menuNote && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <div className="dropdown-menu dropdown-menu--fixed" role="menu" style={{ top: menu.top, right: menu.right }}>
                  <button type="button" role="menuitem" onClick={() => pick(setRenameTarget)}>
                    {icons.rename} Ganti Nama
                  </button>
                  <button type="button" role="menuitem" className="danger" onClick={() => pick(setDeleteTarget)}>
                    {icons.trash} Hapus
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {renameTarget && (
        <RenameNoteDialog note={renameTarget} onClose={() => setRenameTarget(null)} onRename={renameNote} />
      )}
      {deleteTarget && (
        <ConfirmDeleteNoteDialog
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await removeNote(deleteTarget._id);
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}