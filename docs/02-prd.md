# 02 — Product Requirements Document (PRD)

Dokumen ini mendefinisikan **apa** yang dibangun. Bagaimana membangunnya ada di
[04-technical-architecture.md](04-technical-architecture.md).

Penomoran kebutuhan: `FR-xx` fungsional, `NFR-xx` non-fungsional.
Prioritas: **P0** wajib v1, **P1** sebaiknya v1, **P2** v2.

---

## A. Master Data

### FR-01 — Organisasi (P0)

Sistem menyimpan satu organisasi (rumah sakit) berisi nama, alamat, logo, dan zona waktu.
Seluruh data lain terikat ke organisasi ini. v1 hanya menampilkan satu organisasi di UI,
tetapi struktur data dan setiap query sudah memfilter berdasarkan organisasi.

**Acceptance criteria**
- Admin dapat mengubah profil organisasi.
- Logo organisasi muncul di label QR yang dicetak dan di halaman publik.
- Tidak ada satu pun query aset yang berjalan tanpa filter organisasi.

### FR-02 — Lokasi Berjenjang (P0)

Lokasi disimpan sebagai pohon dengan empat tingkat: **Gedung → Lantai → Instalasi/Departemen → Ruangan**.
Aset selalu ditempatkan pada node bertipe `ROOM`.

**Acceptance criteria**
- Admin dapat membuat, mengubah, dan menonaktifkan lokasi pada setiap tingkat.
- Lokasi yang masih memiliki aset tidak dapat dihapus, hanya dinonaktifkan.
- Setiap ruangan dapat ditetapkan satu **PIC** (pengguna bertanggung jawab).
- UI menampilkan jalur lengkap, contoh: `Gedung A / Lantai 2 / Instalasi Radiologi / Ruang CT-Scan`.

### FR-03 — Kategori Aset (P0)

Kategori bersusun dua tingkat dan menandai apakah kategori tersebut termasuk **alat medis**.
Penanda ini yang mengaktifkan kewajiban kalibrasi.

**Acceptance criteria**
- Kategori memiliki atribut `is_medical_device`.
- Kategori medis memiliki `default_calibration_interval_months` yang mengisi otomatis saat aset dibuat.
- Contoh kategori: Elektromedik, Alat Penunjang, Furnitur, Perangkat IT, Kendaraan, Alat Rumah Tangga.

### FR-04 — Vendor / Penyedia (P1)

Menyimpan data penyedia barang dan penyedia jasa servis/kalibrasi: nama, kontak, alamat,
jenis (penyedia barang, jasa servis, lembaga kalibrasi).

### FR-05 — Manajemen Pengguna (P0)

Tidak ada pendaftaran mandiri. Admin mengundang pengguna lewat email; pengguna menetapkan
kata sandi melalui tautan undangan.

**Acceptance criteria**
- Admin dapat mengundang, menonaktifkan, dan mengubah peran pengguna.
- Pengguna berperan `PIC_ROOM` wajib dikaitkan dengan satu atau lebih lokasi.
- Menonaktifkan pengguna tidak menghapus riwayat yang pernah dicatatnya.
- Undangan kedaluwarsa dalam 7 hari dan dapat dikirim ulang.

---

## B. Manajemen Aset

### FR-06 — Pendaftaran Aset (P0)

Formulir pendaftaran aset baru.

**Field wajib:** nama, kategori, lokasi (ruangan), kondisi awal, tanggal perolehan.
**Field opsional:** merek, model, nomor seri, sumber dana, nilai perolehan, nomor dokumen
perolehan, vendor, garansi berakhir, umur ekonomis, PIC perorangan, foto utama, catatan,
aset induk.

**Acceptance criteria**
- Sistem menghasilkan `public_id` acak 12 karakter dan `asset_code` yang dapat dibaca manusia
  dengan pola `{KODE_RS}-{KODE_INSTALASI}-{TAHUN}-{URUTAN}`, contoh `RSXX-RAD-2026-0012`.
- `asset_code` unik dalam satu organisasi. `public_id` unik secara global.
- Nomor seri, bila diisi, tidak boleh duplikat dalam satu organisasi — sistem memperingatkan
  bila ditemukan kembar, tetapi tetap mengizinkan setelah konfirmasi.
- Setelah tersimpan, aset otomatis memiliki entri riwayat pertama bertipe `CREATED`.
- Aset berkategori medis otomatis dibuatkan jadwal kalibrasi bila intervalnya tersedia.
- Aset baru berstatus `AVAILABLE` kecuali dipilih lain.

### FR-07 — Aset Induk dan Anak (P1)

Sebuah aset dapat memiliki aset induk (contoh: sirkuit dan troli milik satu ventilator).

**Acceptance criteria**
- Kedalaman maksimal satu tingkat pada v1 (induk tidak boleh punya induk).
- Halaman aset induk menampilkan daftar aset anak.
- Memindahkan aset induk ke ruangan lain menawarkan untuk memindahkan seluruh anaknya.

### FR-08 — Pencarian dan Daftar Aset (P0)

**Acceptance criteria**
- Pencarian teks bebas atas nama, kode aset, nomor seri, merek, dan model.
- Filter: lokasi (termasuk seluruh anaknya), kategori, status, kondisi, PIC, rentang tanggal perolehan,
  jatuh tempo kalibrasi.
- Pengurutan dan pagination.
- Ekspor hasil yang sedang terfilter ke Excel/CSV.

### FR-09 — Status Aset dan Transisi (P0)

Status yang berlaku: `AVAILABLE`, `IN_USE`, `ON_LOAN`, `UNDER_REPAIR`, `AT_VENDOR`,
`DAMAGED`, `LOST`, `DISPOSED`.

**Acceptance criteria**
- Perubahan status hanya melalui transisi yang sah (lihat [03-erd.md](03-erd.md) bagian State Machine).
- Setiap perubahan status menghasilkan entri riwayat berisi status sebelum dan sesudah.
- Aset berstatus `DISPOSED` tidak dapat dipinjam, dipindah, atau diubah; hanya dapat dibaca.
- Status `ON_LOAN` hanya boleh diubah melalui proses pengembalian, bukan pengubahan manual.

### FR-10 — Mutasi / Transfer Ruangan (P0)

Perpindahan permanen aset ke ruangan lain, berbeda dari peminjaman.

**Acceptance criteria**
- Formulir memerlukan ruangan tujuan, alasan, dan tanggal kejadian; foto opsional.
- PIC aset otomatis mengikuti PIC ruangan tujuan, tetapi dapat ditimpa manual.
- Menghasilkan entri riwayat `TRANSFER` yang menyimpan ruangan asal dan tujuan.
- Aset berstatus `ON_LOAN` tidak dapat dimutasi sebelum dikembalikan.

### FR-11 — Penghapusan Aset (P0)

Aset tidak pernah benar-benar dihapus dari basis data.

**Acceptance criteria**
- Hanya peran Admin dan Super Admin yang dapat menghapuskan aset.
- Wajib mengisi alasan (rusak total, hilang, dihibahkan, dijual, kedaluwarsa) dan tanggal.
- Status berubah menjadi `DISPOSED` dan aset hilang dari daftar default, tetapi halaman
  publiknya tetap dapat diakses dan menampilkan penanda "Aset telah dihapuskan".

---

## C. QR Code dan Label

### FR-12 — Generate QR (P0)

**Acceptance criteria**
- QR berisi URL absolut `https://{domain}/a/{public_id}` — tidak ada data aset di dalam QR.
- QR dihasilkan on-demand, tidak disimpan sebagai berkas.
- Tingkat koreksi kesalahan **M**, dengan `quiet zone` minimal 4 modul.

### FR-13 — Cetak Label (P0)

Dua mode cetak.

**Acceptance criteria**
- **Label tunggal** dengan ukuran siap printer thermal (default 50 × 30 mm dan 62 × 29 mm).
- **Lembar A4** berisi banyak label sekaligus untuk printer biasa, dengan opsi memilih
  banyak aset dari daftar.
- Isi label: QR, `asset_code`, nama aset dipotong, nama ruangan, logo/nama RS.
- Pratinjau cetak sesuai hasil akhir, dengan CSS `@media print` yang tidak menyertakan
  elemen antarmuka.

### FR-14 — Cetak Ulang Label (P0)

**Acceptance criteria**
- Mencetak ulang **tidak pernah** mengubah `public_id`. Label pengganti mengarah ke aset yang sama.
- Setiap pencetakan tercatat: siapa, kapan, alasan (label pertama, rusak, hilang, pudar).
- Riwayat pencetakan terlihat di halaman aset.

---

## D. Riwayat Aset

### FR-15 — Pencatatan Riwayat (P0)

Inti sistem. Riwayat bersifat **append-only**.

Jenis entri: `CREATED`, `INSPECTION`, `MAINTENANCE`, `REPAIR`, `CALIBRATION`, `LOAN_OUT`,
`LOAN_RETURN`, `TRANSFER`, `STATUS_CHANGE`, `NOTE`, `DISPOSAL`, `CORRECTION`, `LABEL_PRINTED`.

**Acceptance criteria**
- Setiap entri menyimpan: jenis, **waktu kejadian** (dapat diisi mundur), **waktu pencatatan**
  (otomatis, tidak dapat diubah), pencatat, judul, catatan, dan lampiran.
- Waktu kejadian tidak boleh melewati waktu sekarang.
- Bila waktu kejadian berbeda lebih dari 24 jam dari waktu pencatatan, UI menampilkan
  penanda "dicatat mundur" pada linimasa.
- Entri tidak dapat diubah maupun dihapus oleh peran mana pun, termasuk Super Admin.
- Linimasa ditampilkan berurutan berdasarkan waktu kejadian, terbaru di atas.

### FR-16 — Koreksi Riwayat (P0)

**Acceptance criteria**
- Pengguna dengan izin menulis dapat membuat entri `CORRECTION` yang menunjuk satu entri lama.
- Entri yang dikoreksi tetap tampil, diberi tanda "telah dikoreksi" dan tautan ke koreksinya.
- Entri koreksi wajib berisi alasan.

### FR-17 — Lampiran Foto (P0)

**Acceptance criteria**
- Maksimal **5 lampiran** per entri riwayat.
- Format yang diterima: JPEG, PNG, WebP, dan PDF (untuk sertifikat).
- Gambar dikompresi di sisi peramban sebelum diunggah, sisi terpanjang maksimum 1.600 px,
  target di bawah 500 KB. Batas keras 10 MB per berkas.
- Unggahan langsung ke penyimpanan objek memakai presigned URL; berkas tidak melewati server aplikasi.
- Basis data hanya menyimpan kunci objek dan metadata.
- Lampiran hanya dapat dilihat setelah login, melalui URL bertanda tangan berumur pendek.

---

## E. Peminjaman

### FR-18 — Peminjaman Keluar (P0)

**Acceptance criteria**
- Peminjam dapat berupa pengguna terdaftar **atau** orang luar. Untuk orang luar wajib:
  **nama**, **nomor HP**, **keperluan**. Unit/ruangan asal bersifat opsional.
- Tanggal jatuh tempo **opsional**.
- Tidak ada persetujuan. Peminjaman langsung aktif saat disimpan.
- Aset yang sedang `ON_LOAN`, `UNDER_REPAIR`, `AT_VENDOR`, `LOST`, atau `DISPOSED`
  tidak dapat dipinjam; sistem menolak dengan pesan yang menyebut status saat ini.
- Menyimpan peminjaman mengubah status aset menjadi `ON_LOAN` dan membuat entri riwayat `LOAN_OUT`.
- Pencatat selalu tersimpan sebagai `recorded_by`, terpisah dari identitas peminjam.
- Foto kondisi saat serah terima bersifat opsional tetapi dianjurkan.

### FR-19 — Pengembalian (P0)

**Acceptance criteria**
- Formulir pengembalian mencatat waktu kembali, kondisi saat kembali, catatan, dan foto opsional.
- Status aset kembali ke `AVAILABLE`, atau ke `DAMAGED` bila kondisi dilaporkan rusak.
- Membuat entri riwayat `LOAN_RETURN` yang tertaut ke peminjamannya.

### FR-20 — Pemantauan Peminjaman (P0)

**Acceptance criteria**
- Daftar seluruh peminjaman aktif dengan lama pinjam.
- Penanda otomatis untuk peminjaman yang melewati jatuh tempo, dan untuk peminjaman tanpa
  jatuh tempo yang sudah berjalan lebih dari **7 hari**.
- Ambang 7 hari tersebut dapat dikonfigurasi pada tingkat organisasi.

---

## F. Pemeliharaan dan Kalibrasi

### FR-21 — Jadwal (P0)

**Acceptance criteria**
- Satu aset dapat memiliki beberapa jadwal bertipe `CALIBRATION` atau `PREVENTIVE`.
- Jadwal berisi interval dalam bulan, tanggal pelaksanaan terakhir, dan tanggal jatuh tempo berikutnya.
- Jatuh tempo berikutnya dihitung otomatis dari tanggal pelaksanaan terakhir ditambah interval,
  tetapi dapat ditimpa manual (mengikuti tanggal yang tertera pada sertifikat).

### FR-22 — Pencatatan Pelaksanaan (P0)

**Acceptance criteria**
- Mencatat pelaksanaan kalibrasi memerlukan tanggal pelaksanaan, pelaksana (vendor atau internal),
  hasil (lulus / lulus bersyarat / tidak lulus), dan berlaku sampai kapan.
- Nomor sertifikat dan berkas sertifikat dapat diunggah.
- Hasil "tidak lulus" mengubah status aset menjadi `DAMAGED` dan memunculkan peringatan
  bahwa alat tidak boleh digunakan.
- Menghasilkan entri riwayat `CALIBRATION` atau `MAINTENANCE`.

### FR-23 — Dashboard Jatuh Tempo (P0)

**Acceptance criteria**
- Pengelompokan: sudah lewat, jatuh tempo 7 hari ke depan, 30 hari ke depan, 90 hari ke depan.
- Dapat difilter per instalasi dan per kategori.
- Dapat diekspor.

---

## G. Halaman Publik Hasil Scan

### FR-24 — Halaman Publik (P0)

URL `/a/{public_id}` dapat diakses tanpa login.

**Yang ditampilkan:** nama aset, kode aset, kategori, merek dan model, ruangan saat ini,
status saat ini, kondisi, nama PIC ruangan, tanggal kalibrasi berikutnya bila ada,
dan **riwayat ringkas 10 entri terakhir** berisi tanggal, jenis, dan judul.

**Yang disembunyikan:** nomor seri, nilai perolehan, sumber dana, vendor, nomor dokumen,
seluruh lampiran foto, isi catatan lengkap, identitas dan nomor HP peminjam, nama pencatat.

**Acceptance criteria**
- Halaman dapat dibuka tanpa sesi login dan responsif untuk layar ponsel.
- Terdapat tombol "Masuk untuk detail lengkap" yang mengembalikan pengguna ke halaman aset
  yang sama setelah login.
- Pengguna yang sudah login dan berwenang langsung diarahkan ke tampilan penuh.
- `public_id` yang tidak dikenal menampilkan halaman 404 netral tanpa membocorkan informasi apa pun.
- Terdapat pembatasan laju permintaan per alamat IP.

### FR-25 — Pemindaian QR dari Aplikasi (P0)

**Acceptance criteria**
- Tombol pindai di dalam aplikasi membuka kamera peramban dan langsung menuju aset saat terbaca.
- Tersedia isian manual `asset_code` sebagai cadangan bila kamera tidak tersedia atau label rusak.
- Bila akses kamera ditolak, sistem menampilkan panduan yang jelas, bukan layar kosong.

---

## H. Dashboard, Laporan, Notifikasi

### FR-26 — Dashboard (P0)

Menampilkan: total aset per status, aset per instalasi, kalibrasi jatuh tempo, peminjaman
aktif dan yang telat, aset dalam perbaikan, dan aktivitas terakhir.
Pengguna `PIC_ROOM` hanya melihat cakupan ruangannya.

### FR-27 — Laporan dan Ekspor (P1)

- Daftar aset per ruangan (berita acara inventaris ruangan)
- Riwayat aset lengkap untuk satu aset (dapat dicetak)
- Rekap peminjaman dalam rentang tanggal
- Rekap kalibrasi dan kepatuhannya
- Rekap aset hilang dan dihapuskan

Format ekspor: Excel (XLSX) dan CSV.

### FR-28 — Notifikasi Email (P0)

**Acceptance criteria**
- Ringkasan harian pukul 07:00 WIB ke Admin dan PIC terkait berisi jatuh tempo kalibrasi
  dalam 30 hari dan peminjaman yang telah melewati ambang.
- Email undangan pengguna dan email atur ulang kata sandi.
- Email tidak dikirim bila tidak ada isi yang perlu dilaporkan.
- Setiap pengiriman tercatat pada log agar kegagalan dapat ditelusuri.

### FR-29 — Impor Massal (P1)

**Acceptance criteria**
- Unggah Excel/CSV dengan templat yang disediakan.
- Pratinjau dan validasi sebelum menyimpan; baris bermasalah dilaporkan beserta nomor barisnya.
- Impor bersifat transaksional per batch dan menghasilkan entri `CREATED` untuk setiap aset.
- Setelah impor, tersedia tautan langsung untuk mencetak seluruh label hasil impor.

---

## I. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Target |
|---|---|---|
| NFR-01 | Waktu muat halaman publik hasil scan | < 1,5 detik pada jaringan 4G |
| NFR-02 | Waktu tanggap pencarian aset | < 500 ms untuk 2.000 aset |
| NFR-03 | Ketersediaan layanan | 99% pada jam kerja |
| NFR-04 | Cadangan basis data | Otomatis harian, disimpan 30 hari, diuji pulih tiap kuartal |
| NFR-05 | Enkripsi transit | HTTPS wajib, HSTS aktif |
| NFR-06 | Kata sandi | Minimal 10 karakter, di-hash dengan Argon2id |
| NFR-07 | Sesi | Kedaluwarsa 12 jam, dapat dicabut dari sisi admin |
| NFR-08 | Audit | Seluruh aksi tulis tercatat dengan pelaku dan waktu |
| NFR-09 | Responsif | Berfungsi penuh pada lebar layar 360 px |
| NFR-10 | Aksesibilitas | Kontras memenuhi WCAG AA, seluruh form dapat dioperasikan dengan keyboard |
| NFR-11 | Bahasa dan waktu | Antarmuka Bahasa Indonesia, seluruh waktu disimpan UTC dan ditampilkan WIB |
| NFR-12 | Retensi lampiran | Foto disimpan minimal 5 tahun atau selama aset aktif |

## J. Metrik Keberhasilan Produk

- Rasio aset berlabel terhadap total aset terdaftar
- Jumlah entri riwayat per aset per bulan (indikator pemakaian nyata)
- Rata-rata selisih antara waktu kejadian dan waktu pencatatan (indikator disiplin)
- Persentase peminjaman yang ditutup dengan pengembalian tercatat
- Persentase alat medis dengan kalibrasi berlaku
