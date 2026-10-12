# 02 — Product Requirements

Peran: **O** = OPERASI, **S** = STERIL, **A** = ALKES, **SA** = SUPERADMIN (SA dapat melakukan semua yang dapat dilakukan peran lain).

## F1. Autentikasi

- Login dengan username + kata sandi. Sesi 30 hari di perangkat yang sama (ponsel dipakai
  sambil bekerja, login ulang berulang akan membuat alat ditinggalkan).
- Akun pertama (`SUPERADMIN`) dibuat lewat CLI (`pnpm user:create`). Selanjutnya
  **SA membuat pengguna baru dari UI** (lihat F9).

**Acceptance:**
- Salah kata sandi 5 kali dalam 10 menit → ditolak sementara.
- Tanpa sesi, semua halaman selain `/login` mengalihkan ke login.

## F2. Barang (wadah / barang besar)

| Field | Wajib | Catatan |
|---|---|---|
| Kode | otomatis | `BRG-0001`, tidak berubah |
| Nama | ya | "TV Ruang 2", "Perlengkapan 1" |
| Keterangan | tidak | Teks bebas |
| Jalur | ya | `STERIL` (via CSSD) atau `NON_STERIL` (via Kantor Alkes) |
| Lokasi saat ini | otomatis | `OPERASI`, `CSSD`, atau `ALKES`; awal `OPERASI` |
| Isi | tidak | Daftar nama + jumlah. Barang besar biasanya kosong |

- **O** mendaftarkan, mengubah nama/keterangan/jalur (saat barang di Operasi), dan mengarsipkan.
- Arsip = disembunyikan dari daftar, tetap ada di riwayat. Tidak ada hapus permanen.

**Acceptance:**
- Barang baru langsung punya kode dan QR siap cetak.
- Barang terarsip tidak muncul di daftar default tetapi tetap bisa dicari dengan filter "arsip".

## F3. Isi wadah

- Setiap baris: **nama** (teks) dan **jumlah** (bilangan bulat ≥ 0).
- **O** boleh menambah/menghapus/mengubah baris **dan jumlahnya kapan pun barang di
  Operasi** (tidak harus saat mengirim).
- **S** boleh mengubah **jumlah** baris saat barang di CSSD (menambah baris baru juga
  boleh, mis. ada item pengganti).
- **SA** boleh mengubah isi di lokasi mana pun.
- Setiap perubahan jumlah tersimpan di riwayat: nama, jumlah lama → jumlah baru.

**Acceptance:**
- Jumlah negatif ditolak.
- Dua orang menyimpan perubahan bersamaan → yang kedua mendapat pesan "data sudah berubah,
  muat ulang" (bukan menimpa diam-diam).

## F4. Alur perpindahan

Hanya dua tindakan. Tujuan **Kirim** otomatis mengikuti jalur barang.

| Tindakan | Siapa | Syarat | Hasil |
|---|---|---|---|
| **Kirim** | O | Barang di Operasi | `STERIL` → CSSD; `NON_STERIL` → Alkes |
| **Kembalikan ke Operasi** | S (dari CSSD), A (dari Alkes) | Barang di CSSD / Alkes | Lokasi → Operasi; jumlah yang diubah disimpan bersamaan (S) |

- Kedua tindakan meminta **nama petugas** (diingat di perangkat), dan catatan opsional.
- Tidak ada approval dan tidak ada status antara.

**Acceptance:**
- Mengirim barang yang sudah tidak di Operasi → ditolak dengan pesan lokasi sebenarnya.
- Barang `NON_STERIL` tidak pernah masuk ke CSSD, dan sebaliknya.
- Pengembalian + perubahan jumlah bersifat atomik: gagal semua atau berhasil semua.

## F5. Riwayat

Dibuat otomatis, tidak bisa diubah/dihapus: `REGISTER`, `SEND`, `RETURN`, `EDIT`,
`ARCHIVE`, `RESTORE`. Setiap entri memuat waktu, akun, nama petugas, catatan, dan
daftar perubahan jumlah bila ada.

**Acceptance:** tidak ada endpoint maupun tombol untuk mengubah atau menghapus riwayat;
peran basis data aplikasi tidak punya hak `UPDATE`/`DELETE` pada tabel riwayat.

## F6. QR dan label

- QR berisi `https://{DOMAIN}/i/{kode}`.
- Cetak label tunggal atau lembar A4 dari daftar. Detail di [08](08-qr-labeling.md).
- Memindai QR tanpa login → halaman login, lalu kembali ke barang tersebut.

## F7. Pindai & cari

- Tombol **Pindai** membuka kamera dan langsung ke halaman barang.
- Kolom cari: kode atau nama (sebagai cadangan bila label rusak).

## F8. Beranda (semua peran)

Beranda menampilkan: jumlah barang di Operasi, di CSSD, dan di Alkes, serta daftar barang
dengan filter lokasi + pencarian. Setiap baris: kode, nama, lokasi, sudah berapa lama di
lokasi itu. Detail barang menampilkan isi dan riwayat. Tombol aksi hanya tampil sesuai
peran dan lokasi barang; **A** hanya melihat tombol Kembalikan untuk barang yang ada di Alkes.

## F9. Manajemen pengguna (SA)

- Halaman **Pengguna**: daftar, tambah, ubah nama/peran, nonaktifkan/aktifkan, atur ulang
  kata sandi.
- Membuat pengguna: username, nama, peran, kata sandi awal (wajib diganti saat login pertama).
- Pengguna tidak dihapus, hanya dinonaktifkan (riwayat tetap menunjuk ke akunnya).
- SA tidak dapat menonaktifkan atau menurunkan peran dirinya sendiri bila ia SA aktif terakhir.

**Acceptance:** peran selain SA mendapat 403 pada semua endpoint pengguna.

## Non-fungsional

- Semua halaman terbaca di ponsel (lebar 360 px) dan desktop.
- Online-only. HTTPS wajib di produksi (kamera tidak jalan di HTTP).
- Antarmuka Bahasa Indonesia; teks dikumpulkan di satu tempat.
- Skala: ratusan barang, puluhan perpindahan per hari. Tidak ada kebutuhan performa khusus.
