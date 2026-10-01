

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const TOKEN_KEY = "";
const USER_KEY = "";
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

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
      data?.detail ||
      data?.error ||
      `Permintaan gagal (kode ${res.status}).`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status, data);
  }

  return data;
}


export function login({ email, password }) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function register({ username, email, password }) {
  return request("/auth/register", { method: "POST", body: { username, email, password } });
}

export function getProfile(token) {
  return request("/auth/me", { token });
}


export function saveSession({ token, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
