# 11 — Keputusan, Asumsi, dan Pertanyaan Terbuka

## A. Keputusan final

| # | Keputusan |
|---|---|
| D1 | Satu rumah sakit, single-tenant (menggantikan arah SaaS multi-tenant) |
| D2 | Tanpa gambar; semua data berupa teks |
| D3 | QR hanya untuk barang besar dan wadah; isi wadah berupa teks + jumlah |
| D4 | Tiga lokasi (Operasi, CSSD, Alkes). Jalur `STERIL`: Operasi → CSSD → Operasi. Jalur `NON_STERIL` (TV, meja): Operasi → Alkes → Operasi |
| D5 | Alkes memantau semua barang dan mengembalikan barang non-steril |
| D6 | Empat peran: `OPERASI`, `STERIL`, `ALKES`, `SUPERADMIN` |
| D6b | Operasi dan CSSD sama-sama dapat mengubah jumlah isi (Operasi di Operasi, CSSD di CSSD); SUPERADMIN di mana saja |
| D6c | SUPERADMIN akses penuh dan membuat/mengelola pengguna dari UI |
| D7 | Riwayat append-only |
| D8 | Login wajib; tidak ada halaman publik |
| D9 | Barang diarsipkan, tidak pernah dihapus |
| D10 | Setiap kirim/kembali mencatat nama petugas |
| D11 | Docker Compose + Caddy + PostgreSQL; kode Inggris, UI Indonesia |

## B. Asumsi yang perlu dikonfirmasi

| # | Asumsi | Bila salah |
|---|---|---|
| AS-1 | **Operasi** yang mendaftarkan barang dan menetapkan isi awal | Ganti izin di matriks 07 |
| AS-2 | Barang berpindah ke CSSD **langsung** saat Operasi menekan kirim, tanpa konfirmasi terima | Tambah status "dikirim" dan tombol "Terima" di CSSD |
| AS-3 | Satu akun per peran dipakai bergantian oleh beberapa petugas | Bila perorangan, nama petugas bisa diambil dari akun |
| AS-4 | Pengecekan CSSD cukup mengubah jumlah per baris | Bila perlu kolom "kondisi", tambah satu kolom teks |
| AS-5 | Barang besar (TV, meja) tidak punya isi | Tidak ada perubahan; isi tinggal diisi |
| AS-6 | Nama isi wadah unik per wadah | Hapus constraint `UNIQUE (item_id, name)` |
| AS-7 | Barang non-steril **kembali ke Operasi** dari Alkes (tombol Kembalikan oleh peran Alkes) | Bila barang menetap di Alkes, hapus tombol dan tambah status akhir |
| AS-8 | Jalur ditetapkan per barang saat didaftarkan (bukan per kategori) | Tambah tabel kategori |
| AS-9 | Wadah dengan isi selalu jalur steril; barang besar tanpa isi selalu non-steril — tapi tidak dipaksa sistem | Tambah validasi |

## C. Pertanyaan terbuka

| # | Pertanyaan | Dibutuhkan untuk |
|---|---|---|
| Q-1 | Domain produksi? | `APP_URL`, isi QR — **harus pasti sebelum label dicetak** |
| Q-2 | Server di VPS atau di RS? | Deployment |
| Q-3 | Metode dan suhu sterilisasi CSSD? | Memilih bahan label |
| Q-4 | Printer label apa yang tersedia? | Ukuran label |
| Q-5 | Berapa perkiraan jumlah barang dan panjang isi tiap wadah? | Desain layar edit isi |
| Q-6 | Siapa yang mengelola sistem setelah selesai? | Cadangan, akun, pembaruan |
| Q-7 | Apakah ruang operasi dan CSSD punya sinyal/Wi-Fi yang stabil? | Online-only dapat dipakai |
