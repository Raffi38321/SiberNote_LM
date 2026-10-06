import { useState } from "react";
import { ApiError, register, login, saveRefreshToken, clearRefreshToken } from "./api";

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

/* ---------- Dashboard (skeleton — data masih statis) ---------- */

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

/** Toggle visual saja — belum mengganti tema sungguhan. */
function ThemeToggle() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className={`toggle${on ? " is-on" : ""}`}
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      aria-label="Ganti tema"
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function AppHeader({ onLogout }) {
  return (
    <header className="topbar app-topbar">
      <div className="topbar-left">
        <div className="logo" aria-hidden="true">Logo</div>
        <span className="brand">SiberNoteLM</span>
      </div>
      <div className="topbar-right">
        <ThemeToggle />
        <button type="button" className="avatar" onClick={onLogout} aria-label="Keluar">
          <PersonIcon />
        </button>
      </div>
    </header>
  );
}

const SAMPLE_NOTEBOOKS = [
  { id: "1", title: "Judul Catatan", sources: 2, createdAt: "18 September 2026" },
];

function NotebooksPage({ onLogout }) {
  const [search, setSearch] = useState("");

  const filtered = SAMPLE_NOTEBOOKS.filter((nb) =>
    nb.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <AppHeader onLogout={onLogout} />
      <main className="dashboard">
        <div className="toolbar">
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
            <button type="button" className="sort-btn">
              Terbaru <ChevronDownIcon />
            </button>
          </div>

          <table className="notebooks-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Sumber</th>
                <th>Dibuat</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((nb) => (
                <tr key={nb.id}>
                  <td>{nb.title}</td>
                  <td>{nb.sources} Sumber</td>
                  <td>{nb.createdAt}</td>
                  <td className="notebooks-table-actions">
                    <button type="button" className="icon-btn" aria-label="Opsi lainnya">⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="empty-state">Belum ada catatan. Buat catatan pertamamu lewat tombol di atas.</p>
          )}
        </section>
      </main>
    </>
  );
}

/* ---------- Root ---------- */

export default function App() {
  const [view, setView] = useState("login");
  const [notice, setNotice] = useState("");
  const [accessToken, setAccessToken] = useState(null);

  function handleLoginSuccess(token) {
    setAccessToken(token);
    setView("dashboard");
  }

  function handleLogout() {
    clearRefreshToken();
    setAccessToken(null);
    setNotice("");
    setView("login");
  }

  if (view === "dashboard" && accessToken) {
    return <NotebooksPage onLogout={handleLogout} />;
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