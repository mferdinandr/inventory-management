# SIMASET — Dokumentasi Perencanaan

Versi dokumen: **3.0**
Tanggal: **12 Oktober 2026**
Status: **Dirombak dari SaaS multi-tenant menjadi aplikasi satu rumah sakit yang jauh lebih sederhana.**

---

## Daftar Dokumen

| # | Dokumen | Isi |
|---|---------|-----|
| 01 | [Project Brief](01-project-brief.md) | Masalah, solusi, ruang lingkup |
| 02 | [PRD](02-prd.md) | Kebutuhan dan acceptance criteria |
| 03 | [ERD](03-erd.md) | Tabel, enum, aturan integritas |
| 04 | [Arsitektur Teknis](04-technical-architecture.md) | Stack, struktur kode, alur teknis |
| 05 | [User Flow](05-user-flows.md) | Alur per peran |
| 06 | [Spesifikasi API](06-api-spec.md) | Endpoint dan kode error |
| 07 | [RBAC & Keamanan](07-rbac-security.md) | Peran, matriks izin |
| 08 | [QR & Label](08-qr-labeling.md) | Isi QR, label, penempelan |
| 09 | [Deployment](09-deployment-ops.md) | Docker Compose, cadangan |
| 10 | [Roadmap](10-roadmap.md) | Milestone |
| 11 | [Keputusan & Pertanyaan Terbuka](11-open-questions.md) | Keputusan final dan yang perlu dikonfirmasi |
| 12 | [Data Contoh](12-data-contoh.md) | Analisis dua daftar inventaris RS ([`contoh/`](contoh/)) |

## Keputusan yang mengikat

1. **Satu rumah sakit.** Tidak ada multi-tenant, organisasi, RLS, maupun panel operator.
2. **Tanpa gambar.** Tidak ada unggah foto, tidak ada R2/MinIO. Semua data berupa teks.
3. **Hanya barang besar / wadah yang diberi QR.** Isi wadah adalah baris teks + jumlah.
4. **Dua jalur, tiap barang menempuh satu jalur.** Barang yang perlu sterilisasi:
   Operasi → CSSD → Operasi. Alat besar tanpa sterilisasi (mesin, meja, TV):
   Operasi ⇄ Kantor Alkes. Hanya Operasi dan CSSD yang memindahkan barang.
5. **Empat peran:** `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN`. Alkes memantau dan
   **mencatat maintenance** (perbaikan, pemeliharaan, kalibrasi) lewat tiga form detail.
6. **Jumlah dapat diperbarui** oleh Operasi (selama barang tidak di CSSD) dan CSSD
   (saat pengecekan). `SUPERADMIN` kapan saja. Ada kolom jumlah dan jumlah rusak.
   Form pendaftaran memuat detail alat dan pembelian.
7. **Riwayat append-only.** Setiap kirim, kembali, dan perubahan jumlah tercatat dan tidak
   bisa diedit atau dihapus.
8. **Online-only, login wajib.** Tidak ada halaman publik.
9. **Kode berbahasa Inggris, antarmuka berbahasa Indonesia.**

## Yang dibuang dari versi 2.x

Multi-tenant, panel operator, kuota, foto & lampiran, peminjaman, mutasi antar
ruangan, vendor, penghapusan 30 hari, koreksi riwayat, notifikasi email, impor Excel, 2FA,
halaman publik, pg-boss, dan 6 peran lama. Semuanya ada di riwayat git bila diperlukan.

## Cara membaca

Mulai coding: **02 → 03 → 12 → 04 → 09**. Presentasi ke manajemen: **01 → 05 → 10**.
