# SIMASET — Pelacakan Barang & Perlengkapan Ruang Operasi

Aplikasi web sederhana untuk melacak barang besar dan wadah perlengkapan (set instrumen)
yang berpindah dari **Ruang Operasi** ke **CSSD/Steril** (perlu sterilisasi) atau ke
**Kantor Alkes** (alat besar tanpa sterilisasi), lalu kembali.

> **Status: perencanaan selesai (v3.0), belum ada kode.** Dokumen ada di [`docs/`](docs/).

## Gambaran singkat

```
                 barang perlu steril
   ┌──────────────┐  kirim   ┌──────────────┐
   │              │ ───────▶ │ CSSD/Steril  │
   │ Ruang Operasi│ ◀─────── │ cek & update │
   │              │ kembali  │    jumlah    │
   │              │          └──────────────┘
   │              │  alat besar tanpa steril
   │              │ ───────▶ ┌──────────────┐
   │              │ ◀─────── │ Kantor Alkes │
   └──────────────┘  ambil   │ + maintenance│
                    kembali  └──────────────┘
```

- Hanya **barang besar / wadah** yang diberi QR (TV, meja, "Perlengkapan 1" berisi jarum,
  pisau, dll). Isi wadah dicatat sebagai teks beserta jumlahnya, tanpa QR sendiri.
- **Tanpa foto.** Semua informasi berupa teks.
- **Maintenance** (perbaikan, pemeliharaan rutin, kalibrasi) dicatat Kantor Alkes lewat tiga form detail.
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
