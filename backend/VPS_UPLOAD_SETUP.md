# Konfigurasi Upload File di VPS

Upload file sekarang disimpan langsung di disk VPS, bukan Cloudinary.
File di-serve oleh Express sebagai static files di path `/uploads`.

---

## Struktur Folder Upload

```
{UPLOADS_DIR}/
├── documents/
│   └── {userId}/
│       └── {notebookId}/
│           └── nama_file.pdf   ← dokumen user
└── avatars/
    └── {userId}/
        └── avatar.jpg          ← foto profil (selalu overwrite)
```

---

## Environment Variables

Isi di file `.env`:

```env
# URL publik yang diakses FE untuk membuka file.
# Harus sesuai dengan domain/IP + port backend kamu.
UPLOAD_BASE_URL=https://api.yourdomain.com/uploads

# Path absolut di VPS tempat file disimpan.
UPLOADS_DIR=/var/www/sibernote/uploads
```

---

## Setup di VPS (tanpa Docker)

### 1. Buat folder uploads & set permission

```bash
sudo mkdir -p /var/www/sibernote/uploads
sudo chown -R $USER:$USER /var/www/sibernote/uploads
chmod 755 /var/www/sibernote/uploads
```

### 2. Isi `.env`

```env
UPLOAD_BASE_URL=https://api.yourdomain.com/uploads
UPLOADS_DIR=/var/www/sibernote/uploads
```

### 3. Nginx — expose `/uploads` sebagai static (opsional tapi direkomendasikan)

Daripada lewat Express, biarkan Nginx langsung serve file statis supaya lebih efisien.

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    # ... konfigurasi SSL ...

    # Serve file upload langsung dari Nginx
    location /uploads/ {
        alias /var/www/sibernote/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        # Batasi akses hanya GET/HEAD
        limit_except GET HEAD { deny all; }
    }

    # Forward request lain ke Node
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Catatan:** Jika Nginx serve `/uploads/` langsung, set `UPLOAD_BASE_URL` ke
> `https://api.yourdomain.com/uploads` — sama saja, tapi requestnya tidak masuk ke Node.

---

## Setup dengan Docker

### docker run

```bash
docker run -d \
  --name sibernote-backend \
  -p 8080:8080 \
  -v /var/www/sibernote/uploads:/app/uploads \
  --env-file .env \
  sibernote-backend:latest
```

### docker-compose.yml

```yaml
services:
  backend:
    build: .
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - sibernote_uploads:/app/uploads
    restart: unless-stopped

volumes:
  sibernote_uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/www/sibernote/uploads
```

Pastikan env:
```env
UPLOADS_DIR=/app/uploads
UPLOAD_BASE_URL=https://api.yourdomain.com/uploads
```

---

## Backup

File upload **tidak termasuk** dalam image Docker. Backup folder secara terpisah:

```bash
# Backup manual
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/www/sibernote/uploads

# Atau pakai cron (setiap hari jam 02:00)
0 2 * * * tar -czf /backups/uploads_$(date +\%Y\%m\%d).tar.gz /var/www/sibernote/uploads
```

---

## Troubleshooting

| Masalah | Kemungkinan penyebab | Solusi |
|---|---|---|
| Upload gagal "EACCES" | Permission folder salah | `chown -R node:node /app/uploads` (Docker) atau `chown $USER` (VPS) |
| File tidak bisa diakses (404) | `UPLOAD_BASE_URL` salah | Pastikan nilainya sama persis dengan URL yang bisa diakses dari browser |
| File hilang setelah restart Docker | Volume tidak di-mount | Tambahkan `-v /host/path:/app/uploads` saat `docker run` |
| Avatar tidak update di FE | Browser cache gambar lama | Tambahkan cache-busting di FE, misal `?t=` + timestamp saat update |
