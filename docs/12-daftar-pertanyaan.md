# 12 — Daftar Pertanyaan yang Perlu Dijawab

Lembar kerja untuk mengumpulkan informasi yang belum tersedia saat perencanaan.
Isi kolom **Jawaban** langsung di berkas ini, lalu commit. Tidak perlu menjawab semuanya
sekaligus — kolom **Dibutuhkan sebelum** menunjukkan tenggat masing-masing.

Bagian A ditujukan untuk tim pengembang dan pemilik proyek.
Bagian B ditujukan untuk pihak rumah sakit, dan ditulis agar dapat diteruskan apa adanya
kepada orang non-teknis.

Legenda status: ⬜ belum dijawab · 🟡 sedang dikumpulkan · ✅ selesai

---

# Bagian A — Untuk Tim Pengembang

## A-01 · Domain produksi ⬜

**Dibutuhkan sebelum:** M2 selesai — **paling mendesak dari seluruh daftar ini**

**Pertanyaan:** Apa nama domain final yang akan dipakai sistem ini?

**Mengapa penting:** Alamat domain tertanam di dalam setiap QR Code yang dicetak.
Mengubah domain setelah label tercetak berarti mencetak dan menempel ulang seluruh label,
satu per satu, di seluruh rumah sakit. Ini satu-satunya kesalahan dalam proyek ini yang
biayanya bersifat fisik dan berlipat sesuai jumlah aset.

**Yang perlu dipastikan:**
- [ ] Nama domain sudah final dan disetujui pihak RS
- [ ] DNS-nya dapat diarahkan ke VPS
- [ ] Ada subdomain kedua untuk berkas, misalnya `berkas.{domain}`

> Jawaban:
> - Domain aplikasi:
> - Domain berkas:
> - Siapa yang mengelola DNS:

---

## A-02 · VPS ⬜

**Dibutuhkan sebelum:** M0 selesai

**Pertanyaan:** Di mana VPS akan disewa, dan dengan spesifikasi apa?

**Mengapa penting:** VPS perlu hidup sejak awal, bukan menjelang penyebaran. Halaman hasil
pemindaian harus dapat diuji dari ponsel sungguhan di dalam gedung RS sebelum label dicetak
massal. Menguji di laptop pengembang tidak membuktikan apa pun tentang sinyal dan kamera
di lapangan.

**Anjuran:** 4 vCPU, 8 GB RAM, 160 GB SSD, Ubuntu 24.04 LTS, lokasi Indonesia atau Singapura.

> Jawaban:
> - Penyedia:
> - Spesifikasi:
> - Lokasi server:
> - Sudah aktif sejak:

---

## A-03 · Tujuan penyimpanan cadangan ⬜

**Dibutuhkan sebelum:** go-live

**Pertanyaan:** Ke mana salinan cadangan akan dikirim?

**Mengapa penting:** Cadangan yang tersimpan di disk yang sama dengan datanya bukanlah
cadangan. Ketika VPS bermasalah, keduanya hilang bersamaan.

**Pilihan yang umum:** Cloudflare R2, Backblaze B2, atau penyimpanan objek milik penyedia
VPS yang sama tetapi di wilayah berbeda.

> Jawaban:
> - Tujuan cadangan:
> - Siapa yang memegang kredensialnya:

---

## A-04 · Kepemilikan sistem setelah selesai ⬜

**Dibutuhkan sebelum:** go-live

**Pertanyaan:** Siapa yang merawat sistem ini setelah pengembangan selesai? Siapa yang
menanggapi peringatan cadangan gagal?

**Mengapa penting:** Sistem tanpa pemilik yang jelas berhenti dirawat dalam hitungan bulan.
Sertifikat kedaluwarsa, disk penuh, cadangan berhenti diam-diam, dan tidak ada yang menyadari
sampai terjadi kehilangan data.

> Jawaban:
> - Penanggung jawab teknis:
> - Alamat email penerima peringatan:
> - Penanggung jawab pengganti:

---

# Bagian B — Untuk Pihak Rumah Sakit

Bagian ini dapat diteruskan langsung kepada bagian aset, IPSRS, atau manajemen RS.

---

## B-01 · Status rumah sakit ⬜

**Dibutuhkan sebelum:** M2 — penomoran aset mengikuti jawaban ini

**Pertanyaan:** Apakah rumah sakit ini milik pemerintah (RSUD, BLUD, TNI/Polri, kementerian)
atau swasta?

**Mengapa ditanyakan:** Rumah sakit pemerintah umumnya wajib merekonsiliasi daftar asetnya
dengan aplikasi aset milik pemerintah daerah atau kementerian. Bila demikian, format kode
aset dan beberapa isian tambahan perlu disesuaikan agar pencocokan data kelak tidak
dikerjakan manual.

**Bila milik pemerintah, mohon lampirkan:**
- [ ] Contoh format kode inventaris yang dipakai saat ini
- [ ] Nama aplikasi aset yang dipakai, bila ada
- [ ] Contoh satu lembar Kartu Inventaris Ruangan (KIR), bila ada

> Jawaban:
> - Status RS:
> - Aplikasi aset yang dipakai:
> - Contoh format kode saat ini:

---

## B-02 · Daftar aset yang sudah ada ⬜

**Dibutuhkan sebelum:** M6

**Pertanyaan:** Apakah sudah ada daftar barang, dalam bentuk apa pun?

**Mengapa ditanyakan:** Bila sudah ada daftar, data dapat dimasukkan secara massal alih-alih
diketik satu per satu. Untuk seribu barang, perbedaannya adalah beberapa jam dibandingkan
beberapa minggu.

**Bentuk apa pun berguna** — Excel, Google Sheets, hasil cetakan aplikasi lama, bahkan foto
buku inventaris. Tidak perlu dirapikan dulu; kami yang akan menyesuaikan.

**Yang perlu diketahui:**
- [ ] Berkasnya (salinan apa adanya)
- [ ] Kira-kira seberapa akurat isinya
- [ ] Kapan terakhir diperbarui
- [ ] Apakah nomor inventaris lama perlu tetap tersimpan sebagai rujukan

> Jawaban:
> - Bentuk daftar yang ada:
> - Perkiraan jumlah baris:
> - Terakhir diperbarui:
> - Nomor lama perlu disimpan:

---

## B-03 · Struktur lokasi ⬜

**Dibutuhkan sebelum:** M1

**Pertanyaan:** Bagaimana susunan gedung, lantai, instalasi, dan ruangan di rumah sakit ini?

**Mengapa ditanyakan:** Setiap barang ditempatkan pada sebuah ruangan, dan ruangan itu
bernaung di bawah instalasi. Susunan ini juga menentukan siapa melihat data apa: penanggung
jawab Instalasi Radiologi hanya melihat barang di lingkup radiologi.

**Mohon diisi dengan format berikut:**

| Gedung | Lantai | Instalasi/Departemen | Kode Instalasi | Ruangan | Penanggung Jawab |
|---|---|---|---|---|---|
| Gedung A | 2 | Instalasi Radiologi | RAD | Ruang CT-Scan | |
| Gedung A | 2 | Instalasi Radiologi | RAD | Ruang Rontgen 1 | |
| | | | | | |

**Catatan tentang kode instalasi:** kode pendek 2–4 huruf yang akan muncul di setiap kode
barang, misalnya `RAD-2026-0012`. Kode ini ikut tercetak di label, jadi sebaiknya ditetapkan
sekali dan tidak diubah. Gunakan singkatan yang sudah biasa dipakai di RS bila ada.

---

## B-04 · Kategori barang dan jadwal kalibrasi ⬜

**Dibutuhkan sebelum:** M5

**Pertanyaan:** Kategori alat apa saja yang ada, dan berapa lama sekali masing-masing wajib
dikalibrasi?

**Mengapa ditanyakan:** Sistem akan mengingatkan sebelum kalibrasi jatuh tempo. Agar
pengingatnya benar, interval tiap jenis alat perlu diketahui. Untuk sementara kami
mengasumsikan dua belas bulan untuk semua alat medis, dan asumsi itu hampir pasti tidak
tepat untuk sebagian alat.

**Mohon diisi:**

| Kategori | Alat medis? | Interval kalibrasi | Dasar ketentuan |
|---|---|---|---|
| Elektromedik | Ya | 12 bulan | Ketentuan pabrikan |
| Alat Penunjang Medis | Ya | | |
| Perangkat IT | Tidak | — | — |
| Furnitur | Tidak | — | — |
| | | | |

**Pertanyaan tambahan:**
- [ ] Siapa lembaga kalibrasi yang biasa digunakan?
- [ ] Apakah sertifikat kalibrasi selama ini disimpan? Di mana?
- [ ] Apakah ada alat yang kalibrasinya ditangani langsung oleh pabrikan?

---

## B-05 · Instalasi percontohan ⬜

**Dibutuhkan sebelum:** M8

**Pertanyaan:** Instalasi mana yang akan menjadi tempat uji coba pertama?

**Mengapa ditanyakan:** Sistem tidak diterapkan ke seluruh rumah sakit sekaligus. Satu
instalasi dijalankan lebih dulu selama sebulan penuh, temuannya diperbaiki, baru melebar.
Menerapkan serentak berarti pendataan berbulan-bulan, tidak ada yang memakai sistemnya, dan
data pertama sudah basi sebelum data terakhir masuk.

**Kriteria instalasi yang baik untuk percontohan:**
- Memiliki alat bernilai yang memang perlu dilacak
- Penanggung jawabnya kooperatif dan bersedia mencoba hal baru
- Jumlah barangnya tidak lebih dari sekitar 150 unit
- Sinyal internetnya memadai

> Jawaban:
> - Instalasi yang dipilih:
> - Perkiraan jumlah barang:
> - Nama penanggung jawabnya:
> - Alasan pemilihan:

---

## B-06 · Survei sinyal ⬜

**Dibutuhkan sebelum:** M8

**Pertanyaan:** Ruangan mana saja yang sinyal internetnya lemah atau tidak ada?

**Mengapa ditanyakan:** Pencatatan dilakukan lewat ponsel di lokasi barang berada. Ruang
radiologi berperisai timbal, basement, dan ruang dengan dinding tebal sering tidak memiliki
sinyal sama sekali. Bila jumlah ruangan semacam itu banyak, kemampuan mencatat tanpa sinyal
naik dari rencana jangka panjang menjadi kebutuhan mendesak.

**Cara memeriksanya — sederhana, sekitar tiga puluh menit:**

1. Berjalan keliling instalasi percontohan sambil membawa ponsel.
2. Di setiap ruangan, buka sebuah halaman web apa pun.
3. Catat ruangan yang gagal memuat atau terasa sangat lambat.
4. Catat pula apakah Wi-Fi rumah sakit menjangkau ruangan tersebut.

| Ruangan | Sinyal seluler | Wi-Fi RS | Catatan |
|---|---|---|---|
| | | | |

---

## B-07 · Email pengirim notifikasi ⬜

**Dibutuhkan sebelum:** M6

**Pertanyaan:** Apakah rumah sakit memiliki server email sendiri, dan alamat apa yang akan
dipakai sebagai pengirim notifikasi?

**Mengapa ditanyakan:** Sistem mengirim ringkasan harian berisi jatuh tempo kalibrasi dan
barang yang belum kembali. Email yang dikirim atas nama domain rumah sakit memerlukan
penyiapan teknis singkat oleh pengelola domain, agar tidak berakhir di folder spam.

> Jawaban:
> - Alamat pengirim yang diinginkan:
> - Ada server email sendiri:
> - Siapa yang mengelola domain email:

---

## B-08 · Printer dan label ⬜

**Dibutuhkan sebelum:** M8

**Pertanyaan:** Apakah tersedia anggaran untuk printer label khusus, atau uji coba akan
memakai printer yang sudah ada?

**Mengapa ditanyakan:** Permukaan alat di rumah sakit diseka alkohol beberapa kali sehari.
Stiker kertas biasa akan luntur dalam hitungan minggu, dan QR yang luntur berarti barang
tersebut kehilangan seluruh manfaat sistem ini — pelabelannya harus diulang dari awal.

**Pilihan yang tersedia:**

| Pilihan | Ketahanan | Biaya awal |
|---|---|---|
| Printer thermal transfer + label polyester | Bertahun-tahun | Printer sekitar 2–5 juta |
| Printer laser biasa + stiker vinyl A4 | Satu sampai dua tahun | Tanpa alat baru |
| Printer laser biasa + stiker kertas | Beberapa minggu | Termurah, **tidak dianjurkan** |

**Anjuran:** mulai dengan stiker vinyl agar uji coba tidak tertunda menunggu pengadaan,
tetapi masukkan printer thermal ke rencana anggaran sebelum pelabelan melebar ke seluruh RS.

> Jawaban:
> - Pilihan untuk uji coba:
> - Anggaran printer tersedia:
> - Printer yang sudah ada saat ini:

---

## B-09 · Kebijakan IT rumah sakit ⬜

**Dibutuhkan sebelum:** sebaiknya diperiksa paling awal

**Pertanyaan:** Apakah ada ketentuan internal yang mengatur di mana data rumah sakit boleh
disimpan?

**Mengapa ditanyakan:** Sistem ini direncanakan berjalan di server sewaan di luar jaringan
rumah sakit. Sistem ini tidak menyimpan data pasien sama sekali — hanya data barang, ruangan,
dan pegawai yang bertanggung jawab. Meski begitu, sebagian rumah sakit memiliki ketentuan
tersendiri yang perlu diketahui sebelum pekerjaan berjalan jauh.

> Jawaban:
> - Ada ketentuan khusus:
> - Perlu persetujuan dari:
> - Kesimpulan:

---

## B-10 · Daftar pengguna awal ⬜

**Dibutuhkan sebelum:** M8

**Pertanyaan:** Siapa saja yang akan memakai sistem pada tahap uji coba, dan dengan
kewenangan apa?

**Mengapa ditanyakan:** Akun dibuat lewat undangan, bukan pendaftaran mandiri. Setiap orang
perlu ditetapkan perannya, dan penanggung jawab ruangan perlu dikaitkan dengan ruangan yang
menjadi tanggung jawabnya.

**Peran yang tersedia:**

| Peran | Untuk siapa | Kewenangan |
|---|---|---|
| Super Admin | Pengelola sistem | Semua, termasuk pengaturan |
| Admin | Bagian Aset, IPSRS | Semua barang di seluruh ruangan |
| PIC Ruangan | Kepala ruangan | Hanya barang di ruangannya |
| Teknisi | Teknisi elektromedik / IT | Mencatat perbaikan dan kalibrasi di mana pun |
| Viewer | Manajemen, auditor | Hanya melihat |

**Mohon diisi:**

| Nama | Email | Jabatan | Peran | Ruangan/Instalasi |
|---|---|---|---|---|
| | | | | |

---

# Bagian C — Asumsi yang Perlu Dikonfirmasi

Hal-hal berikut sudah kami putuskan agar perencanaan dapat selesai. Semuanya masih dapat
diubah dengan mudah pada tahap ini. Mohon diperiksa; bila ada yang tidak sesuai, sebutkan
nomornya.

| # | Asumsi | Setuju? |
|---|---|:--:|
| C-01 | Peminjaman tidak memerlukan persetujuan siapa pun — langsung berlaku saat dicatat | ⬜ |
| C-02 | Tanggal pengembalian boleh dikosongkan, tetapi barang yang dipinjam lebih dari 7 hari akan muncul sebagai perlu ditinjau | ⬜ |
| C-03 | Peminjam dari luar cukup diisi nama, nomor HP, dan keperluan | ⬜ |
| C-04 | Riwayat tidak dapat dihapus atau diubah oleh siapa pun, termasuk admin. Kesalahan diperbaiki lewat catatan koreksi, dan keduanya tetap terlihat | ⬜ |
| C-05 | Orang yang memindai QR tanpa login dapat melihat nama barang, ruangan, status, penanggung jawab, dan riwayat ringkas — tetapi tidak melihat harga, nomor seri, foto, maupun identitas peminjam | ⬜ |
| C-06 | Teknisi tidak dapat melihat nilai perolehan barang | ⬜ |
| C-07 | Barang yang sudah dihapuskan dari daftar aset tidak dapat diaktifkan kembali | ⬜ |
| C-08 | Setiap catatan riwayat dapat memuat maksimal 5 foto | ⬜ |
| C-09 | Foto bukti disimpan minimal 5 tahun | ⬜ |
| C-10 | Pada tahap awal sistem hanya mencatat barang bernilai per unit, belum mencatat stok barang habis pakai seperti masker dan sarung tangan | ⬜ |

---

# Ringkasan Tenggat

| Tenggat | Yang harus sudah dijawab |
|---|---|
| **Sebelum M0 selesai** | A-02 VPS, B-09 kebijakan IT |
| **Sebelum M1 selesai** | B-03 struktur lokasi |
| **Sebelum M2 selesai** | **A-01 domain (paling mendesak)**, B-01 status RS |
| **Sebelum M5 selesai** | B-04 kategori dan kalibrasi |
| **Sebelum M6 selesai** | B-02 daftar aset, B-07 email |
| **Sebelum M8 dimulai** | B-05 instalasi percontohan, B-06 survei sinyal, B-08 printer, B-10 pengguna |
| **Sebelum go-live** | A-03 cadangan, A-04 kepemilikan sistem |
| **Kapan saja, makin cepat makin baik** | Seluruh Bagian C |
