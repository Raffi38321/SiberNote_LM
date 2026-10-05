// Semua request ke backend SiberNote LM ada di file ini.
// Saat ini baru endpoint Register yang dipakai (lihat apidocumentation.md).

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const TOKEN_KEY = "sibernotelm_token";
const USER_KEY = "sibernotelm_user";
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {Array<{field: string, message: string}>|null} fieldErrors
   */
  constructor(message, status = 0, fieldErrors = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

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

  // Respons bisa kosong / bukan JSON, jadi parse dengan aman.
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
export function registerUser({ email, username, password }) {
  return request("/user/register", { method: "POST", body: { email, username, password } });
}
