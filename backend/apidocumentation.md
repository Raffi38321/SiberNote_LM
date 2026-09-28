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

| Status | Kondisi                                              |
|--------|------------------------------------------------------|
| `400`  | Validasi gagal                                       |
| `401`  | Email atau username sudah terdaftar                  |
| `500`  | Kesalahan server                                     |

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

| Key             | Value                    | Required |
|-----------------|--------------------------|----------|
| `Authorization` | `Bearer <accessToken>`   | ✅        |

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

**Headers**

| Key             | Value                  | Required |
|-----------------|------------------------|----------|
| `Authorization` | `Bearer <accessToken>` | ✅        |

**Validasi**

| Field         | Aturan  |
|---------------|---------|
| `title`       | Wajib   |
| `description` | Wajib   |

**Request Body**
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

| Status | Kondisi                           |
|--------|-----------------------------------|
| `400`  | Validasi gagal                    |
| `401`  | Tidak terautentikasi              |
| `404`  | User tidak ditemukan              |
| `500`  | Kesalahan server                  |

---

### Get All Notebooks

Mengambil semua notebook milik user yang sedang login, diurutkan dari yang terbaru diupdate.

```
GET /notebooks
```

**Headers**

| Key             | Value                  | Required |
|-----------------|------------------------|----------|
| `Authorization` | `Bearer <accessToken>` | ✅        |

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

Menghapus notebook berdasarkan ID. Hanya bisa dilakukan oleh pemilik notebook.

```
DELETE /notebooks/:notebookId
```

**Headers**

| Key             | Value                  | Required |
|-----------------|------------------------|----------|
| `Authorization` | `Bearer <accessToken>` | ✅        |

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

**Error Responses**

| Status | Kondisi                                          |
|--------|--------------------------------------------------|
| `401`  | Tidak terautentikasi                             |
| `404`  | Notebook tidak ditemukan atau bukan milik user   |
| `500`  | Kesalahan server                                 |

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
