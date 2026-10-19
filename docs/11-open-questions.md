# 11 — Keputusan, Asumsi, dan Pertanyaan Terbuka

## A. Keputusan final

| # | Keputusan |
|---|---|
| D1 | Satu rumah sakit, single-tenant (menggantikan arah SaaS multi-tenant) |
| D2 | Tanpa gambar; semua data berupa teks |
| D3 | QR hanya untuk barang besar dan wadah; isi wadah berupa teks + jumlah |
| D4 | Dua lokasi (Operasi, CSSD). Hanya barang yang **perlu sterilisasi** (set instrumen) berpindah: Operasi → CSSD → Operasi. Alat besar tanpa sterilisasi (mesin, meja, TV) **tidak dikirim ke mana pun** |
| D5 | Alkes hanya melihat. Operasi mengedit alat besar |
| D5b | Maintenance punya tiga form detail (Perbaikan, Pemeliharaan rutin, Kalibrasi) dan dapat dicatat **semua peran** |
| D5c | Form pendaftaran barang memuat detail alat dan pembelian (merek, model, seri, tanggal, harga, supplier, sumber dana, garansi) |
| D5d | Barang punya `kamar` (Kamar Operasi 101, RR, …), `jumlah`, dan `jumlah rusak`; isi wadah punya merek, jumlah, rusak, catatan (dari daftar contoh) |
| D5e | Data awal dimuat lewat skrip impor CSV, bukan UI |
| D6 | Empat peran: `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN` |
| D6b | Operasi dapat mengubah detail dan jumlah selama barang tidak di CSSD; CSSD mengubah jumlah saat di CSSD; SUPERADMIN di mana saja |
| D6c | SUPERADMIN akses penuh dan membuat/mengelola pengguna dari UI |
| D7 | Riwayat append-only |
| D8 | Login wajib; tidak ada halaman publik |
| D9 | Barang diarsipkan, tidak pernah dihapus |
| D10 | Setiap kirim/kembali mencatat nama petugas |
| D11 | Aplikasi di Vercel, PostgreSQL di VPS yang dikelola Coolify (SSL); kode Inggris, UI Indonesia |

## B. Asumsi yang perlu dikonfirmasi

| # | Asumsi | Bila salah |
|---|---|---|
| AS-1 | **Operasi** yang mendaftarkan barang dan menetapkan isi awal | Ganti izin di matriks 07 |
| AS-2 | **Dikonfirmasi pengguna:** barang berpindah ke CSSD **langsung** saat Operasi menekan kirim, tanpa konfirmasi terima | Tambah status "dikirim" dan tombol "Terima" di CSSD |
| AS-3 | **Dikonfirmasi pengguna:** satu akun per peran dipakai bergantian oleh beberapa petugas | Bila perorangan, nama petugas bisa diambil dari akun |
| AS-4 | Pengecekan CSSD cukup mengubah jumlah per baris | Bila perlu kolom "kondisi", tambah satu kolom teks |
| AS-5 | Barang besar (TV, meja) tidak punya isi | Tidak ada perubahan; isi tinggal diisi |
| AS-6 | Nama isi wadah unik per wadah | Hapus constraint `UNIQUE (item_id, name)` |
| AS-7 | **Dikonfirmasi pengguna:** barang tanpa sterilisasi tidak dikirim; Alkes hanya melihat; Operasi mengedit | — |
| AS-10 | **Dikonfirmasi pengguna:** maintenance dicatat semua peran | — |
| AS-11 | Tiga jenis form maintenance (perbaikan, pemeliharaan rutin, kalibrasi) dan isian di PRD F5 sudah cukup | Sesuaikan field di `details` |
| AS-12 | **Dikonfirmasi pengguna:** kondisi rusak dicatat sebagai jumlah rusak, bukan status per unit | — |
| AS-13 | **Diputuskan (pilihan terbaik):** satu QR per unit untuk alat bernomor seri atau yang punya riwayat maintenance sendiri; `jumlah` > 1 hanya untuk barang sejenis tanpa nomor seri (meja stainless, tempat sampah, kursi). Sistem menolak nomor seri bila jumlah > 1. Alasan: maintenance, garansi, dan pembelian melekat pada unit, bukan kelompok | Bila perlu per unit untuk barang sejenis, daftarkan satu per satu |
| AS-8 | Jalur ditetapkan per barang saat didaftarkan (bukan per kategori) | Tambah tabel kategori |
| AS-9 | Set instrumen selalu "perlu sterilisasi" dan alat besar "tidak" — dipilih petugas, tidak dipaksa sistem | Tambah validasi |

## C. Pertanyaan terbuka

| # | Pertanyaan | Dibutuhkan untuk |
|---|---|---|
| Q-1 | Domain produksi? | `APP_URL`, isi QR — **harus pasti sebelum label dicetak** |
| Q-2 | ~~Server di VPS atau di RS?~~ **Dijawab: VPS sendiri di luar RS** | Deployment |
| Q-3 | Metode dan suhu sterilisasi CSSD? | Memilih bahan label |
| Q-4 | Printer label apa yang tersedia? | Ukuran label |
| Q-5 | Berapa perkiraan jumlah barang dan panjang isi tiap wadah? | Desain layar edit isi |
| Q-6 | Siapa yang mengelola sistem setelah selesai? | Cadangan, akun, pembaruan |
| Q-7 | Apakah ruang operasi dan CSSD punya sinyal/Wi-Fi yang stabil? | Online-only dapat dipakai |
| Q-8 | **Berkas Excel asli** dari kedua daftar contoh? | Skrip impor (PDF sulit diurai andal) |
| Q-9 | Daftar kamar/ruang yang tetap (Kamar Operasi 101–104, 205–206, RR, Ruang Transit, …)? | Saran isian kamar |
| Q-10 | Lembaga kalibrasi dan interval kalibrasi/pemeliharaan umum per jenis alat? | Nilai bawaan form maintenance |
| Q-11 | Daftar sumber dana yang dipakai (APBD, BLUD, hibah, …)? | Pilihan isian Sumber dana |
