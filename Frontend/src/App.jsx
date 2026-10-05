import { useState } from "react";
import { registerUser, ApiError } from "./api";

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

/* ---------- Halaman Login (masih statis — belum terhubung ke API) ---------- */

function LoginPage({ goRegister, notice }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.email.trim()) next.email = "Email wajib diisi.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Format email tidak valid.";
    if (!form.password) next.password = "Password wajib diisi.";
    setErrors(next);
    // TODO: hubungkan ke POST /user/login saat Login mulai diintegrasikan.
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

        <button className="btn" type="submit">Login</button>
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
      // Hasil register (accessToken/refreshToken) sengaja tidak dipakai dulu
      // karena Login belum terintegrasi — user diarahkan login manual.
      await registerUser({
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

  return (
    <main className="auth">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Field id="username" label="Username" error={errors.username}>
          <TextInput id="username" name="username" autoComplete="username"
            placeholder="Masukkan username" value={form.username} onChange={update} onBlur={handleBlur}
            error={errors.username} />
        </Field>

        <Field id="reg-email" label="Email" error={errors.email}>
          <TextInput id="reg-email" name="email" type="email" autoComplete="email"
            placeholder="Masukkan email" value={form.email} onChange={update} onBlur={handleBlur}
            error={errors.email} />
        </Field>

        <Field id="reg-password" label="Password" error={errors.password}>
          <PasswordInput id="reg-password" name="password" autoComplete="new-password"
            placeholder="Masukkan password" value={form.password} onChange={update} onBlur={handleBlur}
            error={errors.password} />
        </Field>

        <Field id="confirm" label="Konfirmasi password" error={errors.confirm}>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password"
            placeholder="Konfirmasi password" value={form.confirm} onChange={update} onBlur={handleBlur}
            error={errors.confirm} />
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

/* ---------- Root ---------- */

export default function App() {
  const [view, setView] = useState("login");
  const [notice, setNotice] = useState("");

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
        />
      )}
    </>
  );
}
