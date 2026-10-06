// Semua request ke backend SiberNote LM ada di file ini.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const TIMEOUT_MS = 15000;
const REFRESH_TOKEN_KEY = "sibernotelm_refresh_token";

export class ApiError extends Error {
  constructor(message, status = 0, fieldErrors = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(path, { method = "GET", body, accessToken } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(
      err.name === "AbortError"
        ? "Server terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
    );
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!res.ok || payload?.status === "failed") {
    throw new ApiError(
      payload?.message || `Permintaan gagal (kode ${res.status}).`,
      res.status,
      payload?.errors || null
    );
  }

  return payload?.data ?? null;
}

/** POST /user/register -> { accessToken, refreshToken } */
export function register({ email, username, password }) {
  return request("/user/register", { method: "POST", body: { email, username, password } });
}

/** POST /user/login -> { accessToken, refreshToken } */
export function login({ email, password }) {
  return request("/user/login", { method: "POST", body: { email, password } });
}

// ---------- Penyimpanan refreshToken ----------
// accessToken sengaja tidak disimpan ke localStorage, cukup di state React.

export function saveRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}