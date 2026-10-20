import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  register,
  login,
  createNotebook,
  getNotebooks,
  deleteNotebook,
  updateNotebook,
  togglePinNotebook,
  logout,
  getDocuments,
  uploadDocument,
  updateDocumentTitle,
  deleteDocument,
  getDocumentStatus,
  saveRefreshToken,
  getCurrentUser,
  updateProfile,
} from "./api";
import { NotesPanel, useNotes } from "./NotesPanel";

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

function LogoIcon({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 63 63"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo"
      aria-hidden="true"
    >
      <circle cx="31.5" cy="31.5" r="31.5" fill="#CECECE" />
      <path
        d="M55.4032 25.0931C55.0683 24.6941 53.8076 23.1779 53.8076 23.1779L41.0449 7.97604C41.0449 7.97604 40.8084 7.68677 40.6902 7.55709C40.5768 7.4327 40.4342 7.2778 40.3357 7.198C40.2669 7.14227 40.1829 7.10649 40.0993 7.07831C40.0107 7.04836 39.9039 7.0269 39.8039 7.01845C39.6857 7.00846 39.5235 6.98247 39.3903 7.01845C39.0948 7.09824 38.0312 7.49726 38.0312 7.49726L35.4905 8.45486L33.0087 9.35259L30.5861 10.2503L27.8681 11.2678L10.7326 17.552L9.49176 18.0308C9.49176 18.0308 8.80281 18.2901 8.60545 18.3899C8.49264 18.447 8.38879 18.5495 8.31001 18.6293C8.24036 18.6998 8.17679 18.7795 8.13273 18.8687C8.08349 18.9685 8.03427 19.1081 8.01456 19.2278C7.99515 19.3458 7.99515 19.4688 8.01456 19.5869C8.03427 19.7066 8.08349 19.8363 8.13273 19.946C8.18027 20.0519 8.24604 20.1486 8.31001 20.2452C8.89104 21.123 11.6189 25.2128 11.6189 25.2128L20.6003 38.5593L20.8957 38.9782C20.8957 38.9782 21.142 39.3373 21.2503 39.457C21.3355 39.5512 21.4367 39.632 21.5457 39.6964C21.6639 39.7662 21.8214 39.846 21.9593 39.876C22.0941 39.9052 22.2449 39.8959 22.3729 39.876C22.496 39.8568 22.7275 39.7563 22.7275 39.7563L33.5996 35.6266L52.8624 28.2651L54.2803 27.7265C54.2803 27.7265 54.6152 27.5968 54.7531 27.5469C54.8703 27.5045 55.0439 27.4494 55.1075 27.4272C55.1171 27.4239 55.1349 27.414 55.1349 27.414C55.1349 27.414 55.2868 27.3398 55.3441 27.3075C55.4327 27.2576 55.5606 27.1978 55.6394 27.128C55.7136 27.0623 55.769 26.9758 55.8168 26.8886C55.866 26.7988 55.9053 26.6891 55.9348 26.5893C55.9636 26.4919 55.9939 26.3918 55.9939 26.2901C55.9939 26.2749 55.9935 26.2588 55.9925 26.2419C55.9864 26.1258 55.9605 25.9757 55.9348 25.8711C55.9091 25.7669 55.8772 25.6602 55.8168 25.5719C55.7282 25.4422 55.5388 25.2546 55.4032 25.0931Z"
        fill="#007FAD"
      />
      <path
        d="M53.3943 31.1976C53.3943 31.1976 53.0693 30.7986 52.9807 30.7188C52.9513 30.6923 52.8998 30.7053 52.8628 30.7188C52.3408 30.9083 49.8492 31.8559 49.8492 31.8559L46.8356 32.9931L43.1133 34.4295L40.5724 35.3871L37.4407 36.5841L34.0727 37.8409L30.4684 39.2175L26.864 40.5939L23.9096 41.7313C23.9096 41.7313 23.2203 42.0106 23.0233 42.0903C22.9249 42.1302 22.8302 42.1816 22.7279 42.2098C22.6195 42.2397 22.5037 42.272 22.3855 42.292C22.2674 42.312 22.137 42.3396 22.0188 42.3296C21.9006 42.3196 21.753 42.272 21.6545 42.2321C21.5727 42.199 21.4902 42.1534 21.4279 42.0903C21.3294 41.9906 21.0734 41.6115 21.0734 41.6115L20.7189 41.0728L19.7735 39.6962L14.6919 32.0953L11.0875 26.7687L10.6148 26.1104C10.6148 26.1104 10.4962 26.149 10.4376 26.1702C10.2997 26.2201 9.78761 26.4096 9.78761 26.4096L9.13765 26.649C9.13765 26.649 8.80281 26.7488 8.66493 26.8286C8.53138 26.9059 8.40887 27.0181 8.31041 27.1278C8.21487 27.2343 8.11641 27.3496 8.07407 27.4869C8.02482 27.6465 7.99525 27.9058 8.01496 28.0854C8.03356 28.2548 8.12328 28.4245 8.19224 28.5642C8.25574 28.6929 8.42858 28.9233 8.42858 28.9233L11.6193 33.7113L20.0098 46.1601L20.9552 47.5963C20.9552 47.5963 21.1719 47.8659 21.2507 47.9557C21.3062 48.0189 21.3584 48.0881 21.4279 48.135C21.5165 48.1948 21.6643 48.2748 21.7825 48.3147C21.8961 48.3531 22.0188 48.3746 22.137 48.3746C22.2551 48.3746 22.3763 48.3481 22.4915 48.3147C22.6294 48.2748 22.9642 48.135 22.9642 48.135L25.2095 47.2971L33.0682 44.3046L37.4998 42.6288L39.0361 42.0304L42.3449 40.7736L44.7675 39.8758L47.4266 38.8584L49.79 37.9606L52.1538 37.0629L53.69 36.4644L54.3398 36.225C54.3398 36.225 54.8127 36.0554 54.99 35.9856C55.1298 35.9305 55.2854 35.8758 55.4036 35.806C55.5125 35.7417 55.6191 35.6655 55.699 35.5666C55.7876 35.4569 55.8904 35.302 55.9352 35.1477C55.9844 34.9781 56.014 34.7287 55.9943 34.5492C55.9758 34.3798 55.9038 34.2165 55.8172 34.0704C55.7286 33.9208 55.4624 33.6514 55.4624 33.6514L54.9309 32.9931L54.2216 32.1552L53.3943 31.1976Z"
        fill="#005FAD"
      />
      <path
        d="M53.3943 39.8231C53.3943 39.8231 53.0693 39.4241 52.9807 39.3443C52.9513 39.3178 52.8998 39.3308 52.8628 39.3443C52.3408 39.5338 49.8492 40.4814 49.8492 40.4814L46.8356 41.6186L43.1133 43.055L40.5724 44.0126L37.4407 45.2095L34.0727 46.4664L30.4684 47.8429L26.864 49.2194L23.9096 50.3568C23.9096 50.3568 23.2203 50.6361 23.0233 50.7158C22.9249 50.7557 22.8302 50.8071 22.7279 50.8353C22.6195 50.8652 22.5037 50.8975 22.3855 50.9175C22.2674 50.9375 22.137 50.9651 22.0188 50.9551C21.9006 50.9451 21.753 50.8975 21.6545 50.8576C21.5727 50.8245 21.4902 50.7789 21.4279 50.7158C21.3294 50.6161 21.0734 50.237 21.0734 50.237L20.7189 49.6982L19.7735 48.3217L14.6919 40.7208L11.0875 35.3942L10.6148 34.7358C10.6148 34.7358 10.4962 34.7745 10.4376 34.7957C10.2997 34.8456 9.78761 35.0351 9.78761 35.0351L9.13765 35.2745C9.13765 35.2745 8.80281 35.3742 8.66493 35.454C8.53138 35.5313 8.40887 35.6436 8.31041 35.7533C8.21487 35.8598 8.11641 35.9751 8.07407 36.1124C8.02482 36.272 7.99525 36.5313 8.01496 36.7109C8.03356 36.8803 8.12328 37.05 8.19224 37.1897C8.25574 37.3184 8.42858 37.5488 8.42858 37.5488L11.6193 42.3368L20.0098 54.7855L20.9552 56.2218C20.9552 56.2218 21.1719 56.4914 21.2507 56.5811C21.3062 56.6444 21.3584 56.7136 21.4279 56.7605C21.5165 56.8203 21.6643 56.9003 21.7825 56.9402C21.8961 56.9786 22.0188 57.0001 22.137 57.0001C22.2551 57.0001 22.3763 56.9736 22.4915 56.9402C22.6294 56.9003 22.9642 56.7605 22.9642 56.7605L25.2095 55.9226L33.0682 52.9301L37.4998 51.2542L39.0361 50.6559L42.3449 49.3991L44.7675 48.5013L47.4266 47.4839L49.79 46.5861L52.1538 45.6884L53.69 45.0898L54.3398 44.8505C54.3398 44.8505 54.8127 44.6809 54.99 44.6111C55.1298 44.556 55.2854 44.5013 55.4036 44.4315C55.5125 44.3671 55.6191 44.291 55.699 44.1921C55.7876 44.0824 55.8904 43.9275 55.9352 43.7732C55.9844 43.6036 56.014 43.3542 55.9943 43.1747C55.9758 43.0053 55.9038 42.842 55.8172 42.6959C55.7286 42.5463 55.4624 42.2769 55.4624 42.2769L54.9309 41.6186L54.2216 40.7807L53.3943 39.8231Z"
        fill="#003FAD"
      />
    </svg>
  );
}

function Header() {
  return (
    <header className="topbar">
      <LogoIcon size={32} />
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

function PersonIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

/** Foto profil bulat. Kalau tidak ada foto (atau gagal dimuat), tampil ikon orang. */
function Avatar({ src, size = 32 }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        className="avatar-img"
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    );
  }
  return <PersonIcon size={Math.round(size * 0.56)} />;
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
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="stroke0_565_1005" maskUnits="userSpaceOnUse" x="3" y="5" width="16" height="16" fill="black">
<rect fill="white" x="3" y="5" width="16" height="16"/>
<path d="M13.5858 7.41421L6.39171 14.6083C6.19706 14.8029 6.09974 14.9003 6.03276 15.0186C5.96579 15.1368 5.93241 15.2704 5.86564 15.5374L5.20211 18.1915C5.11186 18.5526 5.06673 18.7331 5.16682 18.8332C5.2669 18.9333 5.44742 18.8881 5.80844 18.7979L5.80845 18.7979L8.46257 18.1344C8.72963 18.0676 8.86316 18.0342 8.98145 17.9672C9.09974 17.9003 9.19706 17.8029 9.39171 17.6083L16.5858 10.4142L16.5858 10.4142C17.2525 9.74755 17.5858 9.41421 17.5858 9C17.5858 8.58579 17.2525 8.25245 16.5858 7.58579L16.4142 7.41421C15.7475 6.74755 15.4142 6.41421 15 6.41421C14.5858 6.41421 14.2525 6.74755 13.5858 7.41421Z"/>
</mask>
<path d="M6.39171 14.6083L13.5858 7.41421C14.2525 6.74755 14.5858 6.41421 15 6.41421C15.4142 6.41421 15.7475 6.74755 16.4142 7.41421L16.5858 7.58579C17.2525 8.25245 17.5858 8.58579 17.5858 9C17.5858 9.41421 17.2525 9.74755 16.5858 10.4142L16.5858 10.4142L9.39171 17.6083C9.19706 17.8029 9.09974 17.9003 8.98145 17.9672C8.86316 18.0342 8.72963 18.0676 8.46257 18.1344L5.80845 18.7979L5.80844 18.7979C5.44742 18.8881 5.2669 18.9333 5.16682 18.8332C5.06673 18.7331 5.11186 18.5526 5.20211 18.1915L5.86564 15.5374C5.93241 15.2704 5.96579 15.1368 6.03276 15.0186C6.09974 14.9003 6.19706 14.8029 6.39171 14.6083Z" strokeWidth="2.4" stroke="#CECECE" mask="url(#stroke0_565_1005)"/>
<path d="M12.5 7.5L16.5 11.5" stroke="#CECECE"/>
</svg>
  );
}

function PinIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14.7455 18.1315C14.7322 18.1223 14.7255 18.1177 14.7189 18.1131C11.2692 15.7225 8.27754 12.7308 5.88691 9.28108C5.88233 9.27448 5.87772 9.26782 5.86851 9.25451C5.86655 9.25169 5.86558 9.25028 5.86486 9.24924C5.45815 8.65858 5.78704 7.84444 6.4899 7.70202C6.49113 7.70177 6.49282 7.70144 6.49618 7.70076L7.45114 7.50977C8.44433 7.31113 8.94092 7.21182 9.4175 7.05236C9.77083 6.93415 10.1155 6.79139 10.4489 6.62514C10.8987 6.40089 11.32 6.11998 12.1628 5.55815L14.6358 3.90949C15.2888 3.47412 15.6153 3.25643 15.9711 3.29166C16.3269 3.32689 16.6044 3.60439 17.1594 4.15938L19.8406 6.84062C20.3956 7.39561 20.6731 7.67311 20.7083 8.02888C20.7436 8.38465 20.5259 8.71118 20.0905 9.36424L18.4419 11.8372C17.88 12.68 17.5991 13.1013 17.3749 13.5511C17.2086 13.8845 17.0659 14.2292 16.9476 14.5825C16.7882 15.0591 16.6889 15.5557 16.4902 16.5489L16.2992 17.5038C16.2986 17.5072 16.2982 17.5089 16.298 17.5101C16.1556 18.213 15.3414 18.5419 14.7508 18.1351C14.7497 18.1344 14.7483 18.1334 14.7455 18.1315Z" stroke="#CECECE"/>
<path d="M5 19L9.5 14.5" strokeLinecap="round" stroke="#CECECE"/>
</svg>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2.5 4.99984H4.16667M4.16667 4.99984H17.5M4.16667 4.99984V16.6665C4.16667 17.1085 4.34226 17.5325 4.65482 17.845C4.96738 18.1576 5.39131 18.3332 5.83333 18.3332H14.1667C14.6087 18.3332 15.0326 18.1576 15.3452 17.845C15.6577 17.5325 15.8333 17.1085 15.8333 16.6665V4.99984M6.66667 4.99984V3.33317C6.66667 2.89114 6.84226 2.46722 7.15482 2.15466C7.46738 1.8421 7.89131 1.6665 8.33333 1.6665H11.6667C12.1087 1.6665 12.5326 1.8421 12.8452 2.15466C13.1577 2.46722 13.3333 2.89114 13.3333 3.33317V4.99984M8.33333 9.1665V14.1665M11.6667 9.1665V14.1665" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="#FF0000"/>
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

/** Tampilan kolom Sumber: undefined = masih dimuat, null = gagal dimuat, angka = jumlah sumber. */
function formatSourceCount(count) {
  if (count === undefined) return "…";
  if (count === null) return "—";
  return count;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "az", label: "A-Z" },
];

function AppHeader({ onLogout, onBrandClick, onEditProfile, profile, actions }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const brand = (
    <>
      <LogoIcon size={32} />
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
            <Avatar src={profile?.avatarUrl} size={32} />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="dropdown-menu dropdown-menu--right" role="menu">
                {profile && (
                  <div className="dropdown-account">
                    <span className="dropdown-account-name">{profile.username}</span>
                    <span className="dropdown-account-email">{profile.email}</span>
                  </div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onEditProfile(); }}
                >
                  Edit Profil
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Modal({ label, className = "", canClose = true, onClose, children }) {
  const dialogRef = useRef(null);

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
        e.preventDefault();
        if (canClose) onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current && canClose) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

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
            setError("");
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

function RenameNotebookDialog({ notebook, onClose, onRename }) {
  const [title, setTitle] = useState(notebook.title);
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
    if (trimmed === notebook.title) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onRename(notebook, trimmed);
      onClose();
    } catch (err) {
      const messages = Object.values(mapFieldErrors(err));
      setError(messages.length ? messages.join(" ") : err.message);
      setSaving(false);
    }
  }

  return (
    <Modal label="Ganti nama catatan" canClose={!saving} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="rename-notebook-title" className="modal-label">Judul Catatan</label>
        <input
          id="rename-notebook-title"
          className="input modal-input"
          value={title}
          maxLength={100}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          onFocus={(e) => e.target.select()}
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
            Yakin
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NotebooksPage({ accessToken, profile, onLogout, onEditProfile, onOpenNotebook }) {
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
  const [renameTarget, setRenameTarget] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const [sourceCounts, setSourceCounts] = useState({});

  async function loadSourceCounts(list) {
    const results = await Promise.allSettled(list.map((nb) => getDocuments(nb._id, accessToken)));
    const counts = {};
    list.forEach((nb, i) => {
      const r = results[i];
      counts[nb._id] = r.status === "fulfilled" ? (r.value?.documents?.length ?? 0) : null;
    });
    setSourceCounts((prev) => ({ ...prev, ...counts }));
  }

  async function loadNotebooks() {
    setLoadingList(true);
    setListError("");
    try {
      const data = await getNotebooks(accessToken);
      const list = data?.notebooks || [];
      setNotebooks(list);
      loadSourceCounts(list);
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
    const data = await createNotebook({ title, description: title }, accessToken);
    if (data?.notebook) {
      onOpenNotebook(data.notebook);
    } else {
      await loadNotebooks();
    }
  }

  async function handleTogglePin(notebook) {
    const pinned = !notebook.isPinned;
    setPinningId(notebook._id);
    setListError("");
    try {
      const data = await togglePinNotebook(notebook._id, pinned, accessToken);
      const updated = data?.notebook ?? { isPinned: pinned };
      setNotebooks((list) => list.map((nb) => (nb._id === notebook._id ? { ...nb, ...updated } : nb)));
    } catch (err) {
      setListError(err.message);
    } finally {
      setPinningId(null);
    }
  }

  async function handleRename(notebook, title) {
    const data = await updateNotebook(notebook._id, { title }, accessToken);
    const updated = data?.notebook ?? { title };
    setNotebooks((list) => list.map((nb) => (nb._id === notebook._id ? { ...nb, ...updated } : nb)));
  }

  const visible = notebooks
    .filter((nb) => nb.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDiff) return pinDiff;
      return sortBy === "az"
        ? a.title.localeCompare(b.title, "id")
        : new Date(b.createdAt) - new Date(a.createdAt);
    });

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy).label;

  return (
    <>
      <AppHeader onLogout={onLogout} onEditProfile={onEditProfile} profile={profile} />
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
                  <tr
                    key={nb._id}
                    className="row-clickable"
                    onClick={() => onOpenNotebook(nb)}
                  >
                    <td>
                      <button type="button" className="row-title">
                        {nb.title}
                      </button>
                    </td>
                    <td>{formatSourceCount(sourceCounts[nb._id])}</td>
                    <td>{formatDate(nb.createdAt)}</td>
                    <td className="notebooks-table-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                      {nb.isPinned && (
                        <span className="row-pin" role="img" aria-label="Disematkan" title="Disematkan">
                          <PinIcon />
                        </span>
                      )}
                      <div className="menu-wrap">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Opsi untuk ${nb.title}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === nb._id}
                          disabled={deletingId === nb._id || pinningId === nb._id}
                          onClick={() => setOpenMenuId((id) => (id === nb._id ? null : nb._id))}
                        >
                          ⋮
                        </button>
                        {openMenuId === nb._id && (
                          <>
                            <div className="menu-backdrop" onClick={() => setOpenMenuId(null)} />
                            <div className="dropdown-menu dropdown-menu--right" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setOpenMenuId(null); setRenameTarget(nb); }}
                              >
                                <PencilIcon /> Ganti Judul
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => { setOpenMenuId(null); handleTogglePin(nb); }}
                              >
                                <PinIcon /> {nb.isPinned ? "Batal sematkan" : "Sematkan"}
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

      {renameTarget && (
        <RenameNotebookDialog
          notebook={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
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

const ALLOWED_EXTENSIONS = ["pdf", "pptx", "docx", "txt"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const TOAST_DURATION_MS = 5000;
const POLL_INTERVAL_MS = 2000;

const MSG_FORMAT_NOT_SUPPORTED = "Format tidak didukung, hanya PDF, PPTX, DOCX, dan TXT";
const MSG_FILE_TOO_LARGE = "Ukuran file melebihi batas maksimal 20 MB";
const MSG_UPLOAD_FAILED = "Upload gagal, silakan coba lagi";
const MSG_FORBIDDEN = "Anda tidak memiliki akses ke notebook ini";
const MSG_OCR_FAILED = "Gagal membaca dokumen, kualitas gambar terlalu rendah";
const MSG_GENERIC_ERROR = "Terjadi kesalahan, silakan coba lagi.";
const MSG_PARSE_FAILED = "Dokumen gagal diproses di server";

// Pesan toast disesuaikan dengan penyebab sebenarnya dari server (parseError),
// bukan selalu "kualitas gambar terlalu rendah".
function parseErrorToMessage(parseError) {
  const text = String(parseError || "").trim();
  if (!text) return MSG_PARSE_FAILED;
  if (/tidak ada konten/i.test(text)) return MSG_OCR_FAILED;
  return `${MSG_PARSE_FAILED}: ${text}`;
}

function getFileExtension(name) {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

function validateUploadFile(file) {
  if (!ALLOWED_EXTENSIONS.includes(getFileExtension(file.name))) return MSG_FORMAT_NOT_SUPPORTED;
  if (file.size > MAX_FILE_SIZE) return MSG_FILE_TOO_LARGE;
  return "";
}

function normalizeDocument(d) {
  return {
    id: d._id,
    title: d.title,
    type: String(d.fileType || "").toLowerCase(),
    parseStatus: d.parseStatus,
    parseError: d.parseError || "",
    totalPages: d.totalPages,
  };
}

function uploadErrorToMessage(err) {
  if (err instanceof ApiError && err.status === 403) return MSG_FORBIDDEN;
  return MSG_UPLOAD_FAILED;
}

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

  const notify = useCallback((message, type = "error") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list, { id, message, type }]);
  }, []);

  return { toasts, notify, dismiss };
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className={`toast${isSuccess ? " toast--success" : ""}`}
      role={isSuccess ? "status" : "alert"}
    >
      {toast.type !== "success" && <span className="toast-icon" aria-hidden="true">⚠️</span>}
      <span>{toast.message}</span>
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

// ----- State daftar sumber -----

function useSources({ notebookId, accessToken, notify }) {
  const [documents, setDocuments] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [uploadError, setUploadError] = useState("");

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
            console.error("[parse dokumen gagal]", id, status.parseError);
            notify(parseErrorToMessage(status.parseError));
          }
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            setDocuments((list) => list.filter((d) => d.id !== id));
            if (err.status === 403) notify(MSG_FORBIDDEN);
          }
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
        setDocuments((list) => [normalizeDocument(data.document), ...list]);
      }
    } catch (err) {
      notify(uploadErrorToMessage(err));
    } finally {
      setUploads((list) => list.filter((u) => u.id !== uploadId));
    }
  }

  async function renameDocument(id, name) {
    const data = await updateDocumentTitle(id, name, accessToken);
    const title = data?.document?.title ?? name;
    setDocuments((list) => list.map((d) => (d.id === id ? { ...d, title } : d)));
  }

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

function FileIcon({ type = "" }) {
  const fileType = String(type).toLowerCase();

  switch (fileType) {
    case "pdf":
      return (
        <svg
          className="file-icon"
          viewBox="0 0 100 100"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 30V90H70"
            stroke="#E53935"
            strokeWidth="8"
            strokeLinecap="square"
          />
          <path
            d="M30 10H90V70"
            stroke="#E53935"
            strokeWidth="8"
            strokeLinecap="square"
          />
          <text
            x="50"
            y="57"
            textAnchor="middle"
            fill="#E53935"
            fontSize="26"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            PDF
          </text>
        </svg>
      );

    case "docx":
      return (
        <svg
          className="file-icon"
          viewBox="0 0 100 100"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M15 10H68L85 27V90H15V10Z"
            stroke="#2B579A"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fill="#2B579A"
            fontSize="21"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            DOCX
          </text>
        </svg>
      );

    case "pptx":
      return (
        <svg
          className="file-icon"
          viewBox="0 0 100 100"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="12"
            y="12"
            width="76"
            height="56"
            stroke="#E06B43"
            strokeWidth="8"
            fill="none"
          />
          <path
            d="M50 68V80M28 88H72"
            stroke="#E06B43"
            strokeWidth="8"
            strokeLinecap="square"
          />
          <text
            x="50"
            y="49"
            textAnchor="middle"
            fill="#E06B43"
            fontSize="21"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            PPTX
          </text>
        </svg>
      );

    case "txt":
      return (
        <svg
          className="file-icon"
          viewBox="0 0 100 100"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="12"
            y="12"
            width="76"
            height="76"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
          />
          <line
            x1="20"
            y1="26"
            x2="80"
            y2="26"
            stroke="currentColor"
            strokeWidth="6"
          />
          <line
            x1="20"
            y1="74"
            x2="80"
            y2="74"
            stroke="currentColor"
            strokeWidth="6"
          />
          <text
            x="50"
            y="57"
            textAnchor="middle"
            fill="currentColor"
            fontSize="24"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            TXT
          </text>
        </svg>
      );

    default:
      return (
        <svg
          className="file-icon"
          viewBox="0 0 100 100"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          aria-hidden="true"
        >
          <rect x="15" y="10" width="70" height="80" rx="4" />
        </svg>
      );
  }
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
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (uploads.length > 0 && listRef.current) listRef.current.scrollTop = 0;
  }, [uploads.length]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onAddFile(file);
  }

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
                <li key={doc.id} className={`source-item${doc.parseStatus === "error" ? " source-item--error" : ""}`}>
                  <FileIcon type={doc.type} />
                  <span className="source-title" title={doc.title}>{doc.title}</span>
                  {doc.parseStatus === "error" && (
                    <span className="source-badge" title={doc.parseError || MSG_PARSE_FAILED}>
                      Gagal diproses
                    </span>
                  )}
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
                <button type="button" role="menuitem" className="danger" onClick={() => pick(onDelete)}>
                  <TrashIcon /> Hapus
                </button>
                
                <button type="button" role="menuitem" onClick={() => pick(onRename)}>
                  <PencilIcon /> Ganti Nama
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

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

const SKELETON_LINE_WIDTHS = ["100%", "75%", "86%", "80%", "94%", "100%"];
const CHAT_LOAD_DELAY_MS = 1500;

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

function WorkspacePage({ notebook, accessToken, profile, onBack, onLogout, onEditProfile }) {
  const { toasts, notify, dismiss } = useToasts();
  const { documents, uploads, uploadError, addFile, renameDocument, removeDocument } =
    useSources({ notebookId: notebook._id, accessToken, notify });
  
  // 3.b. Menambahkan API notes dan state collapsed
  const notesApi = useNotes({ notebookId: notebook._id, accessToken, notify });
  const [notesCollapsed, setNotesCollapsed] = useState(false);

  function handleNewNote() {
    setNotesCollapsed(false);
    notesApi.addNote();
  }

  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  const hasDocuments = documents.some((d) => d.parseStatus === "done");

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
        if (!cancelled) setLoadingChat(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notebook._id]);

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
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      handleSend(e);
    }
  }

  return (
    <div className="workspace-page">
      {/* 3.c. Tombol “Catatan Baru +” disesuaikan */}
      <AppHeader
        onLogout={onLogout}
        onBrandClick={onBack}
        onEditProfile={onEditProfile}
        profile={profile}
        actions={
          <button type="button" className="btn-pill" onClick={handleNewNote} disabled={notesApi.creating}>
            Catatan Baru +
          </button>
        }
      />

      {/* 3.d. Menambahkan kelas kondisional pada main workspace */}
      <main
        className={`workspace${sourcesCollapsed ? " workspace--sources-collapsed" : ""}${
          notesCollapsed ? " workspace--notes-collapsed" : ""
        }`}
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

        {/* 3.e. Mengganti seluruh <section className="panel panel-notes"> dengan NotesPanel */}
        <NotesPanel
          notes={notesApi}
          collapsed={notesCollapsed}
          onToggle={() => setNotesCollapsed((v) => !v)}
          icons={{ toggle: <ToggleSidebarIcon />, rename: <PencilIcon />, trash: <TrashIcon /> }}
        />
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

/* ---------- Profil ---------- */

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MSG_AVATAR_FORMAT = "Format foto harus JPG";
const MSG_AVATAR_TOO_LARGE = "Ukuran foto melebihi batas maksimal 5 MB";
const MSG_USERNAME_SAVED = "Username berhasil diperbarui";
const MSG_AVATAR_SAVED = "Foto profil berhasil diperbarui";

function normalizeProfile(user) {
  return {
    username: user?.username || "",
    email: user?.email || "",
    avatarUrl: user?.avatarUrl || "",
  };
}

function validateAvatarFile(file) {
  const ext = getFileExtension(file.name);
  if (file.type !== "image/jpeg" || !["jpg", "jpeg"].includes(ext)) return MSG_AVATAR_FORMAT;
  if (file.size > MAX_AVATAR_SIZE) return MSG_AVATAR_TOO_LARGE;
  return "";
}

function useProfile(accessToken) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    getCurrentUser(accessToken)
      .then((data) => {
        if (!cancelled) setProfile(normalizeProfile(data?.user));
      })
      .catch((err) => {
        if (!cancelled) setError(errorToMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { profile, setProfile, loading, error, reload };
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ProfilePage({
  accessToken,
  profile,
  loading,
  error,
  notify,
  onReload,
  onProfileUpdated,
  onEditUsername,
  onBack,
  onLogout,
  onEditProfile,
}) {
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;

    const message = validateAvatarFile(file);
    setAvatarError(message);
    if (message) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setUploading(true);
    try {
      const data = await updateProfile({ avatar: file }, accessToken);
      onProfileUpdated(normalizeProfile(data?.user ?? profile));
      notify(MSG_AVATAR_SAVED, "success");
    } catch (err) {
      setAvatarError(errorToMessage(err));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setAvatarPreview("");
      setUploading(false);
    }
  }

  return (
    <>
      <AppHeader
        onLogout={onLogout}
        onBrandClick={onBack}
        onEditProfile={onEditProfile}
        profile={profile}
      />
      <main className="auth">
        <h1>Profil</h1>

        {loading ? (
          <p className="empty-state">Memuat profil...</p>
        ) : error ? (
          <>
            <ErrorSummary messages={[error]} />
            <button type="button" className="link" onClick={onReload}>Coba lagi</button>
          </>
        ) : (
          profile && (
            <>
              <div className="profile-avatar">
                <div className="profile-avatar-img">
                  <Avatar src={avatarPreview || profile.avatarUrl} size={120} />
                </div>
                <button
                  type="button"
                  className="link"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Mengunggah..." : "Ganti foto"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,image/jpeg"
                  hidden
                  onChange={handleAvatarChange}
                />
                {avatarError && (
                  <p className="msg-error" role="alert">{avatarError}</p>
                )}
              </div>

              <div className="field">
                <span className="field-label" id="profile-username-label">Username</span>
                <button
                  type="button"
                  className="input input--button"
                  aria-labelledby="profile-username-label profile-username-value"
                  onClick={onEditUsername}
                >
                  <span id="profile-username-value" className="input-button-value">
                    {profile.username}
                  </span>
                  <ChevronRightIcon />
                </button>
              </div>

              <Field id="profile-email" label="Email" showMessage={false}>
                <TextInput
                  id="profile-email"
                  name="email"
                  type="email"
                  className="input input--readonly"
                  value={profile.email}
                  readOnly
                  aria-readonly="true"
                />
              </Field>
            </>
          )
        )}
      </main>
    </>
  );
}

function EditUsernamePage({ accessToken, profile, notify, onSaved, onCancel }) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const message = validateUsername(username);
    if (message) {
      setError(message);
      return;
    }

    const trimmed = username.trim();
    if (trimmed === profile.username) {
      onCancel();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = await updateProfile({ username: trimmed }, accessToken);
      onSaved(normalizeProfile(data?.user ?? { ...profile, username: trimmed }));
      notify(MSG_USERNAME_SAVED, "success");
    } catch (err) {
      const messages = Object.values(mapFieldErrors(err));
      setError(messages.length ? messages.join(" ") : errorToMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="edit-username-page">
      <header className="topbar">
        <button
          type="button"
          className="brand-link"
          onClick={onCancel}
          disabled={saving}
          aria-label="Kembali ke profil"
        >
          <LogoIcon size={32} />
          <span className="brand">SiberNoteLM</span>
        </button>
      </header>

      <form className="edit-username-form" onSubmit={handleSubmit} noValidate>
        <Field id="edit-username" label="Username" error={error}>
          <TextInput
            id="edit-username"
            name="username"
            autoComplete="username"
            placeholder="Masukkan username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            error={error}
            autoFocus
          />
        </Field>

        <button className="btn edit-username-save" type="submit" disabled={saving}>
          {saving ? "Memproses..." : "Simpan"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Root ---------- */

export default function App() {
  const [view, setView] = useState("login");
  const [notice, setNotice] = useState("");
  const [accessToken, setAccessToken] = useState(null);
  const [activeNotebook, setActiveNotebook] = useState(null);
  const {
    profile,
    setProfile,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useProfile(accessToken);
  const { toasts, notify, dismiss } = useToasts();

  function handleLoginSuccess(token) {
    setAccessToken(token);
    setView("dashboard");
  }

  function handleLogout() {
    logout(accessToken);
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

  function handleEditProfile() {
    setView("profile");
  }

  function handleUsernameSaved(nextProfile) {
    setProfile(nextProfile);
    setView("profile");
  }

  function renderView() {
    if (view === "edit-username" && accessToken && profile) {
      return (
        <EditUsernamePage
          accessToken={accessToken}
          profile={profile}
          notify={notify}
          onSaved={handleUsernameSaved}
          onCancel={() => setView("profile")}
        />
      );
    }

    if ((view === "profile" || view === "edit-username") && accessToken) {
      return (
        <ProfilePage
          accessToken={accessToken}
          profile={profile}
          loading={profileLoading}
          error={profileError}
          notify={notify}
          onReload={reloadProfile}
          onProfileUpdated={setProfile}
          onEditUsername={() => setView("edit-username")}
          onBack={handleBackToDashboard}
          onLogout={handleLogout}
          onEditProfile={handleEditProfile}
        />
      );
    }

    if (view === "workspace" && accessToken && activeNotebook) {
      return (
        <WorkspacePage
          notebook={activeNotebook}
          accessToken={accessToken}
          profile={profile}
          onBack={handleBackToDashboard}
          onLogout={handleLogout}
          onEditProfile={handleEditProfile}
        />
      );
    }

    if (view === "dashboard" && accessToken) {
      return (
        <NotebooksPage
          accessToken={accessToken}
          profile={profile}
          onLogout={handleLogout}
          onEditProfile={handleEditProfile}
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

  return (
    <>
      {renderView()}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}