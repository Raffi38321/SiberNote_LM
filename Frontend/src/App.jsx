import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  register,
  login,
  createNotebook,
  getNotebooks,
  deleteNotebook,
  getDocuments,
  uploadDocument,
  updateDocumentTitle,
  deleteDocument,
  getDocumentStatus,
  saveRefreshToken,
  clearRefreshToken,
} from "./api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,16}$/;
const PASSWORD_RE = /^[a-zA-Z0-9]{8,16}$/;

function validateUsername(username) {
  if (!username.trim()) return "Username wajib diisi.";
  if (!USERNAME_RE.test(username.trim()))
    return "Username 1–16 karakter, hanya huruf, angka, _ dan -.";
  return "";
}

function validatePassword(password, username) {
  if (!password) return "Password wajib diisi.";
  if (!PASSWORD_RE.test(password))
    return "Password 8–16 karakter, hanya huruf dan angka.";
  if (username && password.toLowerCase().includes(username.trim().toLowerCase()))
    return "Password tidak boleh mengandung username.";
  return "";
}

/** Ubah array errors dari backend ([{field, message}]) jadi { [field]: message }. */
function mapFieldErrors(err) {
  const map = {};
  if (err instanceof ApiError && Array.isArray(err.fieldErrors)) {
    for (const fe of err.fieldErrors) {
      if (fe?.field) map[fe.field] = fe.message;
    }
  }
  return map;
}

/* ---------- Komponen kecil ---------- */

function Header() {
  return (
    <header className="topbar">
      <div className="logo" aria-hidden="true">Logo</div>
      <span className="brand">SiberNoteLM</span>
    </header>
  );
}

function EyeIcon({ hidden }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Area pesan error terpusat — satu box merah di bawah header. */
function ErrorSummary({ messages }) {
  if (!messages.length) return null;
  return (
    <div className="error-summary" role="alert">
      {messages.map((msg, i) => (
        <p key={i}>{msg}</p>
      ))}
    </div>
  );
}

function Field({ id, label, error, showMessage = true, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {showMessage && error && (
        <p className="msg-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({ id, error, ...props }) {
  return (
    <input
      id={id}
      className="input"
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  );
}

function PasswordInput({ id, error, describedBy, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-wrap">
      <input
        id={id}
        className="input"
        type={visible ? "text" : "password"}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[error ? `${id}-error` : "", describedBy || ""].join(" ").trim() || undefined}
        {...props}
      />
      <button
        type="button"
        className="eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  );
}

/* ---------- Halaman Login (terhubung ke POST /user/login) ---------- */

function LoginPage({ goRegister, notice, onLoginSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";
    if (!form.password) next.password = "Password wajib diisi.";
    setErrors(next);
    setApiError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await login({ email: form.email.trim(), password: form.password });
      saveRefreshToken(data.refreshToken);
      onLoginSuccess(data.accessToken);
    } catch (err) {
      const fieldErrors = mapFieldErrors(err);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const errorMessages = [errors.email, errors.password, apiError].filter(Boolean);

  return (
    <main className="auth">
      <h1>Login</h1>
      {notice && <p className="msg-success" role="status">{notice}</p>}
      <ErrorSummary messages={errorMessages} />
      <form onSubmit={handleSubmit} noValidate>
        <Field id="email" label="Email" error={errors.email} showMessage={false}>
          <TextInput id="email" name="email" type="email" autoComplete="email"
            placeholder="Masukkan email" value={form.email} onChange={update} error={errors.email} />
        </Field>

        <Field id="password" label="Password" error={errors.password} showMessage={false}>
          <PasswordInput id="password" name="password" autoComplete="current-password"
            placeholder="Masukkan password" value={form.password} onChange={update} error={errors.password} />
        </Field>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Login"}
        </button>
      </form>
      <p className="switch">
        Belum memiliki akun?{" "}
        <button type="button" className="link" onClick={goRegister}>Register</button>
      </p>
    </main>
  );
}

/* ---------- Halaman Register (terhubung ke POST /user/register) ---------- */

/** Validasi satu field secara terpisah, dipakai untuk validasi real-time. */
function validateField(name, value, form) {
  switch (name) {
    case "username":
      return validateUsername(value);
    case "email":
      if (!value.trim()) return "Email wajib diisi.";
      if (!EMAIL_RE.test(value)) return "Format email tidak valid.";
      return "";
    case "password":
      return validatePassword(value, form.username);
    case "confirm":
      if (!value) return "Konfirmasi password wajib diisi.";
      if (value !== form.password) return "Konfirmasi password tidak sama.";
      return "";
    default:
      return "";
  }
}

function RegisterPage({ goLogin, onRegistered }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validasi real-time: begitu field pernah disentuh (blur), error langsung
  // diperbarui setiap kali nilainya berubah — termasuk field "confirm" yang
  // ikut tervalidasi ulang saat "password" diedit.
  function update(e) {
    const { name, value } = e.target;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);

    setErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      if (touched[name]) nextErrors[name] = validateField(name, value, nextForm);
      if (name === "password" && touched.confirm) {
        nextErrors.confirm = validateField("confirm", nextForm.confirm, nextForm);
      }
      return nextErrors;
    });
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value, form) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    const usernameError = validateUsername(form.username);
    if (usernameError) next.username = usernameError;
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";
    const passwordError = validatePassword(form.password, form.username);
    if (passwordError) next.password = passwordError;
    if (!form.confirm) next.confirm = "Konfirmasi password wajib diisi.";
    else if (form.confirm !== form.password) next.confirm = "Konfirmasi password tidak sama.";
    setErrors(next);
    setTouched({ username: true, email: true, password: true, confirm: true });
    setApiError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      onRegistered();
    } catch (err) {
      const fieldErrors = mapFieldErrors(err);
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const errorMessages = [errors.username, errors.email, errors.password, errors.confirm, apiError].filter(Boolean);

  return (
    <main className="auth">
      <h1>Register</h1>
      <ErrorSummary messages={errorMessages} />
      <form onSubmit={handleSubmit} noValidate>
        <Field id="username" label="Username" error={errors.username} showMessage={false}>
          <TextInput id="username" name="username" autoComplete="username"
            placeholder="Masukkan username" value={form.username} onChange={update} onBlur={handleBlur}
            error={errors.username} />
        </Field>

        <Field id="reg-email" label="Email" error={errors.email} showMessage={false}>
          <TextInput id="reg-email" name="email" type="email" autoComplete="email"
            placeholder="Masukkan email" value={form.email} onChange={update} onBlur={handleBlur}
            error={errors.email} />
        </Field>

        <Field id="reg-password" label="Password" error={errors.password} showMessage={false}>
          <PasswordInput id="reg-password" name="password" autoComplete="new-password"
            placeholder="Masukkan password" value={form.password} onChange={update} onBlur={handleBlur}
            error={errors.password} />
        </Field>

        <Field id="confirm" label="Konfirmasi password" error={errors.confirm} showMessage={false}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password"
            placeholder="Konfirmasi password" value={form.confirm} onChange={update} onBlur={handleBlur}
            error={errors.confirm} />
        </Field>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Register"}
        </button>
      </form>
      <p className="switch">
        Sudah memiliki akun?{" "}
        <button type="button" className="link" onClick={goLogin}>Login</button>
      </p>
    </main>
  );
}

/* ---------- Dashboard ---------- */

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v6" />
      <path d="M7 10h10l-1 4H8l-1-4Z" />
      <path d="M12 14v8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 8h14M5 12h14M5 16h14" />
    </svg>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "az", label: "A-Z" },
];

/**
 * Header untuk halaman setelah login.
 * - onBrandClick (opsional): kalau diisi, logo + nama aplikasi jadi tombol kembali.
 * - actions (opsional): elemen tambahan di sisi kanan, sebelum avatar.
 */
function AppHeader({ onLogout, onBrandClick, actions }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const brand = (
    <>
      <span className="logo" aria-hidden="true">Logo</span>
      <span className="brand">SiberNoteLM</span>
    </>
  );

  return (
    <header className="topbar app-topbar">
      <div className="topbar-left">
        {onBrandClick ? (
          <button
            type="button"
            className="brand-link"
            onClick={onBrandClick}
            aria-label="Kembali ke dashboard"
          >
            {brand}
          </button>
        ) : (
          brand
        )}
      </div>

      <div className="topbar-right">
        {actions}
        <div className="menu-wrap">
          <button
            type="button"
            className="avatar"
            aria-label="Menu profil"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <PersonIcon />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="dropdown-menu dropdown-menu--right" role="menu">
                {/* Edit Profil: UI saja, belum ada endpoint di backend */}
                <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>
                  Edit Profil
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                >
                  Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Pembungkus popup modal memakai elemen <dialog> bawaan browser, sehingga tombol Esc,
 * fokus keyboard, dan lapisan gelap di belakangnya ditangani browser.
 * canClose=false menahan popup agar tidak bisa ditutup (misalnya saat proses simpan berjalan).
 */
function Modal({ label, className = "", canClose = true, onClose, children }) {
  const dialogRef = useRef(null);

  // Tampilkan sebagai popup modal saat pertama kali muncul.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`.trim()}
      aria-label={label}
      onCancel={(e) => {
        // Tombol Esc: ditutup lewat state supaya popup ikut dilepas dari halaman.
        e.preventDefault();
        if (canClose) onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        // Klik di area gelap (di luar kotak popup) menutup popup.
        if (e.target === dialogRef.current && canClose) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

/**
 * Popup untuk membuat catatan baru.
 * onCreate(title) harus mengembalikan Promise; kalau gagal (throw), pesan
 * errornya ditampilkan di dalam popup.
 */
function CreateNotebookDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError("Judul tidak boleh kosong.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      const messages = Object.values(mapFieldErrors(err));
      setError(messages.length ? messages.join(" ") : err.message);
      setSaving(false);
    }
  }

  return (
    <Modal label="Catatan baru" canClose={!saving} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="new-notebook-title" className="modal-label">Judul Catatan</label>
        <input
          id="new-notebook-title"
          className="input modal-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(""); // pesan error hilang begitu pengguna mulai mengetik
          }}
          placeholder="Judul Catatan"
          aria-invalid={error ? "true" : undefined}
          autoComplete="off"
        />
        <ErrorSummary messages={error ? [error] : []} />
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="modal-save" disabled={saving}>
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Popup konfirmasi hapus (menggantikan dialog konfirmasi bawaan browser).
 * Dipakai untuk hapus catatan dan hapus sumber; isi pertanyaan lewat prop message.
 * onConfirm boleh async dan harus menutup popup sendiri setelah selesai.
 */
function ConfirmDeleteDialog({ message, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    await onConfirm();
  }

  return (
    <Modal label="Konfirmasi hapus" className="modal--confirm" canClose={!deleting} onClose={onCancel}>
      <div className="modal-form">
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel} disabled={deleting}>
            Batal
          </button>
          <button type="button" className="modal-delete" onClick={handleConfirm} disabled={deleting}>
            Hapus
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NotebooksPage({ accessToken, onLogout, onOpenNotebook }) {
  const [notebooks, setNotebooks] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadNotebooks() {
    setLoadingList(true);
    setListError("");
    try {
      const data = await getNotebooks(accessToken);
      setNotebooks(data?.notebooks || []);
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadNotebooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dipanggil setelah pengguna menekan "Hapus" di popup konfirmasi.
  async function handleDelete(notebook) {
    setDeletingId(notebook._id);
    setListError("");
    try {
      await deleteNotebook(notebook._id, accessToken);
      setNotebooks((list) => list.filter((nb) => nb._id !== notebook._id));
    } catch (err) {
      setListError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(title) {
    // Backend mewajibkan description, sedangkan popup di desain hanya punya kolom judul.
    // Sementara description diisi sama dengan judul.
    // TODO: konfirmasi ke tim backend/designer (jadikan description opsional, atau tambah kolomnya).
    const data = await createNotebook({ title, description: title }, accessToken);
    if (data?.notebook) {
      setNotebooks((list) => [data.notebook, ...list]);
    } else {
      await loadNotebooks();
    }
  }

  const visible = notebooks
    .filter((nb) => nb.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) =>
      sortBy === "az"
        ? a.title.localeCompare(b.title, "id")
        : new Date(b.createdAt) - new Date(a.createdAt)
    );

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy).label;

  return (
    <>
      <AppHeader onLogout={onLogout} />
      <main className="dashboard">
        <div className="toolbar">
          <button type="button" className="btn-pill" onClick={() => setCreateOpen(true)}>
            Catatan Baru +
          </button>
          <div className="search-wrap">
            <SearchIcon />
            <input
              className="search-input"
              type="search"
              placeholder="Cari catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari catatan"
            />
          </div>
        </div>

        <section className="notebooks-panel">
          <div className="notebooks-panel-head">
            <h2>Catatan Saya</h2>

            <div className="menu-wrap">
              <button
                type="button"
                className="sort-btn"
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((v) => !v)}
              >
                {sortLabel} <ChevronDownIcon />
              </button>
              {sortOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setSortOpen(false)} />
                  <div className="dropdown-menu dropdown-menu--right" role="menu">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sortBy === opt.value}
                        className={sortBy === opt.value ? "is-active" : ""}
                        onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {listError && <ErrorSummary messages={[listError]} />}

          {loadingList ? (
            <p className="empty-state">Memuat catatan...</p>
          ) : visible.length === 0 ? (
            !listError && (
              <p className="empty-state">
                {notebooks.length === 0
                  ? "Belum ada catatan dibuat"
                  : "Tidak ada catatan yang cocok dengan pencarian."}
              </p>
            )
          ) : (
            <table className="notebooks-table">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Sumber</th>
                  <th>Tanggal Dibuat</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((nb) => (
                  // Klik di mana saja pada baris membuka workspace catatan ini.
                  <tr
                    key={nb._id}
                    className="row-clickable"
                    onClick={() => onOpenNotebook(nb)}
                  >
                    <td>
                      {/* Tombol sungguhan supaya bisa dipilih & ditekan lewat keyboard */}
                      <button type="button" className="row-title">{nb.title}</button>
                    </td>
                    {/* TODO: jumlah sumber belum tersedia dari backend */}
                    <td>—</td>
                    <td>{formatDate(nb.createdAt)}</td>
                    {/* stopPropagation: klik menu titik tiga tidak ikut membuka workspace */}
                    <td className="notebooks-table-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="menu-wrap">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Opsi untuk ${nb.title}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === nb._id}
                          disabled={deletingId === nb._id}
                          onClick={() => setOpenMenuId((id) => (id === nb._id ? null : nb._id))}
                        >
                          ⋮
                        </button>
                        {openMenuId === nb._id && (
                          <>
                            <div className="menu-backdrop" onClick={() => setOpenMenuId(null)} />
                            <div className="dropdown-menu dropdown-menu--right" role="menu">
                              {/* Rename & Pin: UI saja, backend belum punya endpoint */}
                              <button type="button" role="menuitem" onClick={() => setOpenMenuId(null)}>
                                <PencilIcon /> Rename
                              </button>
                              <button type="button" role="menuitem" onClick={() => setOpenMenuId(null)}>
                                <PinIcon /> Pin
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                onClick={() => { setOpenMenuId(null); setDeleteTarget(nb); }}
                              >
                                <TrashIcon /> Hapus
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {createOpen && (
        <CreateNotebookDialog
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          message="Apakah Anda yakin ingin menghapus catatan ini? Semua dokumen dan chat di dalamnya akan ikut terhapus."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await handleDelete(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}

/* ---------- Workspace ---------- */

// ----- Sumber (dokumen) -----
const ALLOWED_EXTENSIONS = ["pdf", "pptx", "docx", "txt"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const TOAST_DURATION_MS = 5000;
const POLL_INTERVAL_MS = 2000; // jeda cek status OCR dokumen di backend

const MSG_FORMAT_NOT_SUPPORTED = "Format tidak didukung, hanya PDF, PPTX, DOCX, dan TXT";
const MSG_FILE_TOO_LARGE = "Ukuran file melebihi batas maksimal 20 MB";
const MSG_UPLOAD_FAILED = "Upload gagal, silakan coba lagi";
const MSG_FORBIDDEN = "Anda tidak memiliki akses ke notebook ini";
const MSG_OCR_FAILED = "Gagal membaca dokumen, kualitas gambar terlalu rendah";
const MSG_GENERIC_ERROR = "Terjadi kesalahan, silakan coba lagi.";

const FILE_TYPE_COLORS = {
  pdf: "#e5484d",
  docx: "#3b82f6",
  pptx: "#f59e0b",
  txt: "#9ca3af",
};

function getFileExtension(name) {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

/** Mengembalikan pesan error (string) kalau file tidak boleh diunggah, atau "" kalau lolos. */
function validateUploadFile(file) {
  if (!ALLOWED_EXTENSIONS.includes(getFileExtension(file.name))) return MSG_FORMAT_NOT_SUPPORTED;
  if (file.size > MAX_FILE_SIZE) return MSG_FILE_TOO_LARGE;
  return "";
}

/** Mengubah dokumen dari backend ke bentuk yang dipakai tampilan. */
function normalizeDocument(d) {
  return {
    id: d._id,
    title: d.title,
    type: String(d.fileType || "").toLowerCase(),
    parseStatus: d.parseStatus, // "pending" | "done" | "error"
    parseError: d.parseError || "",
    totalPages: d.totalPages,
  };
}

/** Pesan toast saat upload gagal: 403 -> pesan akses, selain itu (koneksi putus, 500, dll) -> gagal upload. */
function uploadErrorToMessage(err) {
  if (err instanceof ApiError && err.status === 403) return MSG_FORBIDDEN;
  return MSG_UPLOAD_FAILED;
}

/** Pesan untuk error operasi lain (muat daftar, ganti nama, hapus): 403 -> pesan akses, selain itu pesan dari backend. */
function errorToMessage(err) {
  if (err instanceof ApiError && err.status === 403) return MSG_FORBIDDEN;
  return err?.message || MSG_GENERIC_ERROR;
}

// ----- Toast -----

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list, { id, message }]);
  }, []);

  return { toasts, notify, dismiss };
}

function Toast({ toast, onDismiss }) {
  // Hilang sendiri setelah beberapa detik.
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="toast" role="alert">
      {toast.message}
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ----- State daftar sumber (tersambung ke endpoint Documents) -----

function useSources({ notebookId, accessToken, notify }) {
  const [documents, setDocuments] = useState([]); // urutan dari backend: terbaru di atas
  const [uploads, setUploads] = useState([]); // file yang sedang dikirim ke server
  const [uploadError, setUploadError] = useState("");

  // Muat daftar dokumen setiap workspace dibuka.
  useEffect(() => {
    let cancelled = false;
    getDocuments(notebookId, accessToken)
      .then((data) => {
        if (!cancelled) setDocuments((data?.documents || []).map(normalizeDocument));
      })
      .catch((err) => {
        if (!cancelled) notify(errorToMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId, accessToken, notify]);

  // OCR/embedding berjalan di background backend. Selama ada dokumen "pending",
  // cek statusnya berkala sampai selesai ("done") atau gagal ("error").
  const pendingKey = documents
    .filter((d) => d.parseStatus === "pending")
    .map((d) => d.id)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return undefined;
    const ids = pendingKey.split(",");
    let cancelled = false;
    let timer;

    async function check() {
      for (const id of ids) {
        if (cancelled) return;
        try {
          const status = await getDocumentStatus(id, accessToken);
          if (cancelled) return;
          if (status?.parseStatus === "done") {
            setDocuments((list) =>
              list.map((d) =>
                d.id === id ? { ...d, parseStatus: "done", totalPages: status.totalPages } : d
              )
            );
          } else if (status?.parseStatus === "error") {
            setDocuments((list) =>
              list.map((d) =>
                d.id === id ? { ...d, parseStatus: "error", parseError: status.parseError || "" } : d
              )
            );
            notify(MSG_OCR_FAILED);
          }
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            // Dokumen tidak bisa diakses lagi: lepaskan dari daftar supaya pengecekan berhenti.
            setDocuments((list) => list.filter((d) => d.id !== id));
            if (err.status === 403) notify(MSG_FORBIDDEN);
          }
          // Error lain (mis. koneksi putus): coba lagi pada putaran berikutnya.
        }
      }
      if (!cancelled) timer = setTimeout(check, POLL_INTERVAL_MS);
    }

    timer = setTimeout(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingKey, accessToken, notify]);

  async function addFile(file) {
    const message = validateUploadFile(file);
    setUploadError(message);
    if (message) return;

    const uploadId = `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUploads((list) => [
      { id: uploadId, name: file.name, type: getFileExtension(file.name), progress: 0 },
      ...list,
    ]);
    const setProgress = (progress) =>
      setUploads((list) => list.map((u) => (u.id === uploadId ? { ...u, progress } : u)));

    try {
      const data = await uploadDocument(notebookId, file, accessToken, { onProgress: setProgress });
      if (data?.document) {
        // Dokumen baru ditaruh di atas (sama dengan urutan backend). Statusnya "pending"
        // sampai OCR selesai, lalu dicek otomatis oleh efek di atas.
        setDocuments((list) => [normalizeDocument(data.document), ...list]);
      }
    } catch (err) {
      notify(uploadErrorToMessage(err));
    } finally {
      setUploads((list) => list.filter((u) => u.id !== uploadId));
    }
  }

  // Melempar error kalau gagal; popup ganti nama menampilkan pesannya.
  async function renameDocument(id, name) {
    const data = await updateDocumentTitle(id, name, accessToken);
    const title = data?.document?.title ?? name;
    setDocuments((list) => list.map((d) => (d.id === id ? { ...d, title } : d)));
  }

  // Tidak melempar error: kalau gagal, tampil sebagai toast.
  async function removeDocument(id) {
    try {
      await deleteDocument(id, accessToken);
      setDocuments((list) => list.filter((d) => d.id !== id));
    } catch (err) {
      notify(errorToMessage(err));
    }
  }

  return { documents, uploads, uploadError, addFile, renameDocument, removeDocument };
}

// ----- Komponen panel Sumber -----

/** Ikon dokumen: warna dan label mengikuti format file (pdf, pptx, docx, txt). */
function FileIcon({ type }) {
  const color = FILE_TYPE_COLORS[type] || "#9ca3af";
  return (
    <svg className="file-icon" viewBox="0 0 24 28" width="24" height="28" fill="none"
         stroke={color} strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 1.5H15L21 7.5V25a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 5 1.5Z" />
      <path d="M15 1.5V7.5H21" />
      <text x="12" y="20" textAnchor="middle" fontSize={type.length > 3 ? 5.2 : 6.5} fontWeight="600"
            fill={color} stroke="none">
        {type.toUpperCase()}
      </text>
    </svg>
  );
}

function ToggleSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M9 6v12" />
    </svg>
  );
}

function SourcesPanel({
  collapsed,
  onToggle,
  documents,
  uploads,
  uploadError,
  onAddFile,
  onPreview,
  onRename,
  onDelete,
}) {
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const [menu, setMenu] = useState(null); // { id, top, right }

  // Saat ada file baru dikirim, gulung daftar ke atas supaya progress bar-nya terlihat.
  useEffect(() => {
    if (uploads.length > 0 && listRef.current) listRef.current.scrollTop = 0;
  }, [uploads.length]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // supaya file yang sama bisa dipilih lagi
    if (file) onAddFile(file);
  }

  // Menu memakai posisi "fixed" supaya tidak terpotong daftar yang bisa di-scroll.
  function toggleMenu(e, id) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu((current) =>
      current?.id === id ? null : { id, top: rect.bottom + 4, right: window.innerWidth - rect.right }
    );
  }

  const menuDoc = menu ? documents.find((d) => d.id === menu.id) : null;

  function pick(action) {
    const doc = menuDoc;
    setMenu(null);
    if (doc) action(doc);
  }

  return (
    <section className={`panel panel-sources${collapsed ? " is-collapsed" : ""}`} aria-label="Sumber">
      <div className="panel-head">
        {!collapsed && <h2 className="panel-title">Sumber</h2>}
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Perluas panel Sumber" : "Ciutkan panel Sumber"}
          aria-expanded={!collapsed}
        >
          <ToggleSidebarIcon />
        </button>
      </div>

      {!collapsed && (
        <>
          <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()}>
            Tambah Sumber +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt"
            hidden
            onChange={handleFileChange}
          />
          {uploadError && (
            <p className="msg-error" role="alert">
              {uploadError}
            </p>
          )}

          <ul className="source-list" ref={listRef}>
            {/* File yang sedang dikirim ke server: progress bar naik */}
            {uploads.map((u) => (
              <li key={u.id} className="source-item source-item--processing" aria-busy="true">
                <FileIcon type={u.type} />
                <div className="source-processing">
                  <span className="source-title" title={u.name}>{u.name}</span>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={`Mengunggah ${u.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={u.progress}
                  >
                    <div className="progress-bar" style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
              </li>
            ))}

            {documents.map((doc) =>
              doc.parseStatus === "pending" ? (
                // OCR/ekstraksi masih berjalan di backend: animasi loading, belum ada menu
                <li key={doc.id} className="source-item source-item--processing" aria-busy="true">
                  <FileIcon type={doc.type} />
                  <div className="source-processing">
                    <span className="source-title" title={doc.title}>{doc.title}</span>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`Mengekstrak teks ${doc.title}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="progress-bar progress-bar--indeterminate" />
                    </div>
                  </div>
                </li>
              ) : (
                <li key={doc.id} className="source-item">
                  <FileIcon type={doc.type} />
                  <span className="source-title" title={doc.title}>{doc.title}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Opsi untuk ${doc.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === doc.id}
                    onClick={(e) => toggleMenu(e, doc.id)}
                  >
                    ⋮
                  </button>
                </li>
              )
            )}
          </ul>

          {menu && menuDoc && (
            <>
              <div className="menu-backdrop" onClick={() => setMenu(null)} />
              <div
                className="dropdown-menu dropdown-menu--fixed"
                role="menu"
                style={{ top: menu.top, right: menu.right }}
              >
                <button type="button" role="menuitem" onClick={() => pick(onPreview)}>
                  <EyeIcon hidden={false} /> Pratinjau
                </button>
                <button type="button" role="menuitem" onClick={() => pick(onRename)}>
                  <PencilIcon /> Ganti Nama
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => pick(onDelete)}>
                  <TrashIcon /> Hapus
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Popup pratinjau: menampilkan teks hasil ekstraksi / OCR dokumen.
 * TODO: kontrak API belum punya endpoint untuk membaca teks hasil ekstraksi
 * (GET /documents hanya mengembalikan metadata). Sementara tampil pesan kosong.
 * Saat endpoint tersedia, isi doc.extractedText sebelum membuka popup ini.
 */
function PreviewDialog({ doc, onClose }) {
  return (
    <Modal label={`Pratinjau ${doc.title}`} className="modal--preview" onClose={onClose}>
      <div className="modal-form">
        <h2 className="modal-heading">{doc.title}</h2>
        <pre className="preview-text" tabIndex={0}>
          {doc.extractedText || "Teks hasil ekstraksi belum tersedia."}
        </pre>
        <div className="modal-actions">
          <button type="button" className="modal-save" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Popup ganti nama sumber. onRename(id, nama) boleh async dan melempar error kalau gagal. */
function RenameDocumentDialog({ doc, onClose, onRename }) {
  const [title, setTitle] = useState(doc.title);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onRename(doc.id, trimmed);
      onClose();
    } catch (err) {
      const messages = Object.values(mapFieldErrors(err));
      setError(messages.length ? messages.join(" ") : errorToMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal label="Ganti nama sumber" canClose={!saving} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="rename-source-title" className="modal-label">Nama Sumber</label>
        <input
          id="rename-source-title"
          className="input modal-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          onFocus={(e) => e.target.select()}
          placeholder="Nama Sumber"
          aria-invalid={error ? "true" : undefined}
          autoComplete="off"
        />
        <ErrorSummary messages={error ? [error] : []} />
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="modal-save" disabled={saving}>
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ----- Chat AI -----
// Chat dikerjakan di sprint 3 (endpoint backend belum ada), jadi riwayat dan loading
// di bawah ini masih data contoh.

const SAMPLE_MESSAGES = [
  { id: 1, role: "user", text: "Lorem ipsum" },
  {
    id: 2,
    role: "ai",
    text:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec varius non risus id consequat. " +
      "Mauris congue magna a semper sagittis. Maecenas malesuada elit ac diam sollicitudin eleifend. " +
      "Fusce varius a tellus luctus commodo. In pulvinar sagittis feugiat.",
    sources: ["PDF"],
  },
];

// Lebar tiap baris skeleton, diukur dari gambar desain.
const SKELETON_LINE_WIDTHS = ["100%", "75%", "86%", "80%", "94%", "100%"];

// Lama loading simulasi (ms). Hapus bersama fetchChatHistory saat memakai backend.
const CHAT_LOAD_DELAY_MS = 1500;

// Mengambil riwayat chat.
// TODO (sprint 3): ganti dengan request ke backend saat endpoint riwayat chat tersedia.
function fetchChatHistory() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(SAMPLE_MESSAGES), CHAT_LOAD_DELAY_MS);
  });
}

function ChatMessage({ message }) {
  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <p className="bubble">{message.text}</p>
      </div>
    );
  }

  return (
    <div className="msg msg-ai">
      <p>
        {message.text}
        {(message.sources || []).map((src, i) => (
          <span key={`${src}-${i}`} className="source-chip">{src}</span>
        ))}
      </p>
    </div>
  );
}

function WorkspacePage({ notebook, accessToken, onBack, onLogout }) {
  const { toasts, notify, dismiss } = useToasts();
  const { documents, uploads, uploadError, addFile, renameDocument, removeDocument } =
    useSources({ notebookId: notebook._id, accessToken, notify });
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  // Input chat hanya aktif kalau ada minimal 1 dokumen yang sudah selesai diproses.
  const hasDocuments = documents.some((d) => d.parseStatus === "done");

  // Muat riwayat chat setiap workspace dibuka (termasuk setelah di-refresh).
  useEffect(() => {
    let cancelled = false;
    setLoadingChat(true);
    fetchChatHistory()
      .then((history) => {
        if (cancelled) return;
        setMessages(history);
        setLoadingChat(false);
      })
      .catch(() => {
        // TODO: tampilan error belum ada di desain. Sementara skeleton dihentikan.
        if (!cancelled) setLoadingChat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebook._id]);

  // Setiap ada pesan baru (atau loading selesai), gulung otomatis ke bawah.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loadingChat]);

  function handleSend(e) {
    e.preventDefault();
    if (!hasDocuments) return;
    const text = draft.trim();
    if (!text) return;
    setMessages((list) => [...list, { id: Date.now(), role: "user", text }]);
    setDraft("");
    // TODO (sprint 3): kirim ke endpoint chat, lalu tambahkan balasan AI beserta sitasinya.
  }

  // Enter = kirim, Shift+Enter = baris baru.
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      handleSend(e);
    }
  }

  return (
    <div className="workspace-page">
      <AppHeader
        onLogout={onLogout}
        onBrandClick={onBack}
        actions={<button type="button" className="btn-pill">Catatan Baru +</button>}
      />

      <main
        className={`workspace${sourcesCollapsed ? " workspace--sources-collapsed" : ""}`}
        aria-label={`Workspace ${notebook.title}`}
      >
        {/* Panel kiri: Sumber */}
        <SourcesPanel
          collapsed={sourcesCollapsed}
          onToggle={() => setSourcesCollapsed((v) => !v)}
          documents={documents}
          uploads={uploads}
          uploadError={uploadError}
          onAddFile={addFile}
          onPreview={setPreviewDoc}
          onRename={setRenameDoc}
          onDelete={setDeleteDoc}
        />

        {/* Panel tengah: Chat AI */}
        <section className="panel panel-chat">
          <h2 className="panel-title">Chat AI</h2>

          {loadingChat ? (
            <>
              {/* Skeleton loading, sesuai gambar desain */}
              <div className="chat-skeleton" role="status" aria-live="polite" aria-busy="true">
                <p className="chat-skeleton-title">Loading...</p>
                {SKELETON_LINE_WIDTHS.map((width, i) => (
                  <div key={i} className="skeleton skeleton-line" style={{ width }} />
                ))}
              </div>
              <div className="chat-input chat-input--skeleton" aria-hidden="true">
                <span className="chat-input-icon"><MenuIcon /></span>
                <span className="chat-input-icon"><ArrowRightIcon /></span>
              </div>
            </>
          ) : (
            <>
              <div className="chat-messages" role="log">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
                <div ref={endRef} />
              </div>

              <form
                className={`chat-input${hasDocuments ? "" : " is-disabled"}`}
                onSubmit={handleSend}
              >
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!hasDocuments}
                  placeholder="Tulis pesan..."
                  aria-label="Tulis pesan"
                />
                <button
                  type="submit"
                  className="send-btn"
                  aria-label="Kirim pesan"
                  disabled={!hasDocuments || !draft.trim()}
                >
                  <ArrowRightIcon />
                </button>
              </form>
            </>
          )}
        </section>

        {/* Panel kanan: dikosongkan dulu */}
        <section className="panel panel-notes">
          <h2 className="panel-title">Catatan</h2>
        </section>
      </main>

      {previewDoc && <PreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {renameDoc && (
        <RenameDocumentDialog
          doc={renameDoc}
          onClose={() => setRenameDoc(null)}
          onRename={renameDocument}
        />
      )}

      {deleteDoc && (
        <ConfirmDeleteDialog
          message="Apakah Anda yakin ingin menghapus sumber ini?"
          onCancel={() => setDeleteDoc(null)}
          onConfirm={async () => {
            await removeDocument(deleteDoc.id);
            setDeleteDoc(null);
          }}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/* ---------- Root ---------- */

export default function App() {
  const [view, setView] = useState("login");
  const [notice, setNotice] = useState("");
  const [accessToken, setAccessToken] = useState(null);
  const [activeNotebook, setActiveNotebook] = useState(null);

  function handleLoginSuccess(token) {
    setAccessToken(token);
    setView("dashboard");
  }

  function handleLogout() {
    clearRefreshToken();
    setAccessToken(null);
    setActiveNotebook(null);
    setNotice("");
    setView("login");
  }

  function handleOpenNotebook(notebook) {
    setActiveNotebook(notebook);
    setView("workspace");
  }

  function handleBackToDashboard() {
    setActiveNotebook(null);
    setView("dashboard");
  }

  if (view === "workspace" && accessToken && activeNotebook) {
    return (
      <WorkspacePage
        notebook={activeNotebook}
        accessToken={accessToken}
        onBack={handleBackToDashboard}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "dashboard" && accessToken) {
    return (
      <NotebooksPage
        accessToken={accessToken}
        onLogout={handleLogout}
        onOpenNotebook={handleOpenNotebook}
      />
    );
  }

  return (
    <>
      <Header />
      {view === "register" ? (
        <RegisterPage
          goLogin={() => setView("login")}
          onRegistered={() => {
            setNotice("Akun berhasil dibuat. Silakan login.");
            setView("login");
          }}
        />
      ) : (
        <LoginPage
          notice={notice}
          goRegister={() => { setNotice(""); setView("register"); }}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
}