SiberNoteLM

Aplikasi web asisten belajar berbasis AI untuk mahasiswa. Pengguna mengunggah dokumen materi kuliah, lalu berinteraksi dengan AI untuk bertanya, merangkum per bab, dan membuat flashcard. Setiap jawaban disertai rujukan ke halaman dokumen sumber.

Proyek mata kuliah Manajemen Proyek Perangkat Lunak, dikembangkan dengan metode Scrum oleh kelompok 2 SiberNoteLM.

Daftar Isi
Gambaran Umum
Latar Belakang
Fitur
Lingkup dan Batasan
Cara Kerja
Teknologi
Memulai
Tim
Status Proyek
Gambaran Umum

SiberNoteLM menjawab pertanyaan berdasarkan dokumen yang diunggah pengguna dan sumber luar jika jawaban tidak tersedia pada dokumen yang pengguna unggah. Jawaban AI memuat tag rujukan (misalnya PDF, hlm. 12) yang membuka pratinjau halaman sumber, sehingga pengguna dapat memverifikasi jawaban.

Antarmuka berupa ruang kerja tiga kolom:

Kolom	Fungsi
Sumber	Daftar dokumen dan pratinjau halaman
Chat AI	Tanya jawab, ringkasan per bab, dan pembuatan flashcard
Ruang Catatan	Catatan yang disimpan pengguna
Latar Belakang

Mahasiswa sering kesulitan mengelola materi kuliah yang tersebar di banyak berkas, dan ingin jawaban AI yang bisa dilacak ke sumbernya. Kebutuhan pengguna dirumuskan dari survei terhadap 32 mahasiswa:

53,1% responden kesulitan menyatukan materi kuliah yang tercecer.
87,5% responden mewajibkan penunjuk nomor halaman pada rangkuman dan jawaban AI (prioritas tertinggi).
65,6% responden memilih belajar bertahap per bab dibandingkan rangkuman utuh satu buku.
90,6% responden (29 dari 32) menilai fitur evaluasi mandiri seperti flashcard penting.

Hasil survei ini menjadi dasar fitur sitasi halaman, pelajari per bab, dan flashcard.

Fitur

Halaman awal

Landing page

Dokumen dan AI

Unggah dokumen PDF, DOCX, PPTX, dan TXT (termasuk PDF hasil pindai melalui OCR)
Chat AI dengan rujukan halaman pada setiap jawaban
Pratinjau dokumen dari tag rujukan
Riwayat obrolan
Pelajari per bab: pemetaan bab dokumen dan ringkasan per bab
Flashcard: pembuatan kartu belajar dari dokumen terpilih (3, 5, 7, atau 10 kartu)

Dashboard catatan

Daftar catatan dengan jumlah total, sumber, dan tanggal
Pengurutan berdasarkan terbaru dan abjad (A–Z)
Pencarian catatan
Pagination (10 catatan per halaman)
Sematkan catatan

Akun

Registrasi dan login
Pengaturan profil: foto, username, dan password
Lingkup dan Batasan

Di dalam lingkup: pengolahan dokumen teks (PDF, DOCX, PPTX, dan TXT) dengan pipeline hybrid teks dan OCR, tanya jawab berbasis dokumen dengan sitasi halaman, interaksi terpandu dan ringkasan per bab, serta flashcard.

Di luar lingkup (tidak dibangun pada proyek ini):

Visualisasi mind map atau diagram alur konsep.
Ringkasan suara otomatis (audio overview).
Pemrosesan konten video YouTube.
Berbagi dokumen atau catatan ke ruang publik. Seluruh berkas dan catatan bersifat pribadi pada ruang kerja masing-masing pengguna.

Batasan unggahan: maksimal 100 halaman atau 20 MB per berkas. Batas ini menjaga pemrosesan OCR dan kuota API model bahasa tetap dalam kapasitas server.

Cara Kerja

Aplikasi memakai pendekatan retrieval-augmented generation (RAG):

Ingest. Dokumen yang diunggah dipecah menjadi chunk beserta metadata halaman. Dokumen hasil pindai diproses dengan OCR. Embedding setiap chunk disimpan di MongoDB Atlas.
Retrieval. Pertanyaan pengguna dicocokkan dengan chunk melalui MongoDB Atlas Vector Search (maksimal 5 chunk).
Generation. Chunk hasil pencarian, beserta dua percakapan terakhir sebagai konteks, dikirim ke model Gemini Flash.
Rujukan. Respons menyertakan sitasi (dokumen dan halaman) yang ditampilkan sebagai tag rujukan.

Penomoran halaman mengikuti jenis dokumen: PDF memakai halaman asli, PPTX memakai nomor slide, sedangkan TXT dan DOCX dihitung per 3000 karakter karena format tersebut tidak menyimpan nomor halaman yang dapat dibaca secara andal.


Dikembangkan dalam lima sprint. Fitur Flashcard dan Pelajari per bab dikerjakan pada Sprint 4.
