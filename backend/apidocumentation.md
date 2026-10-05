# API Documentation — SiberNote LM

Base URL: `http://localhost:8080`

---

## Response Format

**Success tanpa data**
```json
{
  "status": "success",
  "message": "string"
}
```

**Success dengan data**
```json
{
  "status": "success",
  "message": "string",
  "data": {}
}
```

**Error**
```json
{
  "status": "failed",
  "message": "string"
}
```

**Validation Error `400`**
```json
{
  "status": "failed",
  "message": "validasi gagal",
  "errors": [
    { "field": "password", "message": "password minimal 8 karakter" }
  ]
}
```

---

## Token

| Token          | Expire   | Kegunaan                                        |
|----------------|----------|-------------------------------------------------|
| `accessToken`  | 15 menit | Dikirim di header `Authorization` tiap request  |
| `refreshToken` | 7 hari   | Dipakai untuk mendapatkan `accessToken` baru    |

Payload JWT: `{ userId: string }`

---

## Auth

### Register

Membuat akun user baru.

```
POST /user/register
```

**Validasi**

| Field      | Aturan                                                                       |
|------------|------------------------------------------------------------------------------|
| `email`    | Wajib, format email valid, unik                                              |
| `username` | Wajib, 1–16 karakter, hanya `a-z A-Z 0-9 _ -`, unik                        |
| `password` | Wajib, 8–16 karakter, hanya `a-z A-Z 0-9`, tidak boleh mengandung username  |

**Request Body**
```json
{
  "email": "raffi@example.com",
  "username": "raffi",
  "password": "rahasia123"
}
```

**Response `201 Created`**
```json
{
  "status": "success",
  "message": "berhasil buat user",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**

| Status | Kondisi                             |
|--------|-------------------------------------|
| `400`  | Validasi gagal                      |
| `401`  | Email atau username sudah terdaftar |
| `500`  | Kesalahan server                    |

---

### Login

Autentikasi user yang sudah terdaftar.

```
POST /user/login
```

**Validasi**

| Field      | Aturan                    |
|------------|---------------------------|
| `email`    | Wajib, format email valid |
| `password` | Wajib, tidak boleh kosong |

**Request Body**
```json
{
  "email": "raffi@example.com",
  "password": "rahasia123"
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil login",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**

| Status | Kondisi                   |
|--------|---------------------------|
| `400`  | Validasi gagal            |
| `401`  | Email atau password salah |
| `500`  | Kesalahan server          |

---

### Refresh Token

Mendapatkan `accessToken` baru menggunakan `refreshToken` yang masih valid.

```
POST /user/refresh
```

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "access token berhasil diperbarui",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses**

| Status | Kondisi                                                      |
|--------|--------------------------------------------------------------|
| `401`  | `refreshToken` tidak dikirim                                 |
| `401`  | `refreshToken` tidak valid, sudah expired, atau sudah logout |
| `500`  | Kesalahan server                                             |

---

### Logout

Mencabut `refreshToken` — token dihapus dari database sehingga tidak bisa dipakai lagi.

```
POST /user/logout
```

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil logout",
  "data": {}
}
```

**Error Responses**

| Status | Kondisi                      |
|--------|------------------------------|
| `401`  | `refreshToken` tidak dikirim |
| `500`  | Kesalahan server             |

---

## User

### Get Current User

Mengambil data user yang sedang login.

```
GET /user/me
```

**Headers**

| Key             | Value                  | Required |
|-----------------|------------------------|----------|
| `Authorization` | `Bearer <accessToken>` | ✅        |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil get data user",
  "data": {
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "email": "raffi@example.com",
      "username": "raffi",
      "avatarUrl": "",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    }
  }
}
```

> Field `password` tidak ikut dikembalikan.

**Error Responses**

| Status | Kondisi                                           |
|--------|---------------------------------------------------|
| `401`  | Token tidak ada, format salah, atau sudah expired |
| `404`  | User tidak ditemukan                              |
| `500`  | Kesalahan server                                  |

---

## Notebooks

Semua endpoint notebook membutuhkan `accessToken` yang valid di header:

```
Authorization: Bearer <accessToken>
```

---

### Create Notebook

Membuat notebook baru milik user yang sedang login.

```
POST /notebooks
```

**Request Body**

| Field         | Aturan  |
|---------------|---------|
| `title`       | Wajib   |
| `description` | Wajib   |

```json
{
  "title": "Catatan Belajar",
  "description": "Kumpulan catatan belajar machine learning"
}
```

**Response `201 Created`**
```json
{
  "status": "success",
  "message": "berhasil buat notebook",
  "data": {
    "notebook": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "title": "Catatan Belajar",
      "description": "Kumpulan catatan belajar machine learning",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi              |
|--------|----------------------|
| `400`  | Validasi gagal       |
| `401`  | Tidak terautentikasi |
| `404`  | User tidak ditemukan |
| `500`  | Kesalahan server     |

---

### Get All Notebooks

Mengambil semua notebook milik user, diurutkan dari yang terbaru diupdate.

```
GET /notebooks
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil dapet smua notebook use",
  "data": {
    "notebooks": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0e",
        "userId": "665f1a2b3c4d5e6f7a8b9c0d",
        "title": "Catatan Belajar",
        "description": "Kumpulan catatan belajar machine learning",
        "createdAt": "2026-09-24T10:00:00.000Z",
        "updatedAt": "2026-09-24T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

| Status | Kondisi              |
|--------|----------------------|
| `401`  | Tidak terautentikasi |
| `404`  | User tidak ditemukan |
| `500`  | Kesalahan server     |

---

### Delete Notebook

Menghapus notebook beserta seluruh dokumen, chunks, dan file Cloudinary yang terkait. Hanya bisa dilakukan oleh pemilik notebook.

```
DELETE /notebooks/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil hapus notebook"
}
```

> Cascade delete: semua `documents`, `chunks`, dan file di Cloudinary yang terkait notebook ini ikut dihapus.

**Error Responses**

| Status | Kondisi                                 |
|--------|-----------------------------------------|
| `401`  | Tidak terautentikasi                    |
| `403`  | Notebook bukan milik user               |
| `404`  | Notebook tidak ditemukan                |
| `500`  | Kesalahan server                        |

---

## Documents

Semua endpoint document membutuhkan `accessToken` yang valid di header:

```
Authorization: Bearer <accessToken>
```

---

### Upload Document

Upload file PDF atau PPTX ke notebook. File disimpan ke Cloudinary, lalu dipecah menjadi chunks dan di-embed menggunakan Gemini secara background (tidak memblokir response).

```
POST /documents/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook tujuan  |

**Request**

`Content-Type: multipart/form-data`

| Field  | Type   | Required | Keterangan                        |
|--------|--------|----------|-----------------------------------|
| `file` | file   | ✅        | File PDF atau PPTX, maksimal 20MB |

**Response `201 Created`**

Response dikembalikan langsung setelah file terupload ke Cloudinary. Proses chunking dan embedding berjalan di background.

```json
{
  "status": "success",
  "message": "berhasil upload dokumen",
  "data": {
    "document": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0f",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Sistem_Operasi",
      "fileType": "pdf",
      "fileUrl": "https://res.cloudinary.com/...",
      "fileSize": 2048576,
      "totalPages": 0,
      "parseStatus": "pending",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    }
  }
}
```

> `parseStatus` akan berubah menjadi `"done"` setelah chunking dan embedding selesai, atau `"error"` jika gagal. Frontend bisa polling field ini untuk tahu kapan dokumen siap dipakai.

> **Catatan OCR:**
> - **PDF:** Halaman yang terdeteksi sebagai scan/gambar (teks < 30 karakter) di-render lalu di-OCR dengan Tesseract (`ind+eng`).
> - **PPTX:** Teks slide diambil dari shape seperti biasa; gambar tertanam di slide juga di-OCR otomatis (Tesseract `ind+eng`) lalu digabung ke konten slide. Hasil OCR yang terlalu pendek (< 30 karakter, misalnya logo) diabaikan.
>
> Proses OCR lebih lambat dibanding ekstraksi teks biasa.

**Error Responses**

| Status | Kondisi                                         |
|--------|-------------------------------------------------|
| `401`  | Tidak terautentikasi                            |
| `401`  | Tipe file tidak didukung (bukan PDF atau PPTX)  |
| `401`  | File tidak disertakan                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user  |
| `500`  | Kesalahan server / gagal upload ke Cloudinary   |

---

### Get Documents by Notebook

Mengambil semua dokumen dalam satu notebook, diurutkan dari yang terbaru diupload.

```
GET /documents/:notebookId
```

**URL Params**

| Param        | Keterangan         |
|--------------|--------------------|
| `notebookId` | ID notebook target |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil get dokumen",
  "data": {
    "documents": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0f",
        "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
        "title": "Sistem_Operasi",
        "fileType": "pdf",
        "fileUrl": "https://res.cloudinary.com/...",
        "fileSize": 2048576,
        "totalPages": 42,
        "parseStatus": "done",
        "createdAt": "2026-09-24T10:00:00.000Z",
        "updatedAt": "2026-09-24T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                               |

---

### Update Document Title

Mengubah judul dokumen.

```
PATCH /documents/:documentId
```

**URL Params**

| Param        | Keterangan           |
|--------------|----------------------|
| `documentId` | ID dokumen MongoDB   |

**Request Body**

| Field  | Aturan                     |
|--------|----------------------------|
| `name` | Wajib, tidak boleh kosong  |

```json
{
  "name": "Sistem Operasi — Bab 3"
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil update document",
  "data": {
    "document": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0f",
      "title": "Sistem Operasi — Bab 3",
      "parseStatus": "done",
      ...
    }
  }
}
```

**Error Responses**

| Status | Kondisi                    |
|--------|----------------------------|
| `400`  | Validasi gagal             |
| `401`  | Tidak terautentikasi       |
| `404`  | Dokumen tidak ditemukan    |
| `500`  | Kesalahan server           |

---

### Delete Document

Menghapus dokumen beserta seluruh chunks dan file Cloudinary-nya. Hanya bisa dilakukan oleh pemilik notebook yang memuat dokumen tersebut.

```
DELETE /documents/:documentId
```

**URL Params**

| Param        | Keterangan         |
|--------------|--------------------|
| `documentId` | ID dokumen MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil hapus dokumen"
}
```

> Cascade delete: semua `chunks` dan file di Cloudinary yang terkait dokumen ini ikut dihapus.

**Error Responses**

| Status | Kondisi                                |
|--------|----------------------------------------|
| `401`  | Tidak terautentikasi                   |
| `403`  | Dokumen bukan milik user               |
| `404`  | Dokumen tidak ditemukan                |
| `500`  | Kesalahan server                       |

---

### Get Document Status

Polling endpoint untuk mengecek status pemrosesan dokumen (chunking + embedding). Lebih ringan dari `GET /documents/:notebookId` karena hanya return field status.

```
GET /documents/status/:documentId
```

**URL Params**

| Param        | Keterangan         |
|--------------|--------------------|
| `documentId` | ID dokumen MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil get status dokumen",
  "data": {
    "parseStatus": "done",
    "parseError": "",
    "totalPages": 42
  }
}
```

**Nilai `parseStatus`**

| Nilai       | Arti                                                  |
|-------------|-------------------------------------------------------|
| `"pending"` | File sudah terupload, chunking belum selesai          |
| `"done"`    | Chunking dan embedding selesai, dokumen siap dipakai  |
| `"error"`   | Proses gagal — lihat `parseError` untuk detail        |

**Nilai `parseError` saat gagal**

| Kondisi dokumen                    | Pesan `parseError`                                          |
|------------------------------------|-------------------------------------------------------------|
| File corrupt / tidak bisa dibaca   | `"Gagal memproses dokumen, silakan coba lagi. (detail)"`    |
| Tidak ada teks dan OCR tidak berhasil | `"Tidak ada konten yang dapat diekstrak dari dokumen ini."` |

**Error Responses**

| Status | Kondisi                            |
|--------|------------------------------------|
| `401`  | Tidak terautentikasi               |
| `403`  | Dokumen bukan milik user           |
| `404`  | Dokumen tidak ditemukan            |
| `500`  | Kesalahan server                   |

---

## parseStatus Flow

Field `parseStatus` pada dokumen menunjukkan status pemrosesan background. Frontend polling `GET /documents/status/:documentId` sampai `parseStatus` bukan `"pending"`.

```
upload selesai → parseStatus: "pending"
                      │
                      ▼
         chunking + embedding berjalan di background
                      │
         ┌────────────┴──────────────────────────┐
         │                                       │
         ▼                                       ▼
  per halaman PDF:                     parseStatus: "error"
  teks >= 30 char → pakai langsung     parseError: "<pesan>"
  teks < 30 char  → render → OCR       → file corrupt / semua halaman kosong
         │
         ▼
  embed semua chunks (Gemini)
         │
         ▼
  parseStatus: "done"
  totalPages: N
  → dokumen siap dipakai
```

> **OCR otomatis:**
> - **PDF:** Halaman dengan teks < 30 karakter di-render ke PNG lalu di-OCR (Tesseract `ind+eng`). Halaman yang gagal di-OCR di-skip tanpa menghentikan proses keseluruhan.
> - **PPTX:** Gambar tertanam di slide di-OCR saat parsing; teks hasil OCR digabung dengan teks shape. Hasil OCR < 30 karakter diabaikan.

---

## Alur Penggunaan Token

```
Register / Login
      │
      ├── accessToken  (simpan di memory/state, jangan localStorage)
      └── refreshToken (simpan di httpOnly cookie atau secure storage)
             │
             ▼
      Kirim accessToken di setiap request → Authorization: Bearer <accessToken>
             │
             ▼
      accessToken expired (15 menit)?
             │
             └── POST /user/refresh + refreshToken → accessToken baru
             │
             ▼
      Logout? → POST /user/logout + refreshToken → token dicabut dari DB
```
