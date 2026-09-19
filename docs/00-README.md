# SIMASET — Sistem Inventaris & Pelacakan Aset Rumah Sakit

Dokumentasi perencanaan lengkap untuk membangun sistem pelacakan aset berbasis QR Code
untuk lingkungan rumah sakit.

Versi dokumen: **1.0**
Tanggal: **19 September 2026**
Status: **Disetujui untuk mulai implementasi v1**

---

## Daftar Dokumen

| # | Dokumen | Isi |
|---|---------|-----|
| 01 | [Project Brief](01-project-brief.md) | Masalah, solusi, sasaran, batasan, definisi sukses |
| 02 | [PRD](02-prd.md) | Kebutuhan produk, user stories, acceptance criteria, cakupan v1 |
| 03 | [ERD & Skema Data](03-erd.md) | Diagram relasi, seluruh tabel, enum, index, aturan integritas |
| 04 | [Arsitektur Teknis](04-technical-architecture.md) | Stack, struktur kode, alur teknis, keputusan arsitektur |
| 05 | [User Flow](05-user-flows.md) | Alur penggunaan per peran, dari label sampai riwayat |
| 06 | [Spesifikasi API](06-api-spec.md) | Endpoint, payload, kode error |
| 07 | [RBAC & Keamanan](07-rbac-security.md) | Peran, matriks izin, halaman publik, ancaman & mitigasi |
| 08 | [QR & Labeling](08-qr-labeling.md) | Format QR, desain label, bahan, alur cetak ulang |
| 09 | [Deployment & Operasional](09-deployment-ops.md) | Docker Compose, backup, monitoring, runbook |
| 10 | [Roadmap](10-roadmap.md) | Milestone, urutan pengerjaan, estimasi |
| 11 | [Asumsi & Pertanyaan Terbuka](11-open-questions.md) | Keputusan yang saya ambil sendiri, dan yang masih perlu jawaban |

## Cara membaca

Kalau Anda akan mulai coding hari ini: baca **02 → 03 → 04 → 09**.
Kalau Anda akan mempresentasikan ke manajemen RS: baca **01 → 05 → 10**.
Kalau Anda sedang mengevaluasi risiko: baca **07 → 11**.

## Ringkasan keputusan yang mengikat

Keputusan berikut sudah final untuk v1 dan menjadi dasar seluruh dokumen.
Mengubahnya berarti merevisi ERD.

1. **Lingkup: aset per-unit saja.** Barang habis pakai (stok kuantitas) tidak masuk v1,
   tetapi skema menyiapkan ruang untuk itu.
2. **Satu rumah sakit, skema siap multi-RS.** Semua tabel utama membawa `organization_id`
   sejak hari pertama.
3. **Riwayat bersifat append-only.** Tidak ada edit, tidak ada hapus. Koreksi dilakukan
   melalui entri baru bertipe `CORRECTION`.
4. **Peminjaman tanpa approval.** Peminjam boleh bukan pengguna sistem — cukup nama,
   nomor HP, dan keperluan. Tanggal jatuh tempo bersifat opsional.
5. **Kalibrasi & pemeliharaan versi ringkas.** Jadwal berikutnya, unggah sertifikat,
   dashboard jatuh tempo. Bukan modul work order penuh.
6. **Halaman hasil scan QR publik, data terbatas.** Tanpa login hanya tampil informasi
   non-sensitif.
7. **Online-only.** Tidak ada sinkronisasi offline di v1.
8. **Notifikasi lewat email.**
9. **Skala kecil:** di bawah 2.000 aset dan 50 pengguna.
10. **Deploy di VPS sendiri** dengan Docker Compose, foto di MinIO.
