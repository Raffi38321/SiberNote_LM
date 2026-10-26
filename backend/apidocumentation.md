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

| Token          | Expire  | Kegunaan                                        |
|----------------|---------|-------------------------------------------------|
| `accessToken`  | 1 jam   | Dikirim di header `Authorization` tiap request  |
| `refreshToken` | 7 hari  | Dipakai untuk mendapatkan `accessToken` baru    |

Payload JWT: `{ userId: string }`

---

## Auth

### Register

Membuat akun user baru.

```
POST /user/register
```

**Validasi**

| Field      | Aturan                                                                            |
|------------|-----------------------------------------------------------------------------------|
| `email`    | Wajib, format email valid, unik                                                   |
| `username` | Wajib, 1–16 karakter, hanya `a-z A-Z 0-9 _ -`, unik                             |
| `password` | Wajib, 8–16 karakter, tidak boleh sama dengan username (case-insensitive)         |

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

### Update Profil

Mengubah username dan/atau foto profil user yang sedang login. Minimal salah satu harus diisi.

```
PUT /user
```

**Headers**

| Key             | Value                             | Required |
|-----------------|-----------------------------------|----------|
| `Authorization` | `Bearer <accessToken>`            | ✅        |
| `Content-Type`  | `multipart/form-data`             | ✅        |

**Form Fields**

| Field      | Type   | Aturan                                   |
|------------|--------|------------------------------------------|
| `username` | string | Opsional, 1–16 karakter, unik            |
| `avatar`   | file   | Opsional, format JPG saja, maksimal 5 MB |

> Minimal salah satu dari `username` atau `avatar` harus disertakan.

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "Profil berhasil diperbarui",
  "data": {
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "email": "raffi@example.com",
      "username": "raffi_baru",
      "avatarUrl": "https://storage.sibernote.com/avatars/avatar.jpg",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:15:00.000Z"
    }
  }
}
```

> Foto profil lama otomatis dihapus dari storage server saat foto baru berhasil diupload.

**Error Responses**

| Status | Kondisi                                           |
|--------|---------------------------------------------------|
| `400`  | Validasi gagal                                    |
| `400`  | Tidak ada field yang diisi                        |
| `400`  | Format avatar bukan JPG                           |
| `400`  | Ukuran avatar melebihi 5 MB                       |
| `401`  | Token tidak ada, format salah, atau sudah expired |
| `401`  | Username sudah terdaftar                          |
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

| Field         | Aturan                    |
|---------------|---------------------------|
| `title`       | Wajib, 1–100 karakter     |
| `description` | Wajib                     |

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
      "isPinned": false,
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
| `500`  | Kesalahan server     |

---

### Get All Notebooks

Mengambil semua notebook milik user, diurutkan berdasarkan pin lalu terbaru diupdate. Mendukung pagination.

```
GET /notebooks?page=1
```

**Query Params**

| Param  | Keterangan                                  |
|--------|---------------------------------------------|
| `page` | Opsional, nomor halaman (default: 1), limit 10 per halaman |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil mendapatkan semua notebook user",
  "data": {
    "notebooks": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0e",
        "userId": "665f1a2b3c4d5e6f7a8b9c0d",
        "title": "Catatan Belajar",
        "description": "Kumpulan catatan belajar machine learning",
        "isPinned": false,
        "jumlah_sumber": 3,
        "createdAt": "2026-09-24T10:00:00.000Z",
        "updatedAt": "2026-09-24T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 25,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

> `jumlah_sumber` adalah jumlah dokumen yang terupload di notebook tersebut.

**Error Responses**

| Status | Kondisi              |
|--------|----------------------|
| `401`  | Tidak terautentikasi |
| `500`  | Kesalahan server     |

---

### Delete Notebook

Menghapus notebook beserta seluruh dokumen, chunks, dan file yang terkait. Hanya bisa dilakukan oleh pemilik notebook.

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

> Cascade delete: semua `documents`, `chunks`, dan file di storage server yang terkait notebook ini ikut dihapus.

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                               |

---

### Get Notebook By ID

Mengambil detail notebook beserta semua notes dan documents di dalamnya.

```
GET /notebooks/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil dapet notebook",
  "data": {
    "notebook": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "title": "Catatan Belajar",
      "description": "Kumpulan catatan belajar machine learning",
      "isPinned": false,
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    },
    "notes": [],
    "documents": []
  }
}
```

**Error Responses**

| Status | Kondisi                                 |
|--------|-----------------------------------------|
| `401`  | Tidak terautentikasi                    |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                        |

---

### Update Notebook

Mengubah judul atau deskripsi notebook. Minimal salah satu field harus diisi.

```
PUT /notebooks/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Request Body**

| Field         | Aturan                              |
|---------------|-------------------------------------|
| `title`       | Opsional, 1–100 karakter            |
| `description` | Opsional                            |

```json
{
  "title": "Catatan Belajar — Updated",
  "description": "Deskripsi baru"
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil update notebook",
  "data": {
    "notebook": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Catatan Belajar — Updated",
      "description": "Deskripsi baru",
      "isPinned": false,
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:05:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `400`  | Validasi gagal                                 |
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                               |

---

### Pin / Unpin Notebook

Mengubah status pin notebook.

```
PATCH /notebooks/:notebookId/pin
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Request Body**

| Field    | Aturan           |
|----------|------------------|
| `pinned` | Wajib, boolean   |

```json
{
  "pinned": true
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil pin notebook",
  "data": {
    "notebook": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Catatan Belajar",
      "isPinned": true,
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:06:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `400`  | Validasi gagal (`pinned` bukan boolean)        |
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                               |

---

## Notes

Semua endpoint note membutuhkan `accessToken` yang valid di header:

```
Authorization: Bearer <accessToken>
```

Semua endpoint note berada di bawah `/:notebookId`, artinya setiap request otomatis memverifikasi bahwa notebook tersebut milik user yang login.

---

### Create Note

Membuat note baru di dalam notebook.

```
POST /notes/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Request Body**

| Field     | Aturan                        |
|-----------|-------------------------------|
| `title`   | Wajib, 1–100 karakter         |
| `content` | Wajib                         |

```json
{
  "title": "Ringkasan Bab 1",
  "content": "Isi catatan di sini..."
}
```

**Response `201 Created`**
```json
{
  "status": "success",
  "message": "berhasil buat note",
  "data": {
    "note": {
      "_id": "665f1a2b3c4d5e6f7a8b9c10",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Ringkasan Bab 1",
      "content": "Isi catatan di sini...",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `400`  | Validasi gagal                                 |
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `500`  | Kesalahan server                               |

---

### Get All Notes by Notebook

Mengambil semua note dalam satu notebook.

```
GET /notes/:notebookId/all
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil dapet semua note",
  "data": {
    "notes": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c10",
        "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
        "title": "Ringkasan Bab 1",
        "content": "Isi catatan di sini...",
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

### Get Note By ID

Mengambil satu note berdasarkan ID.

```
GET /notes/:notebookId/:noteId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |
| `noteId`     | ID note MongoDB     |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil dapet note",
  "data": {
    "note": {
      "_id": "665f1a2b3c4d5e6f7a8b9c10",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Ringkasan Bab 1",
      "content": "Isi catatan di sini...",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `404`  | Note tidak ditemukan di notebook ini           |
| `500`  | Kesalahan server                               |

---

### Update Note

Mengubah judul atau konten note. Minimal salah satu field harus diisi.

```
PUT /notes/:notebookId/:noteId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |
| `noteId`     | ID note MongoDB     |

**Request Body**

| Field     | Aturan                               |
|-----------|--------------------------------------|
| `title`   | Opsional, 1–100 karakter             |
| `content` | Opsional                             |

```json
{
  "title": "Ringkasan Bab 1 — Revisi",
  "content": "Konten yang sudah diperbarui..."
}
```

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil update note",
  "data": {
    "note": {
      "_id": "665f1a2b3c4d5e6f7a8b9c10",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "title": "Ringkasan Bab 1 — Revisi",
      "content": "Konten yang sudah diperbarui...",
      "createdAt": "2026-09-24T10:00:00.000Z",
      "updatedAt": "2026-09-24T10:10:00.000Z"
    }
  }
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `400`  | Validasi gagal                                 |
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `404`  | Note tidak ditemukan di notebook ini           |
| `500`  | Kesalahan server                               |

---

### Delete Note

Menghapus note dari notebook.

```
DELETE /notes/:notebookId/:noteId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |
| `noteId`     | ID note MongoDB     |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil hapus note"
}
```

**Error Responses**

| Status | Kondisi                                        |
|--------|------------------------------------------------|
| `401`  | Tidak terautentikasi                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user |
| `404`  | Note tidak ditemukan di notebook ini           |
| `500`  | Kesalahan server                               |

---

Semua endpoint document membutuhkan `accessToken` yang valid di header:

```
Authorization: Bearer <accessToken>
```

---

### Upload Document

Upload file PDF, PPTX, DOCX, atau TXT ke notebook. File disimpan ke storage server, lalu dipecah menjadi chunks dan di-embed menggunakan Gemini secara background (tidak memblokir response).

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
| `file` | file   | ✅        | File PDF, PPTX, DOCX, atau TXT, maksimal 20MB |

**Response `201 Created`**

Response dikembalikan langsung setelah file terupload ke storage server. Proses chunking dan embedding berjalan di background.

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
      "fileUrl": "https://storage.sibernote.com/documents/Sistem_Operasi.pdf",
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

> **Catatan OCR & parsing:**
> - **PDF:** Halaman yang terdeteksi sebagai scan/gambar (teks < 30 karakter) di-render lalu di-OCR dengan Tesseract (`ind+eng`).
> - **PPTX:** Teks slide diambil dari shape seperti biasa; gambar tertanam di slide juga di-OCR otomatis (Tesseract `ind+eng`) lalu digabung ke konten slide. Hasil OCR yang terlalu pendek (< 30 karakter, misalnya logo) diabaikan.
> - **DOCX:** Teks paragraf, heading, dan tabel diambil dari AST; gambar tertanam juga di-OCR otomatis (Tesseract `ind+eng`). `totalPages` selalu `1`.
> - **TXT:** Konten dibaca langsung sebagai UTF-8, dipecah per 3000 karakter. Tidak ada OCR. `totalPages` selalu `1`.
>
> Proses OCR lebih lambat dibanding ekstraksi teks biasa.

**Error Responses**

| Status | Kondisi                                         |
|--------|-------------------------------------------------|
| `401`  | Tidak terautentikasi                            |
| `401`  | Tipe file tidak didukung (bukan PDF, PPTX, DOCX, atau TXT) |
| `401`  | File tidak disertakan                           |
| `404`  | Notebook tidak ditemukan atau bukan milik user  |
| `500`  | Kesalahan server / gagal upload ke storage server   |

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
        "fileUrl": "https://storage.sibernote.com/documents/Sistem_Operasi.pdf",
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

Menghapus dokumen beserta seluruh chunks dan file di storage server. Hanya bisa dilakukan oleh pemilik notebook yang memuat dokumen tersebut.

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

> Cascade delete: semua `chunks` dan file di storage server yang terkait dokumen ini ikut dihapus.

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
  PPTX: teks shape + OCR gambar
  DOCX: teks paragraf/heading/tabel + OCR gambar
  TXT:  baca langsung sebagai UTF-8
         │
         ▼
  embed semua chunks (Gemini)
         │
         ▼
  parseStatus: "done"
  totalPages: N  (DOCX dan TXT selalu 1)
  → dokumen siap dipakai
```

> **OCR otomatis:**
> - **PDF:** Halaman dengan teks < 30 karakter di-render ke PNG lalu di-OCR (Tesseract `ind+eng`). Halaman yang gagal di-OCR di-skip tanpa menghentikan proses keseluruhan.
> - **PPTX:** Gambar tertanam di slide di-OCR saat parsing; teks hasil OCR digabung dengan teks shape. Hasil OCR < 30 karakter diabaikan.
> - **DOCX:** Gambar tertanam di-OCR saat parsing; teks hasil OCR digabung dengan teks paragraf/heading. Hasil OCR < 30 karakter diabaikan.
> - **TXT:** Tidak ada OCR. Konten dibaca langsung sebagai UTF-8 dan dipecah per 3000 karakter.

---

## Chat AI

Semua endpoint chat membutuhkan `accessToken` yang valid di header:

```
Authorization: Bearer <accessToken>
```

Chat berjalan langsung di level notebook — tidak ada manajemen sesi. Setiap notebook punya satu riwayat percakapan.

---

### Get Riwayat Pesan

Mengambil seluruh riwayat percakapan pada notebook, diurutkan dari yang paling lama.

```
GET /chat/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Response `200 OK`**
```json
{
  "status": "success",
  "message": "berhasil dapet riwayat pesan",
  "data": {
    "messages": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c20",
        "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
        "role": "user",
        "content": "Apa itu virtual memory?",
        "citations": [],
        "sourceType": null,
        "createdAt": "2026-10-08T10:01:00.000Z"
      },
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c21",
        "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
        "role": "assistant",
        "content": "Virtual memory adalah mekanisme yang memungkinkan sistem operasi menggunakan storage sebagai perpanjangan RAM [1]. Teknik yang umum digunakan adalah paging [2].",
        "citations": [
          {
            "citationIndex": 1,
            "documentId": "665f1a2b3c4d5e6f7a8b9c0f",
            "documentTitle": "Sistem_Operasi",
            "pageStart": 31,
            "pageEnd": 33,
            "chunkContent": "Virtual memory adalah mekanisme yang memungkinkan..."
          },
          {
            "citationIndex": 2,
            "documentId": "665f1a2b3c4d5e6f7a8b9c0f",
            "documentTitle": "Sistem_Operasi",
            "pageStart": 45,
            "pageEnd": 47,
            "chunkContent": "Paging adalah teknik manajemen memori yang..."
          }
        ],
        "sourceType": "document",
        "createdAt": "2026-10-08T10:01:05.000Z"
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

### Kirim Pesan

Endpoint utama RAG — menerima pertanyaan user, menjalankan pipeline RAG, dan mengembalikan jawaban Gemini beserta citations.

```
POST /chat/:notebookId
```

**URL Params**

| Param        | Keterangan          |
|--------------|---------------------|
| `notebookId` | ID notebook MongoDB |

**Request Body**

| Field     | Aturan                    |
|-----------|---------------------------|
| `message` | Wajib, tidak boleh kosong |

```json
{
  "message": "Apa itu virtual memory?"
}
```

**Response `200 OK`**

Kedua pesan (user dan assistant) disimpan ke database. Response mengembalikan keduanya.

```json
{
  "status": "success",
  "message": "berhasil kirim pesan",
  "data": {
    "userMessage": {
      "_id": "665f1a2b3c4d5e6f7a8b9c20",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "role": "user",
      "content": "Apa itu virtual memory?",
      "citations": [],
      "sourceType": null,
      "createdAt": "2026-10-08T10:01:00.000Z"
    },
    "assistantMessage": {
      "_id": "665f1a2b3c4d5e6f7a8b9c21",
      "notebookId": "665f1a2b3c4d5e6f7a8b9c0e",
      "role": "assistant",
      "content": "Virtual memory adalah mekanisme yang memungkinkan sistem operasi menggunakan storage sebagai perpanjangan RAM [1]. Teknik yang umum digunakan adalah paging [2].",
      "citations": [
        {
          "citationIndex": 1,
          "documentId": "665f1a2b3c4d5e6f7a8b9c0f",
          "documentTitle": "Sistem_Operasi",
          "pageStart": 31,
          "pageEnd": 33,
          "chunkContent": "Virtual memory adalah mekanisme yang memungkinkan..."
        },
        {
          "citationIndex": 2,
          "documentId": "665f1a2b3c4d5e6f7a8b9c0f",
          "documentTitle": "Sistem_Operasi",
          "pageStart": 45,
          "pageEnd": 47,
          "chunkContent": "Paging adalah teknik manajemen memori yang..."
        }
      ],
      "sourceType": "document",
      "createdAt": "2026-10-08T10:01:05.000Z"
    }
  }
}
```

**Nilai `sourceType`**

| Nilai        | Kondisi                                                        |
|--------------|----------------------------------------------------------------|
| `"document"` | Semua jawaban bersumber dari chunks dokumen                    |
| `"ai"`       | Tidak ada chunk relevan, Gemini menjawab dari pengetahuan AI   |
| `"mixed"`    | Sebagian dari dokumen, sebagian dari pengetahuan AI            |
| `null`       | Pesan role `"user"` — tidak relevan                           |

**Error Responses**

| Status | Kondisi                                                                              |
|--------|--------------------------------------------------------------------------------------|
| `400`  | Validasi gagal (`message` kosong)                                                    |
| `401`  | Tidak terautentikasi                                                                 |
| `404`  | Notebook tidak ditemukan atau bukan milik user                                       |
| `422`  | Tidak ada dokumen di notebook yang `parseStatus: "done"` — chat belum bisa berjalan |
| `500`  | Gagal mendapatkan jawaban, silakan coba lagi.                                        |

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
      accessToken expired (1 jam)?
             │
             └── POST /user/refresh + refreshToken → accessToken baru
             │
             ▼
      Logout? → POST /user/logout + refreshToken → token dicabut dari DB
```
