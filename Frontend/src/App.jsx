import { useState } from "react";
import {
  login,
  register,
  saveSession,
  clearSession,
  getToken,
  getSavedUser,
} from "./api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_HINT =
  "Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, angka, dan simbol.";

function isStrongPassword(pw) {
  return (
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}



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

/* ---------- Halaman Login ---------- */

function LoginPage({ onSuccess, goRegister, notice }) {
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
      saveSession(data);
      onSuccess(data?.user || null);
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



function RegisterPage({ onSuccess, goLogin }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.username.trim()) next.username = "Username wajib diisi.";
    else if (form.username.trim().length < 3) next.username = "Username minimal 3 karakter.";
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";
    if (!isStrongPassword(form.password)) next.password = PASSWORD_HINT;
    if (!form.confirm) next.confirm = "Konfirmasi password wajib diisi.";
    else if (form.confirm !== form.password) next.confirm = "Konfirmasi password tidak sama.";
    setErrors(next);
    setApiError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const data = await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      onSuccess(data);
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
          <p className="msg-error" id="password-hint">{PASSWORD_HINT}</p>
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



function HomePlaceholder({ user, onLogout }) {
  return (
    <main className="auth">
      <h1>Selamat datang{user?.username ? `, ${user.username}` : ""}</h1>
      <p className="switch">Halaman notebook akan ditampilkan di sini.</p>
      <button className="btn" type="button" onClick={onLogout}>Keluar</button>
    </main>
  );
}


export default function App() {
  const [view, setView] = useState(getToken() ? "home" : "login");
  const [user, setUser] = useState(getSavedUser());
  const [notice, setNotice] = useState("");

  function handleLogout() {
    clearSession();
    setUser(null);
    setView("login");
  }

  return (
    <>
      <Header />
      {view === "login" && (
        <LoginPage
          notice={notice}
          goRegister={() => { setNotice(""); setView("register"); }}
          onSuccess={(u) => { setUser(u); setView("home"); }}
        />
      )}
      {view === "register" && (
        <RegisterPage
          goLogin={() => setView("login")}
          onSuccess={(data) => {
            // Jika backend langsung mengirim token setelah register, langsung masuk.
            if (data?.token) {
              saveSession(data);
              setUser(data.user || null);
              setView("home");
            } else {
              setNotice("Akun berhasil dibuat. Silakan login.");
              setView("login");
            }
          }}
        />
      )}
      {view === "home" && <HomePlaceholder user={user} onLogout={handleLogout} />}
    </>
  );
}
