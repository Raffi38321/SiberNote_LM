// Semua request ke backend SiberNote LM ada di file ini.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_KEY = "sibernotelm_refresh_token";

export class ApiError extends Error {
  constructor(message, status = 0, fieldErrors = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Helper penyimpanan Refresh Token
export function saveRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** POST /user/refresh -> mendapatkan accessToken baru */
export async function refreshToken() {
  const token = getRefreshToken();
  if (!token) throw new ApiError("Refresh token tidak ditemukan.", 401);

  const res = await fetch(`${BASE_URL}/user/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken: token }),
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok || payload?.status === "failed") {
    clearRefreshToken();
    throw new ApiError(payload?.message || "Sesi telah berakhir, silakan login kembali.", res.status);
  }

  return payload?.data?.accessToken;
}

// Banyak request paralel yang kena 401 (mis. dashboard memuat jumlah sumber tiap notebook)
// berbagi satu proses refresh, bukan memanggil /user/refresh berkali-kali.
let refreshInFlight = null;
function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request(path, { method = "GET", body, accessToken, isRetry = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // FormData (mis. update profil): jangan set Content-Type, browser menambahkan boundary sendiri.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const headers = { Accept: "application/json" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    return " "
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

  // Interceptor: Auto Refresh Token jika 401 Unauthorized
  if (res.status === 401 && !isRetry && accessToken) {
    try {
      const newAccessToken = await refreshOnce();
      return await request(path, { method, body, accessToken: newAccessToken, isRetry: true });
    } catch (refreshErr) {
      throw refreshErr;
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

// ---------- Auth ----------

export function register({ email, username, password }) {
  return request("/user/register", { method: "POST", body: { email, username, password } });
}

export function login({ email, password }) {
  return request("/user/login", { method: "POST", body: { email, password } });
}

export function logout(accessToken) {
  const token = getRefreshToken();
  clearRefreshToken();
  if (token) {
    return request("/user/logout", { method: "POST", body: { refreshToken: token }, accessToken }).catch(() => {});
  }
}

// ---------- User ----------

/** GET /user/me -> data profil user yang sedang login ({ user: { username, email, avatarUrl, ... } }) */
export function getCurrentUser(accessToken) {
  return request("/user/me", { accessToken });
}

/** PUT /user -> ubah username dan/atau avatar (multipart/form-data). Minimal salah satu harus diisi. */
export function updateProfile({ username, avatar }, accessToken) {
  const form = new FormData();
  if (username !== undefined) form.append("username", username);
  if (avatar) form.append("avatar", avatar);
  return request("/user", { method: "PUT", body: form, accessToken });
}

// ---------- Notebooks ----------

export function createNotebook({ title, description }, accessToken) {
  return request("/notebooks", { method: "POST", body: { title, description }, accessToken });
}

export function getNotebooks(accessToken) {
  return request("/notebooks", { accessToken });
}

export function deleteNotebook(notebookId, accessToken) {
  return request(`/notebooks/${notebookId}`, { method: "DELETE", accessToken });
}

/** PUT /notebooks/:notebookId -> update title atau description */
export function updateNotebook(notebookId, { title, description }, accessToken) {
  return request(`/notebooks/${notebookId}`, { method: "PUT", body: { title, description }, accessToken });
}

/** PATCH /notebooks/:notebookId/pin -> toggle status pin */
export function togglePinNotebook(notebookId, pinned, accessToken) {
  return request(`/notebooks/${notebookId}/pin`, { method: "PATCH", body: { pinned }, accessToken });
}

// ---------- Documents (sumber) ----------

export function getDocuments(notebookId, accessToken) {
  return request(`/documents/${notebookId}`, { accessToken });
}

// Upload memakai XHR (untuk progress), jadi tidak lewat request(). Agar tidak gagal saat
// accessToken kedaluwarsa, 401 ditangani di sini: refresh token sekali lalu kirim ulang.
export function uploadDocument(notebookId, file, accessToken, { onProgress } = {}) {
  return sendUpload(notebookId, file, accessToken, onProgress).catch(async (err) => {
    if (err instanceof ApiError && err.status === 401 && accessToken) {
      const fresh = await refreshOnce();
      return sendUpload(notebookId, file, fresh, onProgress);
    }
    throw err;
  });
}

function sendUpload(notebookId, file, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/documents/${notebookId}`);
    xhr.setRequestHeader("Accept", "application/json");
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = { message: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.status !== "failed") {
        resolve(payload?.data ?? null);
      } else {
        reject(
          new ApiError(
            payload?.message || `Permintaan gagal (kode ${xhr.status}).`,
            xhr.status,
            payload?.errors || null
          )
        );
      }
    };
    xhr.onerror = () =>
      reject(new ApiError("Tidak dapat terhubung ke server. Periksa koneksi internet Anda."));
    xhr.ontimeout = () => reject(new ApiError("Server terlalu lama merespons. Coba lagi."));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** PATCH /documents/:documentId -> body harus `{ name }` */
export function updateDocumentTitle(documentId, name, accessToken) {
  return request(`/documents/${documentId}`, { method: "PATCH", body: { name }, accessToken });
}

export function deleteDocument(documentId, accessToken) {
  return request(`/documents/${documentId}`, { method: "DELETE", accessToken });
}

export function getDocumentStatus(documentId, accessToken) {
  return request(`/documents/status/${documentId}`, { accessToken });
}

// ---------- Notes ----------
export function getNotes(notebookId, accessToken) {
  return request(`/notes/${notebookId}/all`, { accessToken });
}
export function createNote(notebookId, { title, content }, accessToken) {
  return request(`/notes/${notebookId}`, { method: "POST", body: { title, content }, accessToken });
}
export function updateNote(notebookId, noteId, { title, content }, accessToken) {
  return request(`/notes/${notebookId}/${noteId}`, { method: "PUT", body: { title, content }, accessToken });
}
export function deleteNote(notebookId, noteId, accessToken) {
  return request(`/notes/${notebookId}/${noteId}`, { method: "DELETE", accessToken });
}

/** Mengambil riwayat percakapan chat AI dalam notebook */
export async function getChatHistory(notebookId, accessToken) {
  const res = await fetch(`${BASE_URL}/chats/${notebookId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || "Gagal memuat riwayat chat", res.status);
  return data.data; // mengembalikan { messages: [...] }
}

/** Mengirim pesan baru ke AI */
export async function sendChatMessage(notebookId, message, accessToken) {
  const res = await fetch(`${BASE_URL}/chats/${notebookId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 422) {
      throw new ApiError(
        "Dokumen belum siap. Tunggu hingga dokumen selesai diproses (parseStatus: done).",
        422
      );
    }
    throw new ApiError(data.message || "Gagal mengirim pesan ke AI", res.status);
  }
  return data.data; // mengembalikan { userMessage, assistantMessage }
}