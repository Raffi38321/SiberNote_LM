import { useState } from "react";
import {
  login,
  register,
  logoutApi,
  saveSession,
  clearSession,
  getAccessToken,
  getRefreshToken,
  isLoggedIn,
} from "./api";

// ─── validasi ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// sesuai aturan backend: hanya huruf dan angka, 8–16 karakter
const PASSWORD_HINT = "Password 8–16 karakter, hanya huruf dan angka (a-z, A-Z, 0-9).";

function isValidPassword(pw) {
  return pw.length >= 8 && pw.length <= 16 && /^[a-zA-Z0-9]+$/.test(pw);
}

// sesuai aturan backend: hanya huruf, angka, underscore, strip — max 16
const USERNAME_HINT = "Username 1–16 karakter, hanya huruf, angka, _ dan -.";

function isValidUsername(u) {
  return u.length >= 1 && u.length <= 16 && /^[a-zA-Z0-9_-]+$/.test(u);
}

// ─── shared UI components ─────────────────────────────────────────────────────

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

function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
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

// ─── LoginPage ────────────────────────────────────────────────────────────────

function LoginPage({ onSuccess, goRegister, notice }) {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();

    // validasi client-side
    const next = {};
    if (!form.email.trim())           next.email    = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";
    if (!form.password)               next.password = "Password wajib diisi.";
    setErrors(next);
    setApiError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      // backend return: { status, message, data: { accessToken, refreshToken } }
      const res = await login({ email: form.email.trim(), password: form.password });
      saveSession(res.data);
      onSuccess();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} noValidate>
        {notice && <p className="msg-success" role="status">{notice}</p>}

        <Field id="email" label="Email" error={errors.email}>
          <TextInput id="email" name="email" type="email" autoComplete="email"
            placeholder="Masukkan email" value={form.email} onChange={update} error={errors.email} />
        </Field>

        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput id="password" name="password" autoComplete="current-password"
            placeholder="Masukkan password" value={form.password} onChange={update} error={errors.password} />
        </Field>

        {apiError && <p className="msg-error banner" role="alert">{apiError}</p>}

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

// ─── RegisterPage ─────────────────────────────────────────────────────────────

function RegisterPage({ onSuccess, goLogin }) {
  const [form, setForm]         = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading]   = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();

    // validasi client-side — cerminkan aturan backend
    const next = {};
    const uname = form.username.trim();
    if (!uname)                  next.username = "Username wajib diisi.";
    else if (!isValidUsername(uname)) next.username = USERNAME_HINT;

    if (!form.email.trim())           next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";

    if (!form.password)               next.password = "Password wajib diisi.";
    else if (!isValidPassword(form.password)) next.password = PASSWORD_HINT;
    else if (form.password.toLowerCase().includes(uname.toLowerCase())) {
      next.password = "Password tidak boleh mengandung username.";
    }

    if (!form.confirm)                next.confirm = "Konfirmasi password wajib diisi.";
    else if (form.confirm !== form.password) next.confirm = "Konfirmasi password tidak sama.";

    setErrors(next);
    setApiError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      // backend return: { status, message, data: { accessToken, refreshToken } }
      const res = await register({
        username: uname,
        email:    form.email.trim(),
        password: form.password,
      });
      saveSession(res.data);
      onSuccess();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Field id="username" label="Username" error={errors.username}>
          <TextInput id="username" name="username" autoComplete="username"
            placeholder="Masukkan username" value={form.username} onChange={update} error={errors.username} />
        </Field>

        <Field id="reg-email" label="Email" error={errors.email}>
          <TextInput id="reg-email" name="email" type="email" autoComplete="email"
            placeholder="Masukkan email" value={form.email} onChange={update} error={errors.email} />
        </Field>

        <div className="field">
          <label htmlFor="reg-password">Password</label>
          <PasswordInput id="reg-password" name="password" autoComplete="new-password"
            placeholder="Masukkan password" value={form.password} onChange={update}
            error={errors.password ? " " : ""} describedBy="password-hint" />
          <p className="hint" id="password-hint">{PASSWORD_HINT}</p>
          {errors.password && (
            <p className="msg-error" id="reg-password-error" role="alert">{errors.password}</p>
          )}
        </div>

        <Field id="confirm" label="Konfirmasi password" error={errors.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password"
            placeholder="Konfirmasi password" value={form.confirm} onChange={update} error={errors.confirm} />
        </Field>

        {apiError && <p className="msg-error banner" role="alert">{apiError}</p>}

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

// ─── HomePlaceholder ──────────────────────────────────────────────────────────

function HomePlaceholder({ onLogout }) {
  return (
    <main className="auth">
      <h1>Selamat datang!</h1>
      <p className="switch">Halaman notebook akan ditampilkan di sini.</p>
      <button className="btn" type="button" onClick={onLogout}>Keluar</button>
    </main>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]     = useState(isLoggedIn() ? "home" : "login");
  const [notice, setNotice] = useState("");

  async function handleLogout() {
    const rt = getRefreshToken();
    if (rt) {
      try { await logoutApi(rt); } catch { /* ignore — bersihkan session tetap */ }
    }
    clearSession();
    setView("login");
  }

  return (
    <>
      <Header />

      {view === "login" && (
        <LoginPage
          notice={notice}
          goRegister={() => { setNotice(""); setView("register"); }}
          onSuccess={() => setView("home")}
        />
      )}

      {view === "register" && (
        <RegisterPage
          goLogin={() => setView("login")}
          onSuccess={() => setView("home")}
        />
      )}

      {view === "home" && (
        <HomePlaceholder onLogout={handleLogout} />
      )}
    </>
  );
}
