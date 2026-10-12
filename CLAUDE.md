# SIMASET — Aturan Kerja

## Commit

**Selalu commit setiap perubahan yang berdiri sendiri. Jangan menunggu seluruh pekerjaan selesai.**

Ikuti alur kerja, satu commit per langkah:

1. Tulis/ubah satu bagian → verifikasi (build, lint, tes) → **commit**.
2. Ada error → perbaiki → **commit** (`fix:`) secara terpisah.
3. Lanjut ke bagian berikutnya → **commit**.

Target: banyak commit kecil dan berurutan, bukan satu commit besar di akhir. Setiap commit
sebaiknya bisa dijelaskan dalam satu kalimat dan membangun/lulus tes sendiri.

- Format: Conventional Commits berbahasa Inggris (`feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:`).
- **Setiap commit langsung di-push** (`git push -u origin <branch>`), jangan hanya tersimpan
  di lokal. Commit lalu push adalah satu langkah yang tidak dipisah.
- Bila push gagal (mis. remote belum ada atau ditolak), laporkan ke pengguna; jangan
  dilewati diam-diam dan jangan memakai `--force`.
- Jangan menggabungkan perubahan yang tidak berkaitan dalam satu commit.
- Jangan menunggu diminta; commit adalah bagian dari menyelesaikan setiap langkah.
- Bekerja di branch, bukan langsung di `main`.

## Bahasa

Kode dan commit dalam bahasa Inggris; antarmuka dan dokumentasi dalam bahasa Indonesia.

## Dokumen

Dokumen perencanaan ada di `docs/` (mulai dari `docs/00-README.md`). Bila perilaku produk
berubah, perbarui dokumen terkait di commit yang sama atau commit tepat sebelumnya.
