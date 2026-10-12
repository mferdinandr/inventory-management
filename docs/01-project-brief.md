# 01 — Project Brief

## 1. Masalah

Barang besar dan wadah perlengkapan di ruang operasi (TV, meja, set instrumen) terus
berpindah ke CSSD untuk dibersihkan dan disterilkan. Tidak ada catatan yang bisa dipercaya:

- Tidak jelas **barang itu sekarang ada di mana** — Operasi atau CSSD.
- Isi wadah (jarum, pisau, dll) **berkurang atau berubah** tanpa ada yang tahu kapan.
- Kantor Alkes tidak punya cara cepat untuk **melihat kondisi terkini**.

## 2. Solusi

Setiap barang besar / wadah diberi **QR**. Memindainya membuka halaman barang: lokasi
sekarang, isi beserta jumlahnya, dan riwayat perpindahan. Tiap barang menempuh satu dari
dua jalur, ditetapkan saat pendaftaran:

| Jalur | Untuk | Alur |
|---|---|---|
| **Steril** | Wadah/set instrumen | Operasi → CSSD (cek & update jumlah) → Operasi |
| **Non-steril** | Barang besar: TV, meja, dll | Operasi → Kantor Alkes → Operasi |

Hanya dua tindakan: **Kirim** dan **Kembalikan**. Tujuan kirim otomatis mengikuti jalur
barang. Kantor Alkes memantau keadaan sekarang dan menerima barang jalur non-steril.

## 3. Aturan dasar

| Hal | Keputusan |
|---|---|
| Yang diberi QR | Barang besar dan wadah saja. Isi wadah **tidak** diberi QR |
| Isi wadah | Daftar teks: nama + jumlah. Jumlah dapat diperbarui |
| Gambar | Tidak ada |
| Lokasi | Tiga: Ruang Operasi, CSSD, Kantor Alkes |
| Peran | `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN` |
| Alkes | Memantau semua barang; mengembalikan barang jalur non-steril |
| Superadmin | Akses penuh dan membuat/mengelola pengguna |
| Tenant | Satu rumah sakit |

## 4. Sasaran

- Mengirim barang: **di bawah 15 detik** dari scan sampai tersimpan.
- CSSD mengembalikan sebuah wadah beserta update jumlah: **di bawah 1 menit**.
- Siapa pun menjawab "barang X sekarang di mana dan isinya berapa" dengan **satu pencarian**.

## 5. Ruang lingkup v1

Satu rilis, tanpa pembagian MVP/v1.1:

- Login dengan 4 peran; Superadmin mengelola pengguna lewat UI
- Daftar, tambah, ubah, arsipkan barang (termasuk menentukan jalur steril/non-steril)
- Isi wadah (nama + jumlah) dan perubahannya
- QR dan cetak label
- Pindai QR dari dalam aplikasi
- Kirim (ke CSSD atau Alkes sesuai jalur) dan kembalikan ke Operasi
- Riwayat otomatis
- Beranda ringkas (jumlah per lokasi, daftar, pencarian)

## 6. Tidak termasuk

Foto/lampiran, multi-rumah sakit, kalibrasi & jadwal pemeliharaan, peminjaman, perbaikan,
mutasi ke ruangan lain, notifikasi, ekspor/impor Excel, mode offline, aplikasi mobile native,
barcode per item isi wadah, integrasi SIMRS.

Bagian ini bisa dibuka lagi setelah alur inti dipakai dan terbukti berguna.

## 7. Risiko utama

| Risiko | Mitigasi |
|---|---|
| Petugas lupa memindai | Alur dibuat sependek mungkin: scan → satu tombol |
| Label rusak saat sterilisasi | Gunakan label/tag tahan proses sterilisasi CSSD (lihat [08](08-qr-labeling.md)); ada pencarian kode manual |
| Akun dipakai bersama sehingga pelaku tidak jelas | Setiap aksi kirim/kembali meminta **nama petugas** |
| Jumlah isi wadah salah | Operasi dan CSSD dapat memperbaiki; semuanya tercatat |

## 8. Definisi selesai

Sebuah wadah dapat didaftarkan beserta isinya, dicetak labelnya, ditempel, dipindai dengan
ponsel, dikirim ke CSSD, diperiksa dan diperbarui jumlahnya, dikembalikan; sebuah TV
dikirim ke Kantor Alkes dan dikembalikan; seluruh langkah itu terlihat di riwayat; dan
Superadmin dapat membuat pengguna baru dari UI.
