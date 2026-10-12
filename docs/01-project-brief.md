# 01 — Project Brief

## 1. Masalah

Alat besar dan wadah perlengkapan (set instrumen) di kamar operasi terus berpindah: set
instrumen ke CSSD untuk dibersihkan dan disterilkan, sementara alat besar tetap di tempatnya. Hari ini
semuanya dicatat di spreadsheet dan daftar manual per bulan (lihat
[contoh](12-data-contoh.md)): ribuan baris yang disalin ulang tiap periode.

- Tidak jelas **set instrumen itu sekarang ada di mana** — Operasi atau CSSD.
- Isi wadah (jarum, pisau, dll) **berkurang atau rusak** tanpa ada yang tahu kapan.
- Riwayat **perbaikan, servis, dan kalibrasi** alat besar tidak terkumpul di satu tempat.
- Detail pembelian (merek, nomor seri, harga, garansi) tersebar atau tidak ada.
- Kantor Alkes tidak punya cara cepat untuk **melihat kondisi terkini** semua barang.

## 2. Solusi

Setiap alat besar / wadah diberi **QR**. Memindainya membuka halaman barang: lokasi
sekarang, isi beserta jumlahnya, detail pembelian, riwayat, dan riwayat maintenance.

Barang dibagi dua menurut **perlu sterilisasi atau tidak**, ditetapkan saat pendaftaran:

| Jenis | Contoh | Perilaku |
|---|---|---|
| **Perlu sterilisasi** | Set/wadah instrumen (MAYOR 1, KATARAK SET) | Operasi **Kirim** → CSSD cek isi & update jumlah → **Kembalikan** ke Operasi |
| **Tanpa sterilisasi** | Mesin anestesi, meja operasi, lampu, TV, meja | **Tidak berpindah.** Tetap di ruang operasi; Operasi mengedit; Alkes hanya melihat |

**Maintenance** (perbaikan, pemeliharaan rutin, kalibrasi) dapat dicatat oleh **semua peran**
pada barang apa pun.

## 3. Aturan dasar

| Hal | Keputusan |
|---|---|
| Yang diberi QR | Alat besar dan wadah saja. Isi wadah **tidak** diberi QR |
| Isi wadah | Daftar teks: nama, merek, jumlah, jumlah rusak, catatan. Jumlah dapat diperbarui |
| Gambar & berkas | Tidak ada. Semua teks (nomor sertifikat dicatat sebagai teks) |
| Lokasi | Dua: Ruang Operasi (per kamar) dan CSSD. Barang tanpa sterilisasi selalu di Operasi |
| Peran | `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN` |
| Operasi | Mendaftarkan, mengubah detail & jumlah, mengirim set ke CSSD |
| Steril (CSSD) | Mengecek isi, mengubah jumlah, mengembalikan |
| Alkes | Hanya melihat (plus maintenance seperti peran lain) |
| Maintenance | Semua peran |
| Superadmin | Akses penuh dan mengelola pengguna |
| Tenant | Satu rumah sakit |

## 4. Sasaran

- Mengirim barang: **di bawah 15 detik** dari scan sampai tersimpan.
- CSSD mengembalikan sebuah wadah beserta update jumlah: **di bawah 1 menit**.
- Mencatat satu maintenance: **di bawah 2 menit**.
- Siapa pun menjawab "barang X di mana, isinya berapa, kapan terakhir dirawat" dengan
  **satu pencarian**.

## 5. Ruang lingkup v1

Satu rilis, tanpa pembagian MVP/v1.1:

- Login 4 peran; Superadmin mengelola pengguna lewat UI
- Pendaftaran barang dengan detail alat dan pembelian; perlu sterilisasi atau tidak; kamar
- Isi wadah (nama, merek, jumlah, rusak, catatan) dan perubahannya
- QR dan cetak label; pindai dari dalam aplikasi; pencarian
- Kirim set ke CSSD dan kembalikan (hanya barang yang perlu sterilisasi)
- **Maintenance (semua peran):** tiga form detail (perbaikan, pemeliharaan rutin, kalibrasi) + jatuh tempo
- Riwayat otomatis
- Beranda: hitungan per lokasi, rusak, jatuh tempo; daftar dan filter
- Skrip impor CSV untuk pemuatan data awal

## 6. Tidak termasuk

Foto/unggah berkas, multi-rumah sakit, peminjaman ke luar, notifikasi (email/WhatsApp),
ekspor Excel, mode offline, aplikasi mobile native, QR per item isi wadah, integrasi SIMRS,
work order maintenance penuh (penugasan, persetujuan, stok suku cadang), penyusutan nilai.

Bagian ini bisa dibuka lagi setelah alur inti dipakai dan terbukti berguna.

## 7. Risiko utama

| Risiko | Mitigasi |
|---|---|
| Petugas lupa memindai | Alur dibuat sependek mungkin: scan → satu tombol |
| Label rusak saat sterilisasi | Label/tag tahan proses sterilisasi CSSD ([08](08-qr-labeling.md)); pencarian manual |
| Akun dipakai bersama, pelaku tidak jelas | Setiap aksi meminta **nama petugas** |
| Data awal >1.300 baris sulit diketik | Skrip impor CSV; minta berkas Excel asli |
| Form maintenance terlalu panjang sehingga tidak diisi | Hanya beberapa field wajib per form; sisanya opsional |
| Jumlah isi wadah salah | Operasi dan CSSD dapat memperbaiki; semuanya tercatat |

## 8. Definisi selesai

Sebuah set instrumen dapat didaftarkan beserta isinya, dicetak labelnya, ditempel, dipindai
dengan ponsel, dikirim ke CSSD, diperiksa dan diperbarui jumlahnya, dan dikembalikan. Sebuah
meja operasi dapat didaftarkan beserta detail pembelian, diedit oleh Operasi, dilihat oleh
Alkes, dan dicatat perbaikannya oleh peran mana pun. Seluruh langkah terlihat di riwayat,
dan Superadmin dapat membuat pengguna baru dari UI.
