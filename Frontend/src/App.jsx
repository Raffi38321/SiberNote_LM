import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  register,
  login,
  getNotebooks,
  deleteNotebook,
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

/* ---------- Section Chat AI ---------- */

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function MenuOptionsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
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

function NotebooksPage({ accessToken, onLogout, onOpenNotebook }) {
  const [notebooks, setNotebooks] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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

  async function handleDelete(notebook) {
    const confirmed = window.confirm(
      `Hapus "${notebook.title}"? Semua dokumen di dalamnya juga akan terhapus permanen.`
    );
    if (!confirmed) return;

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
          {/* Catatan Baru: sementara belum melakukan apa-apa */}
          <button type="button" className="btn-pill">Catatan Baru +</button>
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
                                onClick={() => { setOpenMenuId(null); handleDelete(nb); }}
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
    </>
  );
}

/* ---------- Workspace (panel tengah: Chat AI) ---------- */

// Isi minimal 1 item untuk mengaktifkan input; kosongkan ([]) untuk menonaktifkannya.
const SAMPLE_DOCUMENTS = [{ id: "d1", title: "Judul Sumber" }];

// Data contoh untuk tampilan. Ganti dengan riwayat chat dari backend.
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

function WorkspacePage({ notebook, onBack, onLogout }) {
  const [messages, setMessages] = useState(SAMPLE_MESSAGES);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const [documents] = useState(SAMPLE_DOCUMENTS);
  const hasDocuments = documents.length > 0;

  // Setiap ada pesan baru, gulung otomatis ke bawah.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!hasDocuments) return;
    const text = draft.trim();
    if (!text) return;
    setMessages((list) => [...list, { id: Date.now(), role: "user", text }]);
    setDraft("");
    // TODO: kirim ke endpoint chat, lalu tambahkan balasan AI beserta label sumbernya.
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

      <main className="workspace" aria-label={`Workspace ${notebook.title}`}>
        {/* Panel kiri: dikosongkan dulu */}
        <section className="panel panel-sources">
          <h2 className="panel-title"></h2>
        </section>

        {/* Panel tengah: Chat AI */}
        <section className="panel panel-chat">
          <h2 className="panel-title">Chat AI</h2>

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
            <button
              type="button"
              className="chat-menu-btn"
              aria-label="Opsi menu chat"
              // onClick={() => {masukkan logika dropdown}}
            >
              <MenuOptionsIcon />
            </button>
            
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
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
        </section>

        {/* Panel kanan: dikosongkan dulu */}
        <section className="panel panel-notes">
          <h2 className="panel-title"></h2>
        </section>
      </main>
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
