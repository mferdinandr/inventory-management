# 13 — Kerja Paralel (multi-agent)

Beberapa agen dapat mengerjakan milestone yang berbeda sekaligus, masing-masing di **git
worktree** sendiri. Dokumen ini menetapkan cara menyiapkan worktree, siapa memiliki apa, dan
titik konflik yang harus dijaga.

## 1. Menyiapkan worktree

```bash
git worktree add ../simaset-m1 -b feat/m1-items origin/main   # atau lewat Orca
cd ../simaset-m1
scripts/setup-worktree.sh
```

Skrip `scripts/setup-worktree.sh` melakukan, per worktree:

| Langkah | Hasil |
|---|---|
| `.env` dari `.env.example` | `AUTH_SECRET` acak baru, tidak disalin antar worktree |
| Database sendiri | `simaset_<nama_branch>` di satu kontainer Postgres bersama (`simaset-dev-db`, port 5433) |
| Database tes sendiri | `<database>_test`, dibuat otomatis oleh `tests/global-setup.ts` |
| Port dev sendiri | `PORT` stabil 3100–3999 dari nama branch; `pnpm dev` membacanya |
| `pnpm install`, `prisma generate`, `prisma migrate deploy` | Siap dipakai |

Semua worktree memakai satu kontainer Postgres dan satu proyek compose (`simaset-dev`),
jadi tidak ada bentrok nama atau port.

> Konfigurasi di dalam aplikasi Orca (hook otomatis saat workspace dibuat, dll.) belum
> dipastikan. Bila Orca mendukung perintah setup per workspace, arahkan ke
> `scripts/setup-worktree.sh`.

## 2. Pembagian pekerjaan

Setelah M0 (sudah di `main`), milestone dibagi dalam dua gelombang.

**Gelombang 1 — dapat berjalan bersamaan:**

| Agen / branch | Milestone | Memiliki (hanya menyentuh) |
|---|---|---|
| `feat/m1-items` | M1 Barang & Isi | `src/server/services/item.service.ts`, `src/app/(app)/items/**` (daftar, tambah, ubah, detail), `src/lib/validators/item.ts` |
| `feat/m2-qr-label` | M2 QR, Label, Pindai | `src/app/i/**`, `src/app/print/**`, `src/app/(app)/scan/**`, `src/app/api/qr/**` |
| `feat/m4-maintenance` | M4 Maintenance | `src/server/services/maintenance.service.ts`, `src/lib/validators/maintenance.ts`, `src/app/(app)/items/[code]/maintenance/**` |

**Gelombang 2 — setelah M1 ter-merge:**

| Branch | Milestone | Bergantung pada |
|---|---|---|
| `feat/m3-flow` | M3 Kirim & Kembali | Halaman detail barang dari M1 |
| `feat/m5-dashboard` | M5 Beranda & Riwayat | Daftar barang dari M1, log dari M1/M3/M4 |
| `feat/m6-import-deploy` | M6 Impor & penyebaran | Skema isi barang dari M1 |

M2 dan M4 hanya membaca barang lewat Prisma; keduanya tidak menunggu UI M1. Titik temu
(tab Maintenance dan tombol Cetak Label di halaman detail) disambungkan di gelombang 2.

## 3. Aturan agar tidak bentrok

1. **Satu agen = satu branch = satu worktree.** Jangan ganti branch di worktree orang lain.
2. **Migrasi skema hanya lewat satu jalur.** Skema sudah lengkap sejak M0. Bila agen
   membutuhkan kolom/tabel baru, buat PR berisi migrasi saja, merge lebih dulu, lalu semua
   agen `git rebase origin/main` dan `prisma migrate deploy`. Jangan menyimpan migrasi
   bernomor bentrok di dua branch.
3. **Berkas bersama diedit seminimal mungkin, dengan perubahan kecil dan cepat di-merge:**
   `src/lib/permissions.ts`, `src/lib/strings.ts`, `src/app/(app)/layout.tsx` (menu),
   `prisma/schema.prisma`, `package.json`. Tambahkan di akhir bagian, jangan menata ulang.
4. **`rebase` sering.** `git fetch && git rebase origin/main` sebelum mulai sesi dan sebelum
   membuka PR. Selesaikan konflik di branch sendiri.
5. **Tes selalu lulus sebelum push:** `biome check .`, `tsc --noEmit`, `vitest run`
   (database tes sudah terpisah per worktree).
6. **Commit kecil dan langsung push** seperti di `CLAUDE.md`; PR kecil per langkah bermakna,
   bukan satu PR besar per milestone.
7. **Servis adalah satu-satunya penulis data** (lihat 04). Agen lain memakai fungsi servis,
   bukan menulis Prisma langsung.

## 4. Menyelesaikan satu milestone

Agen membuka PR ke `main`, menunggu CI hijau, lalu merge. Setelah merge, worktree dapat
dihapus: `git worktree remove <path>` dan `DROP DATABASE simaset_<nama_branch>` (dan `_test`).
