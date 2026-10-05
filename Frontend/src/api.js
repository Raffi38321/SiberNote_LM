const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const ACCESS_TOKEN_KEY  = "sibernotelm_access_token";
const REFRESH_TOKEN_KEY = "sibernotelm_refresh_token";
const USER_KEY          = "sibernotelm_user";

const TIMEOUT_MS = 15000;

// ─── error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
    this.data   = data;
  }
}

// ─── core request ────────────────────────────────────────────────────────────

async function request(path, { method = "GET", body, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "Server terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      data?.message ||
      data?.detail  ||
      data?.error   ||
      `Permintaan gagal (kode ${res.status}).`;
    throw new ApiError(
      typeof message === "string" ? message : JSON.stringify(message),
      res.status,
      data
    );
  }

  return data;
}

// ─── auth endpoints ───────────────────────────────────────────────────────────

export function login({ email, password }) {
  return request("/user/login", { method: "POST", body: { email, password } });
}

export function register({ username, email, password }) {
  return request("/user/register", { method: "POST", body: { username, email, password } });
}

export function refreshToken(token) {
  return request("/user/refresh", { method: "POST", body: { refreshToken: token } });
}

export function logoutApi(token) {
  return request("/user/logout", { method: "POST", body: { refreshToken: token } });
}

export function getProfile() {
  return request("/user/me", { token: getAccessToken() });
}

// ─── session helpers ──────────────────────────────────────────────────────────

/**
 * Simpan accessToken + refreshToken ke localStorage.
 * Backend return: { data: { accessToken, refreshToken } }
 */
export function saveSession({ accessToken, refreshToken }) {
  if (accessToken)  localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Cek apakah session masih ada (access token tersimpan) */
export function isLoggedIn() {
  return Boolean(getAccessToken());
}
