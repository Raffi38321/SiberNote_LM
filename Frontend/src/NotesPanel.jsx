// Fitur Catatan (panel kanan workspace): daftar catatan, editor teks, dan auto-save.
// Modul mandiri: hanya bergantung pada ./api. Gayanya ada di bagian "Panel Catatan" di style.css.
// Ikon diberikan lewat prop `icons` supaya sama dengan ikon di App.jsx.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, getNotes, createNote, updateNote, deleteNote } from "./api";

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
  ["justifyLeft", "Rata kiri", AlignLeftIcon],
  ["justifyCenter", "Rata tengah", AlignCenterIcon],
  ["justifyRight", "Rata kanan", AlignRightIcon],
  ["justifyFull", "Rata kiri-kanan", AlignJustifyIcon],
];
// Pilihan gaya paragraf di dropdown "Normal".
const NOTE_BLOCK_TOOLS = [
  ["p", "Normal"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
  ["h4", "Heading 4"],
  ["h5", "Heading 5"],
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
  // Mengembalikan true kalau catatan berhasil dibuat (dipakai untuk membuka panel setelahnya).
  async function addNote() {
    if (creating) return false;
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
        return true;
      }
      return false;
    } catch (err) {
      notifyRef.current(noteErrorToMessage(err));
      return false;
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
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 0C4.81331 0 3.65328 0.351894 2.66658 1.01118C1.67989 1.67047 0.910851 2.60754 0.456725 3.7039C0.0025997 4.80026 -0.11622 6.00665 0.115291 7.17054C0.346802 8.33443 0.918247 9.40352 1.75736 10.2426C2.59648 11.0818 3.66557 11.6532 4.82946 11.8847C5.99335 12.1162 7.19975 11.9974 8.2961 11.5433C9.39246 11.0891 10.3295 10.3201 10.9888 9.33342C11.6481 8.34672 12 7.18669 12 6C12 4.4087 11.3679 2.88258 10.2426 1.75736C9.11742 0.632141 7.5913 0 6 0ZM6 11.1429C4.98284 11.1429 3.98852 10.8412 3.14278 10.2761C2.29705 9.71102 1.63787 8.90782 1.24862 7.96808C0.859371 7.02835 0.757526 5.99429 0.955964 4.99668C1.1544 3.99906 1.64421 3.08269 2.36345 2.36345C3.08269 1.64421 3.99906 1.1544 4.99668 0.955961C5.9943 0.757523 7.02835 0.859369 7.96809 1.24862C8.90782 1.63787 9.71103 2.29704 10.2761 3.14278C10.8412 3.98852 11.1429 4.98284 11.1429 6C11.1429 7.36397 10.601 8.67207 9.63655 9.63655C8.67208 10.601 7.36397 11.1429 6 11.1429Z" fill="#CECECE"/>
      <path d="M9.12478 3.5528L5.14335 7.53851L2.87621 5.26708C2.79551 5.18638 2.68606 5.14104 2.57193 5.14104C2.4578 5.14104 2.34834 5.18638 2.26764 5.26708C2.18694 5.34778 2.1416 5.45724 2.1416 5.57137C2.1416 5.62788 2.15273 5.68384 2.17436 5.73605C2.19598 5.78826 2.22768 5.83569 2.26764 5.87565L4.83907 8.44708C4.87891 8.48725 4.92631 8.51913 4.97854 8.54089C5.03076 8.56265 5.08678 8.57385 5.14335 8.57385C5.19993 8.57385 5.25595 8.56265 5.30817 8.54089C5.3604 8.51913 5.4078 8.48725 5.44764 8.44708L9.73335 4.16137C9.77331 4.12141 9.80501 4.07397 9.82664 4.02176C9.84826 3.96955 9.85939 3.91359 9.85939 3.85708C9.85939 3.80057 9.84826 3.74461 9.82664 3.6924C9.80501 3.64019 9.77331 3.59276 9.73335 3.5528C9.69339 3.51284 9.64596 3.48114 9.59375 3.45951C9.54154 3.43789 9.48558 3.42676 9.42907 3.42676C9.37256 3.42676 9.3166 3.43789 9.26439 3.45951C9.21218 3.48114 9.16474 3.51284 9.12478 3.5528Z" fill="#CECECE"/>
    </svg>

  );
}

/** Pembungkus ikon toolbar (garis tipis, mengikuti warna teks). */
function ToolSvg({ children, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 19V17H14.1C15.15 17 16.0625 16.6667 16.8375 16C17.6125 15.3333 18 14.5 18 13.5C18 12.5 17.6125 11.6667 16.8375 11C16.0625 10.3333 15.15 10 14.1 10H7.8L10.4 12.6L9 14L4 9L9 4L10.4 5.4L7.8 8H14.1C15.7167 8 17.1042 8.525 18.2625 9.575C19.4208 10.625 20 11.9333 20 13.5C20 15.0667 19.4208 16.375 18.2625 17.425C17.1042 18.475 15.7167 19 14.1 19H7Z" fill="#CECECE"/>
    </svg>


  );
}

function RedoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.9 19C8.28333 19 6.89583 18.475 5.7375 17.425C4.57917 16.375 4 15.0667 4 13.5C4 11.9333 4.57917 10.625 5.7375 9.575C6.89583 8.525 8.28333 8 9.9 8H16.2L13.6 5.4L15 4L20 9L15 14L13.6 12.6L16.2 10H9.9C8.85 10 7.9375 10.3333 7.1625 11C6.3875 11.6667 6 12.5 6 13.5C6 14.5 6.3875 15.3333 7.1625 16C7.9375 16.6667 8.85 17 9.9 17H17V19H9.9Z" fill="#CECECE"/>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

function TriangleDownIcon() {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.49512 11.25L-7.34329e-05 0L12.9903 0L6.49512 11.25Z" fill="#CECECE"/>
    </svg>
  );
}

function UnderLineIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.74967 2.875V9.58333C5.74967 11.1083 6.35548 12.5709 7.43381 13.6492C8.51214 14.7275 9.97468 15.3333 11.4997 15.3333C13.0247 15.3333 14.4872 14.7275 15.5655 13.6492C16.6439 12.5709 17.2497 11.1083 17.2497 9.58333V2.875M3.83301 20.125H19.1663" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="#CECECE"/>
    </svg>
  );
}


function BulletListIcon() {
  return (
    <svg width="30" height="21" viewBox="0 0 30 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="1.5" cy="1.5" r="1.5" fill="#D9D9D9"/>
      <circle cx="1.5" cy="7.5" r="1.5" fill="#D9D9D9"/>
      <circle cx="1.5" cy="13.5" r="1.5" fill="#D9D9D9"/>
      <circle cx="1.5" cy="19.5" r="1.5" fill="#D9D9D9"/>
      <rect x="4" width="26" height="3" fill="#D9D9D9"/>
      <rect x="4" y="6" width="26" height="3" fill="#D9D9D9"/>
      <rect x="4" y="12" width="26" height="3" fill="#D9D9D9"/>
      <rect x="4" y="18" width="26" height="3" fill="#D9D9D9"/>
    </svg>

  );
}

function NumberListIcon() {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="26" height="3" fill="#D9D9D9"/>
        <rect x="4" y="9" width="26" height="3" fill="#D9D9D9"/>
        <rect x="4" y="15" width="26" height="3" fill="#D9D9D9"/>
        <rect x="4" y="21" width="26" height="3" fill="#D9D9D9"/>
        <path d="M1.135 3.145V2.35H2.52V6H1.63V3.145H1.135Z" fill="#CECECE"/>
        <path d="M0.195 11.315C0.308333 11.225 0.36 11.1833 0.35 11.19C0.676667 10.92 0.933333 10.6983 1.12 10.525C1.31 10.3517 1.47 10.17 1.6 9.98C1.73 9.79 1.795 9.605 1.795 9.425C1.795 9.28833 1.76333 9.18167 1.7 9.105C1.63667 9.02833 1.54167 8.99 1.415 8.99C1.28833 8.99 1.18833 9.03833 1.115 9.135C1.045 9.22833 1.01 9.36167 1.01 9.535H0.185C0.191667 9.25167 0.251667 9.015 0.365 8.825C0.481667 8.635 0.633333 8.495 0.82 8.405C1.01 8.315 1.22 8.27 1.45 8.27C1.84667 8.27 2.145 8.37167 2.345 8.575C2.54833 8.77833 2.65 9.04333 2.65 9.37C2.65 9.72667 2.52833 10.0583 2.285 10.365C2.04167 10.6683 1.73167 10.965 1.355 11.255H2.705V11.95H0.195V11.315Z" fill="#CECECE"/>
        <path d="M0.255 15.38C0.268333 15.0233 0.385 14.7483 0.605 14.555C0.825 14.3617 1.12333 14.265 1.5 14.265C1.75 14.265 1.96333 14.3083 2.14 14.395C2.32 14.4817 2.455 14.6 2.545 14.75C2.63833 14.9 2.685 15.0683 2.685 15.255C2.685 15.475 2.63 15.655 2.52 15.795C2.41 15.9317 2.28167 16.025 2.135 16.075V16.095C2.325 16.1583 2.475 16.2633 2.585 16.41C2.695 16.5567 2.75 16.745 2.75 16.975C2.75 17.1817 2.70167 17.365 2.605 17.525C2.51167 17.6817 2.37333 17.805 2.19 17.895C2.01 17.985 1.795 18.03 1.545 18.03C1.145 18.03 0.825 17.9317 0.585 17.735C0.348333 17.5383 0.223333 17.2417 0.21 16.845H1.04C1.04333 16.9917 1.085 17.1083 1.165 17.195C1.245 17.2783 1.36167 17.32 1.515 17.32C1.645 17.32 1.745 17.2833 1.815 17.21C1.88833 17.1333 1.925 17.0333 1.925 16.91C1.925 16.75 1.87333 16.635 1.77 16.565C1.67 16.4917 1.50833 16.455 1.285 16.455H1.125V15.76H1.285C1.455 15.76 1.59167 15.7317 1.695 15.675C1.80167 15.615 1.855 15.51 1.855 15.36C1.855 15.24 1.82167 15.1467 1.755 15.08C1.68833 15.0133 1.59667 14.98 1.48 14.98C1.35333 14.98 1.25833 15.0183 1.195 15.095C1.135 15.1717 1.1 15.2667 1.09 15.38H0.255Z" fill="#CECECE"/>
        <path d="M0.245 23.35V22.66L1.825 20.4H2.78V22.61H3.19V23.35H2.78V24H1.925V23.35H0.245ZM1.985 21.34L1.145 22.61H1.985V21.34Z" fill="#CECECE"/>
    </svg>

  );
}

function AlignLeftIcon() {
  return ( 
    <svg width="30" height="21" viewBox="0 0 30 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="3" fill="#D9D9D9"/>
      <rect y="12" width="30" height="3" fill="#D9D9D9"/>
      <rect y="6" width="24" height="3" fill="#D9D9D9"/>
      <rect y="18" width="24" height="3" fill="#D9D9D9"/>
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg width="30" height="21" viewBox="0 0 30 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="30" height="3" fill="#D9D9D9"/>
        <rect y="12" width="30" height="3" fill="#D9D9D9"/>
        <rect x="3" y="6" width="24" height="3" fill="#D9D9D9"/>
        <rect x="3" y="18" width="24" height="3" fill="#D9D9D9"/>
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg width="30" height="21" viewBox="0 0 30 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="3" fill="#D9D9D9"/>
      <rect y="12" width="30" height="3" fill="#D9D9D9"/>
      <rect x="6" y="6" width="24" height="3" fill="#D9D9D9"/>
      <rect x="6" y="18" width="24" height="3" fill="#D9D9D9"/>
    </svg>
  );
}
function AlignJustifyIcon() {
  return (
    <svg width="30" height="21" viewBox="0 0 30 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="3" fill="#D9D9D9"/>
      <rect y="12" width="30" height="3" fill="#D9D9D9"/>
      <rect y="6" width="30" height="3" fill="#D9D9D9"/>
      <rect y="18" width="30" height="3" fill="#D9D9D9"/>
    </svg>
  );
}

function Iicon() {
  return (
      <svg width="9" height="13" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.43965 13.4098L5.63965 0.909823H7.52965L5.31965 13.4098H3.43965ZM-0.000351548 14.3198L0.309649 12.5598H8.74965L8.43965 14.3198H-0.000351548ZM2.21965 1.74982L2.51965 -0.00017643H10.9596L10.6496 1.74982H2.21965Z" fill="#CECECE"/>
      </svg>
 );  
}


/** Ikon "tutup editor / kembali ke daftar" di header (panah masuk dari sudut). */
function CollapseNoteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6.81836" y="8.18188" width="6.81818" height="1.36364" transform="rotate(90 6.81836 8.18188)" fill="#CECECE"/>
      <rect y="8.18188" width="6.81818" height="1.36364" fill="#CECECE"/>
      <rect x="8.18164" y="6.81812" width="6.81818" height="1.36364" transform="rotate(-90 8.18164 6.81812)" fill="#CECECE"/>
      <rect x="15" y="6.81812" width="6.81818" height="1.36364" transform="rotate(-180 15 6.81812)" fill="#CECECE"/>
    </svg>

  );
}

/** Ikon tempat sampah warna terang untuk header editor (ikon merah dari App dipakai di menu daftar). */
function NoteTrashIcon() {
  return (
    <ToolSvg size={24}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </ToolSvg>
  );
}

/** Menutup popup (dropdown/bilah alat) saat klik di luar atau menekan Esc. */
function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
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
function NoteEditor({ note, focusTitle, onBack, onSave, onDelete }) {
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const [title, setTitle] = useState(note.title);
  const [titleError, setTitleError] = useState("");
  const [status, setStatus] = useState("saved"); // "saved" | "saving" | "error"
  const [toolsOpen, setToolsOpen] = useState(false); // bilah alat lanjutan (•••)
  const [blockOpen, setBlockOpen] = useState(false); // dropdown gaya paragraf (Normal ▾)
  const blockRef = useRef(null);
  const moreRef = useRef(null);
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

  useDismiss(blockRef, blockOpen, () => setBlockOpen(false));
  useDismiss(moreRef, toolsOpen, () => setToolsOpen(false));

  const blockLabel = (NOTE_BLOCK_TOOLS.find(([tag]) => tag === active.block) || NOTE_BLOCK_TOOLS[0])[1];

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
      {/* Header: judul panel, status simpan, dan tombol kembali ke daftar catatan */}
      <div className="note-head">
        <h2 className="panel-title">Catatan</h2>
        <div className="note-head-actions">
          <button
            type="button"
            className="panel-toggle"
            onClick={handleBack}
            aria-label="Kembali ke daftar catatan"
            title="Kembali ke daftar catatan"
          >
            <CollapseNoteIcon />
          </button>
        </div>
      </div>

      {/* Judul besar tanpa kotak + tombol hapus */}
      <div className={`note-title-row${titleError ? " has-error" : ""}`}>
        <div className="note-title-field">
        <span className={`note-status note-status--${status}`} role="status" aria-live="polite">
            {status === "saving" && "Menyimpan..."}
            {status === "saved" && (
              <>
                <CheckIcon /> Tersimpan
              </>
            )}
            {status === "error" && "Gagal menyimpan"}
          </span>
          <input
            ref={titleRef}
            className="note-title-input"
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
        </div>
        <button
          type="button"
          className="note-trash"
          onClick={() => onDelete(note)}
          aria-label="Hapus catatan"
          title="Hapus catatan"
        >
          <NoteTrashIcon />
        </button>
      </div>

      {/* Toolbar: Undo, Redo | Normal ▾ | B, I | ••• */}
      <div className="note-toolbar" role="toolbar" aria-label="Format teks">
        <ToolBtn label="Urungkan (Ctrl+Z)" onClick={() => exec("undo")}><UndoIcon /></ToolBtn>
        <ToolBtn label="Ulangi (Ctrl+Y)" onClick={() => exec("redo")}><RedoIcon /></ToolBtn>

        <span className="note-sep" aria-hidden="true" />

        <div className="menu-wrap" ref={blockRef}>
          <button
            type="button"
            className="note-style-btn"
            aria-label="Gaya paragraf"
            aria-haspopup="menu"
            aria-expanded={blockOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setToolsOpen(false);
              setBlockOpen((v) => !v);
            }}
          >
            {blockLabel} <TriangleDownIcon />
          </button>
          {blockOpen && (
            <div className="dropdown-menu" role="menu">
              {NOTE_BLOCK_TOOLS.map(([tag, label]) => (
                <button
                  key={tag}
                  type="button"
                  role="menuitemradio"
                  aria-checked={blockLabel === label}
                  className={blockLabel === label ? "is-active" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    exec("formatBlock", `<${tag}>`);
                    setBlockOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="note-sep" aria-hidden="true" />

        <ToolBtn label="Tebal (Ctrl+B)" active={active.bold} onClick={() => exec("bold")}><b>B</b></ToolBtn>
        <ToolBtn label="Miring (Ctrl+I)" active={active.italic} onClick={() => exec("italic")}><Iicon/></ToolBtn>

        <span className="note-sep" aria-hidden="true" />

        <div className="note-more" ref={moreRef}>
          <ToolBtn
            label="Alat lainnya"
            active={toolsOpen}
            aria-expanded={toolsOpen}
            onClick={() => {
              setBlockOpen(false);
              setToolsOpen((v) => !v);
            }}
          >
            <DotsIcon />
          </ToolBtn>
          {toolsOpen && (
            <div className="note-popup" role="group" aria-label="Alat format lainnya">
              <ToolBtn label="Garis bawah (Ctrl+U)" active={active.underline} onClick={() => exec("underline")}><UnderLineIcon /></ToolBtn>
              <ToolBtn label="Daftar berpoin" active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")}><BulletListIcon /></ToolBtn>
              <ToolBtn label="Daftar bernomor" active={active.insertOrderedList} onClick={() => exec("insertOrderedList")}><NumberListIcon /></ToolBtn>
              {NOTE_ALIGN_TOOLS.map(([command, label, Icon]) => (
                <ToolBtn key={command} label={label} active={active[command]} onClick={() => exec(command)}><Icon /></ToolBtn>
              ))}
            </div>
          )}
        </div>
      </div>

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
        {error && (
          <div className="error-summary" role="alert">
            <p>{error}</p>
          </div>
        )}
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
          <button type="button" className="modal-delete" onClick={handleDelete} disabled={deleting}>Yakin</button>
        </div>
      </div>
    </NoteDialog>
  );
}

/** Ikon catatan: kotak bulat dengan dua garis teks (dipakai di daftar, tombol tambah, dan panel menyusut). */
function NoteIcon() {
  return (
    <svg className="note-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8.5 10h7M8.5 14h4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
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
        {/* Saat editor tampil, header-nya ada di dalam editor (sesuai desain). */}
        {!(activeNote && !collapsed) && (
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
        )}

        {/* Panel menyusut: tombol tambah + satu ikon per catatan. Klik ikon = buka panel dan catatannya. */}
        {collapsed && (
          <ul className="panel-rail" aria-label="Daftar catatan">
            {/* <li>
              <button
                type="button"
                className="rail-add"
                aria-label="Tambahkan catatan"
                title="Tambahkan catatan"
                disabled={creating}
                onClick={async () => {
                  // Panel dibuka setelah catatan baru jadi, supaya tidak sempat menampilkan catatan lama.
                  if (await addNote()) onToggle();
                }}
              >
                <PlusIcon />
              </button>
            </li> */}
            {sorted.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  className={`rail-note${n._id === activeId ? " is-active" : ""}`}
                  aria-label={`Buka catatan ${n.title}`}
                  title={n.title}
                  onClick={() => {
                    onToggle();
                    setActiveId(n._id);
                  }}
                >
                  <NoteIcon />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!collapsed && activeNote && (
          <NoteEditor
            key={activeNote._id}
            note={activeNote}
            focusTitle={activeNote._id === newNoteId}
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
                    <NoteIcon />
                    <span className="note-text">
                      <span className="note-title" title={n.title}>{n.title}</span>
                      <span className="note-date">{formatDate(n.updatedAt)}</span>
                    </span>
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

            <button type="button" className="notes-add-btn" onClick={addNote} disabled={creating}>
              <NoteIcon /> Tambahkan Catatan
            </button>

            {menu && menuNote && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <div className="dropdown-menu dropdown-menu--fixed" role="menu" style={{ top: menu.top, right: menu.right }}>
                  <button type="button" role="menuitem" className="danger" onClick={() => pick(setDeleteTarget)}>
                    {icons.trash} Hapus
                  </button>
                  <button type="button" role="menuitem" onClick={() => pick(setRenameTarget)}>
                    {icons.rename} Ganti judul
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