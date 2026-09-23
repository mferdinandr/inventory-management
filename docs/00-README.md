# SIMASET — Sistem Inventaris & Pelacakan Aset Rumah Sakit

Dokumentasi perencanaan lengkap untuk membangun produk SaaS pelacakan aset berbasis QR Code
bagi rumah sakit.

Versi dokumen: **2.1**
Tanggal: **23 September 2026**
Status: **Perencanaan selesai — seluruh keputusan terkunci, siap mulai M0**

---

## Daftar Dokumen

| # | Dokumen | Isi |
|---|---------|-----|
| 01 | [Project Brief](01-project-brief.md) | Masalah, solusi, sasaran, batasan, definisi sukses |
| 02 | [PRD](02-prd.md) | Kebutuhan produk, acceptance criteria, pembagian MVP dan v1.1 |
| 03 | [ERD & Skema Data](03-erd.md) | Diagram relasi, seluruh tabel, enum, index, aturan integritas |
| 04 | [Arsitektur Teknis](04-technical-architecture.md) | Stack, struktur kode, alur teknis, keputusan arsitektur |
| 05 | [User Flow](05-user-flows.md) | Alur penggunaan per peran, dari label sampai riwayat |
| 06 | [Spesifikasi API](06-api-spec.md) | Endpoint, payload, kode error |
| 07 | [RBAC & Keamanan](07-rbac-security.md) | Peran, matriks izin, halaman publik, ancaman & mitigasi |
| 08 | [QR & Labeling](08-qr-labeling.md) | Format QR, desain label, bahan, alur cetak ulang |
| 09 | [Deployment & Operasional](09-deployment-ops.md) | Docker Compose, backup, monitoring, runbook |
| 10 | [Roadmap](10-roadmap.md) | Milestone, urutan pengerjaan, estimasi |
| 11 | [Keputusan, Asumsi & Pertanyaan Terbuka](11-open-questions.md) | 42 keputusan final, 19 asumsi terkonfirmasi, dan lembar kerja onboarding pelanggan |

## Cara membaca

Kalau Anda akan mulai coding hari ini: baca **02 → 03 → 04 → 09**.
Kalau Anda akan mempresentasikan ke manajemen RS: baca **01 → 05 → 10**.
Kalau Anda sedang mengevaluasi risiko: baca **07 → 11**.
Kalau Anda perlu mengumpulkan informasi dari pelanggan baru: pakai **11 bagian C.2** sebagai lembar kerja.

## Bentuk produk

**SIMASET adalah produk SaaS multi-tenant**, bukan sistem pesanan untuk satu rumah sakit.
Satu aplikasi dan satu basis data melayani banyak rumah sakit, dipisahkan oleh
`organization_id` dan Row Level Security. Pemilik platform membuat organisasi baru secara
manual lewat panel operator; tidak ada pendaftaran mandiri di v1.

Sasarannya tetap khusus rumah sakit. Kalibrasi alat medis, sertifikat, dan istilah instalasi
adalah pembeda produk ini — bukan beban yang perlu digeneralisasi.

## Ringkasan keputusan yang mengikat

Keputusan berikut menjadi dasar seluruh dokumen. Mengubahnya berarti merevisi ERD.

1. **Produk SaaS multi-tenant.** Satu instans, satu basis data, banyak rumah sakit.
2. **Lingkup: aset per-unit saja.** Barang habis pakai (stok kuantitas) tidak masuk,
   tetapi skema menyiapkan ruang untuk itu.
3. **Riwayat bersifat append-only.** Tidak ada edit, tidak ada hapus. Koreksi dilakukan
   melalui entri baru bertipe `CORRECTION`.
4. **Penghapusan aset dapat dibatalkan 30 hari.** Setelah itu final, tetapi barisnya tetap
   tersimpan selamanya.
5. **Peminjaman tanpa approval.** Peminjam boleh bukan pengguna sistem — cukup nama,
   nomor HP, dan keperluan. Tanggal jatuh tempo bersifat opsional.
6. **Kalibrasi & pemeliharaan versi ringkas.** Jadwal berikutnya, unggah sertifikat,
   dashboard jatuh tempo. Bukan modul work order penuh.
7. **Halaman hasil scan QR publik, data terbatas.** Satu domain bersama untuk semua
   pelanggan, dengan `public_id` acak yang unik global.
8. **Online-only.** Tidak ada sinkronisasi offline di v1.
9. **Notifikasi lewat email.**
10. **Kuota per organisasi:** 2.000 aset, 20 GB, 50 pengguna. Dapat dinaikkan per pelanggan.
11. **Deploy di VPS sendiri** dengan Docker Compose, otomatis dari GitHub Actions.
    Foto di Cloudflare R2 untuk produksi, MinIO untuk pengembangan lokal.
12. **Onboarding manual.** Pemilik platform membuat organisasi lewat panel operator.
    Penagihan diurus di luar sistem.
13. **Kode berbahasa Inggris, antarmuka berbahasa Indonesia.**
14. **Organisasi baru dimulai tanpa kategori** — halaman kosong memuat panduan, bukan
    tombol yang mengisinya.

## Konvensi singkat

| Hal | Nilai |
|---|---|
| Runtime | Node 22 LTS, pnpm |
| Lint & format | Biome |
| Pengujian | Vitest, Playwright |
| CI/CD | GitHub Actions — lint, tes, uji isolasi tenant, lalu deploy ke VPS |
| Nama paket & database | `simaset` |
| Domain | `{DOMAIN}` — belum ditetapkan, datang dari `APP_URL` |

## Rencana rilis

**MVP, 6 minggu** — fondasi multi-tenant, master data, panel operator, aset, QR dan label,
halaman publik, riwayat dengan foto, dan peminjaman. Untuk demo dan uji internal saja.

**v1.1, sekitar 3 minggu berikutnya** — kalibrasi, dashboard, laporan, notifikasi email,
impor massal, 2FA, dan pengerasan keamanan. **Data pelanggan sungguhan baru boleh masuk
setelah tahap ini.**

Skema basis data dibangun **lengkap sejak minggu pertama**, termasuk tabel untuk fitur yang
ditunda. Yang mahal bukan menulis tabelnya, melainkan menambahkannya ke basis data yang
sudah berisi data pelanggan.
