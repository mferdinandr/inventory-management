# SIMASET — Sistem Inventaris & Pelacakan Aset Rumah Sakit

Sistem pelacakan aset rumah sakit berbasis QR Code. Setiap barang memiliki identitas
permanen dan riwayat yang tidak dapat dihapus: siapa meminjam, kapan diperiksa, apa yang
diperbaiki, dan kapan kalibrasi berikutnya jatuh tempo.

> **Status: tahap perencanaan.** Belum ada kode. Seluruh dokumen perencanaan ada di [`docs/`](docs/).

## Mulai dari mana

Baca [`docs/00-README.md`](docs/00-README.md) sebagai daftar isi dan ringkasan keputusan.

Akan mulai coding? Urutannya: [PRD](docs/02-prd.md) → [ERD](docs/03-erd.md) →
[Arsitektur](docs/04-technical-architecture.md) → [Deployment](docs/09-deployment-ops.md).

## Gambaran singkat

PIC ruangan mendaftarkan barang ke sistem → sistem menerbitkan QR Code → QR dicetak dan
ditempel di barang → memindai QR membuka informasi barang beserta riwayat perlakuannya →
petugas yang berwenang menambahkan riwayat baru lengkap dengan waktu, penanggung jawab,
dan foto bukti.

## Stack

Next.js 15 · TypeScript · PostgreSQL 16 · Prisma · Auth.js · MinIO · Caddy · Docker Compose
