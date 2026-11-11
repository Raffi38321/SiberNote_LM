# Task: Implement CI/CD Pipeline for SiberNote LM

Bertindak sebagai Senior DevOps Engineer. Implementasikan CI/CD pipeline untuk project SiberNote LM menggunakan GitHub Actions, GitHub Container Registry (GHCR), Docker Compose, dan SSH deployment ke VPS Sumopod.

## 1. Project Context

- Project: SiberNote LM
- Production branch: `main`
- Deployment target: VPS Sumopod
- Container orchestration: Docker Compose
- Container registry: GitHub Container Registry (GHCR)
- CI/CD platform: GitHub Actions
- Automated testing: Belum tersedia
- Backend: Node.js + TypeScript + Express
- Frontend: React

Jangan mengasumsikan konfigurasi project. Periksa source code dan file konfigurasi aktual terlebih dahulu.

## 2. Initial Repository Audit

Sebelum melakukan perubahan:

1. Periksa struktur direktori repository.
2. Periksa `docker-compose.yml`.
3. Periksa Dockerfile backend dan frontend.
4. Periksa konfigurasi Nginx jika tersedia.
5. Periksa `package.json` backend dan frontend.
6. Identifikasi service, port, environment variables, network, dan volume.
7.
8. Identifikasi konfigurasi health check yang sudah tersedia.

Jangan membaca atau menampilkan isi `.env`, private key, password, API key, maupun credential lainnya.

Buat ringkasan temuan dan rencana implementasi sebelum mengubah konfigurasi.

## 3. CI Pipeline

Buat workflow:

`.github/workflows/ci-cd.yml`

Trigger:

- Pull Request ke `main`: menjalankan CI saja.
- Push ke `main`: menjalankan CI kemudian CD.
- Perubahan dokumentasi saja boleh dikecualikan jika tidak memengaruhi deployment.

Tahapan CI:

1. Checkout repository.
2. Setup Node.js sesuai versi yang digunakan project.
3. Install dependencies menggunakan lockfile.
4. Jalankan lint jika script tersedia.
5. Jalankan automated test jika tersedia.
6. Validasi Docker Compose.
7. Build Docker image backend.
8. Build Docker image frontend.

Karena automated test belum tersedia:

- Jangan membuat test palsu.
- Jangan menganggap build berhasil berarti seluruh fungsi aplikasi sudah teruji.
- Buat struktur agar unit test dapat ditambahkan kemudian.
- Berikan catatan bahwa integration test belum tersedia.

## 4. Docker Image dan GHCR

Gunakan GitHub Container Registry.

Image yang dihasilkan:

- `ghcr.io/OWNER/sibernote-backend`
- `ghcr.io/OWNER/sibernote-frontend`

Gunakan:

- GitHub Actions `GITHUB_TOKEN`.
- `docker/login-action`.
- `docker/build-push-action`.
- `docker/metadata-action` jika diperlukan.

Tag image:

- Commit SHA.
- Tag `latest` khusus untuk branch production.

Ketentuan:

- Gunakan tag SHA sebagai referensi deployment.
- Jangan menggunakan image yang hanya mengandalkan tag `latest`.
- Aktifkan Docker BuildKit dan caching.
- Gunakan minimal permissions untuk GitHub Actions.
- Pastikan image tidak memuat file `.env`, credential, atau secret.

## 5. Continuous Deployment

Deployment hanya boleh berjalan setelah CI berhasil dan image berhasil dipush.

Gunakan SSH untuk menghubungkan GitHub Actions ke VPS.

GitHub Secrets yang diperlukan:

- `VPS_HOST`
- `VPS_USERNAME`
- `VPS_SSH_KEY`
- `VPS_DEPLOY_PATH`

Deployment flow:

1. Connect ke VPS melalui SSH.
2. Masuk ke direktori deployment.
3. Login ke GHCR jika repository image private.
4. Pull image berdasarkan commit SHA.
5. Jalankan Docker Compose untuk memperbarui backend dan frontend.
6. Jalankan health check.
7. Laporkan status deployment.

Jangan menyalin `.env` production dari GitHub repository ke VPS.

Gunakan environment file yang sudah tersimpan secara aman di VPS.

## 6. Docker Compose

Sesuaikan `docker-compose.yml` agar mendukung dua mode:

**Development**

- Tetap dapat menggunakan Dockerfile lokal.
- Tidak mengganggu workflow development yang sudah ada.

**Production**

- Menggunakan image dari GHCR.
- Menggunakan tag image berdasarkan commit SHA.
- Mempertahankan environment variables dari VPS.
- Mempertahankan network dan persistent volumes.

Jika diperlukan, buat file terpisah:

`docker-compose.prod.yml`

Ketentuan penting:

- Jangan menghapus service MongoDB atau Kafka yang sudah berjalan.
- Jangan menghapus persistent volume.
- Jangan menggunakan `docker compose down -v`.
- Jangan menghapus data database ketika deployment.
- Jangan melakukan perubahan arsitektur yang tidak diperlukan.

## 7. Health Check dan Rollback

Implementasikan health check berdasarkan endpoint kesehatan aplikasi yang benar-benar tersedia.

Jika belum ada endpoint:

- Identifikasi endpoint yang paling tepat.
- Usulkan penambahan endpoint health check.
- Pisahkan pemeriksaan kesiapan aplikasi dari sekadar status container.

Tambahkan strategi rollback:

- Simpan referensi image versi deployment sebelumnya.
- Jika deployment gagal, kembalikan image ke versi sebelumnya.
- Jangan melakukan rollback dengan menghapus data persistent.
- Pastikan kegagalan health check menyebabkan deployment dinyatakan gagal.

## 8. Security Requirements

Terapkan prinsip least privilege:

- Jangan hardcode credential.
- Jangan commit file `.env`.
- Jangan menampilkan secret dalam log.
- Batasi GitHub Actions permissions.
- Gunakan SSH key authentication.
- Validasi host SSH menggunakan known_hosts atau mekanisme host verification yang aman.
- Jangan menonaktifkan SSH host key verification.
- Gunakan immutable image tags untuk deployment.

## 9. Deliverables

Implementasikan dan dokumentasikan:

1. `.github/workflows/ci-cd.yml`
2. `docker-compose.prod.yml` jika diperlukan.
3. Dockerfile improvements jika diperlukan.
4. Health check endpoint jika diperlukan.
5. Deployment script di VPS jika diperlukan.
6. Dokumentasi `docs/CI-CD.md`.

Dokumentasi harus mencakup:

- Arsitektur pipeline.
- Daftar GitHub Secrets.
- Cara mengonfigurasi GHCR.
- Cara menyiapkan VPS.
- Cara menjalankan deployment pertama.
- Cara melakukan rollback.
- Cara troubleshooting pipeline.

## 10. Working Rules

- Audit terlebih dahulu sebelum mengubah file.
- Jangan mengganti teknologi yang sudah digunakan project.
- Jangan menghapus konfigurasi yang masih diperlukan.
- Jangan mengarang endpoint, script, atau environment variable.
- Jangan mengubah konfigurasi development tanpa alasan yang jelas.
- Hindari perubahan yang tidak berkaitan dengan CI/CD.
- Jika ada informasi yang belum diketahui dan berpengaruh terhadap deployment, tanyakan sebelum mengambil keputusan.
- Setelah implementasi, periksa kembali seluruh file yang berubah.
- Jalankan validasi yang memungkinkan di environment lokal.

## 11. Final Report

Setelah implementasi, berikan laporan:

1. File yang dibuat.
2. File yang dimodifikasi.
3. Penjelasan alur CI/CD.
4. GitHub Secrets yang harus dikonfigurasi.
5. Konfigurasi yang harus dilakukan di VPS.
6. Hasil validasi.
7. Hal yang belum dapat diuji.
8. Langkah deployment pertama.

Target akhir:

Setiap push atau merge ke branch `main` akan otomatis menjalankan CI, membangun Docker image, mengirim image ke GHCR, dan melakukan deployment ke VPS Sumopod tanpa menghapus data persistent SiberNote LM.
