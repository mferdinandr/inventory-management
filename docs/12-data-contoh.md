# 12 — Data Contoh dari Rumah Sakit

Dua daftar yang dipakai saat ini ada di [`contoh/`](contoh/). Keduanya menjadi acuan bentuk
data dan bahan uji impor awal.

## 1. `inventaris-anestesi-juni-2026.pdf` (7 halaman)

Daftar alat anestesi per **kamar**, dibuat manual.

| Kolom | Isi |
|---|---|
| No., Nama Alat | "Mesin Anestesi", "Bed Side Monitor", "Blade MAC 3", "Face mask no. 4", … |
| Jumlah Alat | 1, 2, 4, 5 |
| Alat Rusak | jumlah yang rusak (mis. Mesin Anestesi di Kamar 103: 1) |
| Keterangan | mis. "Menunggu pengadaan barang" |

Dikelompokkan: Kamar Operasi 101–104 (Lantai II), RR (Recovery Room), Ruang Transit, Kamar
Operasi 205–206 (Lantai III), dst.

**Konsekuensi untuk sistem:**
- Barang punya kolom **`room`** (kamar tempat barang berada saat di Operasi).
- Isi punya **`quantity`** dan **`damaged_quantity`** serta **`note`**.
- Mesin anestesi, bed side monitor, dan troli adalah barang besar (QR sendiri); blade, masker,
  connector adalah isi dari wadah/set "Laringoskop", atau baris isi dari barang kamar.

## 2. `inventaris-mei-2026.pdf` (160 halaman)

Ekspor dari spreadsheet. Dua bagian:

**a. Set instrumen** (MAYOR 1–22, MINOR 1–5, BASIC CRANIOTOMY 1–2, KATARAK SET,
TYMPANOPLASTY SET, PRECISEMED, FESS, SARAF, dll). Satu set = satu wadah berisi banyak baris:

| Kolom | Isi |
|---|---|
| NAMA ITEM | "DOEK KLEM", "ARTERI BESAR", "PEAN", … |
| MEREK | AESCULAP, SMIC, STORZ, B.Braun |
| KONDISI | BAIK / RUSAK |
| JUMLAH | 1–30 |
| STATUS | Tersedia / Tidak tersedia |
| CATATAN | teks bebas |
| TANGGAL VERIFIKASI | dua tanggal (mis. 15/11/2025, 29/11/2025) |

Sekitar 1.280 baris isi pada puluhan set.

**b. Alat dan barang besar** ("LAIN-LAIN"): Mesin Anestesi Drager, Meja Operasi Skytron
(RUSAK, "oli bocor"), Lampu Operasi Skytron, ECU Covidien Force FX, Bedside Monitor Drager
Vista 300, USG Logiq V5, lemari alat, meja stainless, tiang infus, tempat sampah, ember
linen, kursi, box container.

**Konsekuensi untuk sistem:**
- Set instrumen → barang perlu sterilisasi dengan isi (nama + merek + jumlah + rusak + catatan).
- Alat besar → barang tanpa sterilisasi (tidak berpindah) dengan detail pembelian dan **maintenance**
  (meja operasi yang bocor oli adalah contoh nyata kebutuhan form Perbaikan).
- Satu set bisa berisi 20+ baris; layar edit isi harus nyaman untuk daftar panjang.
- *Kondisi* di daftar Mei menjadi `damaged_quantity > 0` pada isi dan `condition` pada barang.
- *Status* "Tersedia/Tidak tersedia" tidak disimpan; ia turunan dari lokasi dan kondisi.
- *Tanggal verifikasi* digantikan log `RETURN` CSSD (waktu pengecekan terakhir).

## 3. Pemuatan data awal

Total >1.300 baris. Mengetik ulang lewat formulir tidak realistis.

- Untuk pengembangan, `pnpm seed` membuat data contoh kecil (set sterilisasi, alat besar,
  maintenance, log aktivitas) yang aman dijalankan ulang — barang dengan nama sama dilewati.
- Sediakan **skrip impor CSV sekali pakai** (`pnpm import:csv`) yang dijalankan
  SUPERADMIN/pengembang, bukan fitur UI. Format: satu CSV barang, satu CSV isi.
- Minta **berkas Excel asli** (bukan PDF) dari rumah sakit; PDF ini ekspor dan sulit diurai
  dengan andal.
- Pendataan bertahap: mulai dari beberapa set dan satu kamar, jalankan sebulan, baru lanjut.
