# 02 — Product Requirements

Peran: **O** = OPERASI, **S** = STERIL, **A** = ALKES, **SA** = SUPERADMIN (SA dapat melakukan semua yang dapat dilakukan peran lain).

## F1. Autentikasi

- Login dengan username + kata sandi. Sesi 30 hari di perangkat yang sama (ponsel dipakai
  sambil bekerja; login ulang berulang akan membuat alat ditinggalkan).
- Akun pertama (`SUPERADMIN`) dibuat lewat CLI (`pnpm user:create`). Selanjutnya
  **SA membuat pengguna baru dari UI** (lihat F10).

**Acceptance:**
- Salah kata sandi 5 kali dalam 2 menit → ditolak sementara.
- Tanpa sesi, semua halaman selain `/login` mengalihkan ke login.

## F2. Barang (alat besar / wadah)

**Form pendaftaran (O).** Hanya *nama* dan *perlu sterilisasi* wajib; sisanya boleh kosong agar
pendataan tidak tertahan.

| Kelompok | Field | Catatan |
|---|---|---|
| **Identitas** | Kode | otomatis `BRG-0001`, tidak berubah |
| | Nama * | "Mesin Anestesi Drager", "MAYOR 1" |
| | Perlu sterilisasi * | Ya (set/wadah instrumen; bisa dikirim ke CSSD) atau Tidak (alat besar; tidak berpindah) |
| | Kamar/ruang | "Kamar Operasi 101", "RR", "Ruang Transit" (teks, ada saran dari yang pernah dipakai) |
| | Keterangan | teks bebas |
| **Jumlah** | Jumlah | default 1. **Lebih dari 1 hanya untuk barang sejenis tanpa nomor seri** (meja stainless 4, tempat sampah 2). Alat bernomor seri didaftarkan satu per satu |
| | Jumlah rusak | default 0 |
| **Detail alat** | Merek, Model/tipe, Nomor seri | |
| **Pembelian** | Tanggal pembelian, Harga (Rp), Supplier/penyedia, Sumber dana | |
| | Garansi sampai | |
| **Isi** | Daftar isi | lihat F3; untuk wadah/set |

Sistem otomatis mengisi: lokasi awal `OPERASI`, `location_since`, versi.

- **O** mendaftarkan dan mengubah semua isian di atas **selama barang tidak sedang di CSSD**.
  Barang tanpa sterilisasi tidak pernah ke CSSD, sehingga selalu dapat diubah O.
- **A** hanya melihat. **S** hanya mengubah isi saat barang di CSSD (F3).
- Arsip = disembunyikan dari daftar, tetap ada di riwayat. Tidak ada hapus permanen.

**Acceptance:**
- Barang baru langsung punya kode dan QR siap cetak.
- Nomor seri yang sudah dipakai barang lain memunculkan peringatan (bukan penolakan).
- Jumlah rusak tidak boleh melebihi jumlah.
- Nomor seri hanya boleh diisi bila jumlah = 1 (satu QR untuk satu unit bernomor seri).
- Jenis "Perlu sterilisasi" tidak dapat diubah saat barang di CSSD.
- Barang terarsip tidak muncul di daftar default tetapi bisa dicari dengan filter "arsip".

## F3. Isi wadah

Setiap baris isi:

| Field | Catatan |
|---|---|
| Nama * | "DOEK KLEM", "Blade MAC 3" |
| Merek | "AESCULAP", "STORZ" |
| Jumlah * | bilangan bulat ≥ 0 |
| Jumlah rusak | 0 sampai jumlah |
| Catatan | "oli bocor", "menunggu pengadaan" |

- **O** menambah/menghapus/mengubah baris **dan jumlahnya** kapan pun barang tidak di CSSD
  (tidak harus saat mengirim).
- **S** mengubah jumlah, jumlah rusak, dan catatan saat barang di CSSD, serta boleh menambah
  baris baru (mis. item pengganti).
- **SA** mengubah di mana saja. **A** tidak mengubah isi.
- Setiap perubahan tersimpan di riwayat: nama, kolom, nilai lama → nilai baru.
- Daftar isi bisa panjang (20+ baris, ratusan di satu set besar): edit harus nyaman, dengan
  pencarian di dalam daftar dan tombol tambah baris cepat.

**Acceptance:**
- Jumlah negatif atau rusak > jumlah ditolak.
- Dua orang menyimpan bersamaan → yang kedua mendapat "data sudah berubah, muat ulang".

## F4. Alur perpindahan (hanya barang yang perlu sterilisasi)

Hanya dua tindakan, dan hanya untuk barang yang **perlu sterilisasi**. Barang tanpa
sterilisasi tidak punya tombol Kirim/Kembalikan dan tidak pernah berpindah dari Operasi.

| Tindakan | Siapa | Syarat | Hasil |
|---|---|---|---|
| **Kirim ke CSSD** | O | Perlu sterilisasi, di Operasi | Lokasi → CSSD |
| **Kembalikan ke Operasi** | S | Di CSSD | Lokasi → Operasi; perubahan jumlah disimpan bersamaan |

- Tiap tindakan meminta **nama petugas** (diingat di perangkat) dan catatan opsional.
- Tidak ada approval dan tidak ada status antara.

**Acceptance:**
- Mengirim barang yang sudah tidak di Operasi → ditolak dengan pesan lokasi sebenarnya.
- Mengirim barang yang tidak perlu sterilisasi → ditolak.
- Pengembalian + perubahan jumlah atomik.

## F5. Maintenance (semua peran)

Tombol **Maintenance** di halaman barang terlihat oleh **semua peran** (O, S, A, SA) dan dapat
dipakai pada barang di lokasi mana pun, termasuk yang sedang di CSSD. Tiga form, masing-masing dengan isian detail:

| Form | Isian |
|---|---|
| **Perbaikan** | Tanggal, pelaksana (teknisi/vendor) *, **keluhan/kerusakan** *, **tindakan**, **suku cadang diganti**, biaya, tanggal selesai, **jumlah rusak setelahnya** *, catatan |
| **Pemeliharaan rutin** | Tanggal, pelaksana *, **kegiatan yang dilakukan** *, **temuan**, biaya, **jadwal berikutnya**, jumlah rusak setelahnya, catatan |
| **Kalibrasi** | Tanggal, pelaksana *, **lembaga kalibrasi** *, **nomor sertifikat**, **hasil** (Lulus/Tidak lulus) *, **berlaku sampai** *, biaya, jumlah rusak setelahnya, catatan |

- Menyimpan form menambah catatan maintenance + entri riwayat `MAINTENANCE`, dan memperbarui
  jumlah rusak barang bila berubah.
- Catatan maintenance tidak dapat diubah/dihapus. Salah isi dikoreksi dengan catatan baru.
- Halaman barang menampilkan tab **Maintenance** (daftar catatan, terbaru dulu) dan
  **jatuh tempo berikutnya** bila ada.
- Hasil kalibrasi "Tidak lulus" otomatis menandai minimal 1 unit rusak bila jumlah rusak masih 0.

**Acceptance:**
- Semua peran yang login dapat mencatat maintenance; pengguna nonaktif atau tanpa sesi ditolak.
- Field wajib per form divalidasi; `berlaku sampai` tidak boleh sebelum tanggal kalibrasi.

## F6. Riwayat

Dibuat otomatis, tidak bisa diubah/dihapus: `REGISTER`, `EDIT`, `SEND`, `RETURN`,
`MAINTENANCE`, `ARCHIVE`, `RESTORE`. Setiap entri memuat waktu, akun, nama petugas,
catatan, dan perubahan jumlah bila ada.

**Acceptance:** tidak ada endpoint maupun tombol untuk mengubah atau menghapus riwayat;
trigger basis data menolak `UPDATE`, `DELETE`, dan `TRUNCATE` pada `item_logs` dan
`maintenance_records`, bahkan untuk pemilik tabel.

## F7. QR dan label

- QR berisi `https://{DOMAIN}/i/{kode}`.
- Cetak label tunggal atau lembar A4. Detail di [08](08-qr-labeling.md).
- Memindai QR tanpa login → halaman login, lalu kembali ke barang tersebut.

## F8. Pindai & cari

- Tombol **Pindai** membuka kamera dan langsung ke halaman barang.
- Kolom cari: kode, nama, merek, nomor seri, atau kamar (cadangan bila label rusak).

## F9. Beranda (semua peran)

- **Grup Jumlah barang**: kartu **Semua barang** (toska solid, total Operasi + CSSD) lalu
  hitungan di **Operasi**, di **CSSD**, **Ada yang rusak**, **Jatuh tempo ≤ 30 hari**.
- **Grup Aktivitas**: tiga kartu sejajar — **Barang terbaru berubah**, **Perlu sterilisasi**
  (barang berstatus `needsSterilization`, terlama di lokasi lebih dulu), dan **Jatuh tempo ≤ 30 hari**
  (jenis perawatan + sisa hari, merah bila terlambat) — di atas **Aktivitas terbaru**
  (timeline ikon per aksi + inisial petugas, 10 entri).
- Daftar barang dengan filter lokasi/kamar/rusak/jatuh tempo + pencarian. Baris: kode, nama,
  kamar, lokasi, jumlah (rusak), sudah berapa lama di lokasi itu.
- Detail barang: identitas, pembelian, isi, riwayat, maintenance. Tombol aksi hanya
  tampil sesuai peran dan lokasi barang.

## F10. Manajemen pengguna (SA)

- Halaman **Pengguna**: daftar, tambah, ubah nama/peran, nonaktifkan/aktifkan, atur ulang
  kata sandi.
- Membuat pengguna: username, nama, peran, kata sandi awal (wajib diganti saat login pertama).
- Pengguna tidak dihapus, hanya dinonaktifkan.
- SA tidak dapat menonaktifkan atau menurunkan peran dirinya bila ia SA aktif terakhir.

**Acceptance:** peran selain SA mendapat 403 pada semua endpoint pengguna.

## F11. Pemuatan data awal

Skrip impor CSV sekali pakai (`pnpm import:csv`) untuk barang dan isinya; bukan fitur UI.
Lihat [12](12-data-contoh.md).

## Non-fungsional

- Semua halaman terbaca di ponsel (360 px) dan desktop.
- Online-only. HTTPS wajib di produksi (kamera tidak jalan di HTTP).
- Antarmuka Bahasa Indonesia; teks dikumpulkan di satu tempat.
- Skala: ratusan barang, ribuan baris isi, puluhan perpindahan per hari.
- Tanpa gambar: tidak ada unggah berkas apa pun (termasuk sertifikat; nomor sertifikat saja).
