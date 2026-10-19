# SIMASET — Pelacakan Barang & Perlengkapan Ruang Operasi

Aplikasi web sederhana untuk melacak barang besar dan wadah perlengkapan (set instrumen)
yang berpindah antara **Ruang Operasi** dan **CSSD/Steril** (khusus yang perlu sterilisasi).
**Kantor Alkes** memantau; semua peran dapat mencatat maintenance.

<<<<<<< HEAD
> **Status: perencanaan selesai (v3.0), belum ada kode.** Dokumen ada di [`docs/`](docs/).
=======
> **Status: seluruh fitur M0–M6 sudah di `main`** (login 4 peran, barang & isi, QR/label/pindai, kirim & kembalikan, maintenance, beranda, impor CSV, backup). Tersisa uji lapangan (kamera, cetak, label di sterilisasi), pemuatan data awal, dan penyebaran ke server. Dokumen ada di [`docs/`](docs/).
>>>>>>> origin/main

## Gambaran singkat

```
   barang perlu steril (set instrumen)
   ┌──────────────┐  kirim   ┌──────────────┐
   │ Ruang Operasi│ ───────▶ │ CSSD/Steril  │
   │              │ ◀─────── │ cek & update │
   └──────────────┘ kembali  │    jumlah    │
          ▲                  └──────────────┘
          │ edit oleh Operasi
   alat besar tanpa steril (tidak berpindah)
          │ dilihat saja
   ┌──────────────┐
   │ Kantor Alkes │   maintenance: semua peran
   └──────────────┘
```

- Hanya **barang besar / wadah** yang diberi QR (TV, meja, "Perlengkapan 1" berisi jarum,
  pisau, dll). Isi wadah dicatat sebagai teks beserta jumlahnya, tanpa QR sendiri.
- **Tanpa foto.** Semua informasi berupa teks.
- **Maintenance** (perbaikan, pemeliharaan rutin, kalibrasi) lewat tiga form detail, dapat dicatat semua peran.
- Form barang memuat **detail alat dan pembelian** (merek, seri, harga, supplier, garansi).
- **4 peran:** `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN` (akses penuh + kelola pengguna).
- Contoh daftar inventaris RS ada di [`docs/contoh/`](docs/contoh/).
- **1 rumah sakit** (single-tenant).

## Mulai dari mana

Baca [`docs/00-README.md`](docs/00-README.md). Mulai coding: [PRD](docs/02-prd.md) →
[ERD](docs/03-erd.md) → [Arsitektur](docs/04-technical-architecture.md).

## Stack

Next.js 15 · TypeScript · PostgreSQL 16 · Prisma · Auth.js · Caddy · Docker Compose

Node 22 LTS · pnpm · Biome · Vitest · Playwright · GitHub Actions
