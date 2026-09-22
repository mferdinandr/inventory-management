# 11 — Keputusan, Asumsi, dan Pertanyaan Terbuka

Dokumen ini menampung segala sesuatu yang **belum pasti** dalam proyek ini, sekaligus
menjadi lembar kerja untuk mengumpulkan jawabannya.

Bagian B dan C dapat diisi langsung di berkas ini lalu di-commit. Bagian C ditulis agar
dapat diteruskan apa adanya kepada pihak rumah sakit tanpa perlu diterjemahkan lebih dulu.

Legenda status: ⬜ belum dijawab · 🟡 sedang dikumpulkan · ✅ selesai

| Bagian | Isi |
|---|---|
| [A](#a-keputusan-yang-sudah-final) | Keputusan yang sudah final |
| [B](#b-asumsi-yang-perlu-dikonfirmasi) | Asumsi yang saya ambil sendiri dan perlu dikonfirmasi |
| [C](#c-pertanyaan-yang-perlu-dijawab) | Pertanyaan yang memerlukan informasi dari luar |
| [D](#d-hal-yang-sengaja-tidak-ditangani) | Hal yang sengaja berada di luar lingkup |
| [E](#e-batas-yang-perlu-diingat) | Batas skala yang perlu diingat |
| [F](#f-ringkasan-tenggat) | Ringkasan tenggat |

---

## A. Keputusan yang Sudah Final

Ditetapkan dalam diskusi perencanaan, 19 September 2026. Mengubah butir-butir ini berarti
merevisi ERD dan sebagian besar dokumen lain.

| # | Keputusan |
|---|---|
| 1 | Lingkup v1 adalah aset per-unit saja. Barang habis pakai tidak termasuk |
| 2 | Satu rumah sakit, tetapi skema menyimpan `organization_id` sejak awal |
| 3 | Riwayat bersifat append-only; koreksi lewat entri baru |
| 4 | Peminjaman tanpa persetujuan; peminjam luar cukup nama, nomor HP, dan keperluan |
| 5 | Kalibrasi versi ringkas: jadwal, sertifikat, dashboard jatuh tempo |
| 6 | Halaman hasil pemindaian bersifat publik dengan data terbatas |
| 7 | Online-only; tidak ada sinkronisasi offline di v1 |
| 8 | Notifikasi lewat email |
| 9 | Skala di bawah 2.000 aset dan 50 pengguna |
| 10 | Dijalankan di VPS sendiri dengan Docker Compose, foto di MinIO |
| 11 | Stack Next.js, PostgreSQL, Prisma, Auth.js, MinIO, Caddy |

Ditambahkan dari diskusi lanjutan, 22 September 2026:

| # | Keputusan |
|---|---|
| 12 | Kode aset tidak pernah berubah, termasuk saat aset dimutasi antar instalasi |
| 13 | Penghapusan aset dapat dibatalkan selama 30 hari; setelah itu final, tetapi barisnya tetap tersimpan |
| 14 | Aset induk dan anak tidak dibangun di v1 |
| 15 | Sesi 12 jam, dengan pilihan "Ingat saya" 7 hari |
| 16 | Autentikasi dua faktor tersedia sebagai pilihan, tidak diwajibkan |
| 17 | Foto disimpan selama asetnya masih tercatat, tanpa penghapusan otomatis |

---

## B. Asumsi yang Perlu Dikonfirmasi

Butir-butir berikut awalnya saya putuskan sendiri agar perencanaan dapat selesai.
Sebagian sudah dibahas dan dikonfirmasi pada 22 September 2026; sisanya masih terbuka.

Isi kolom **Status** dengan ✅ atau ❌. Bila ❌, tuliskan yang dikehendaki di bawah tabel.

### B.1 Peminjaman

| # | Asumsi | Status | Biaya ubah |
|---|---|:--:|---|
| AS-01 | Peminjaman tidak memerlukan persetujuan siapa pun — langsung berlaku saat dicatat | ✅ | Sedang |
| AS-02 | Tanggal jatuh tempo boleh dikosongkan, tetapi barang yang dipinjam lebih dari 7 hari muncul sebagai perlu ditinjau | ✅ | Rendah |
| AS-03 | Peminjam dari luar cukup diisi nama, nomor HP, dan keperluan | ✅ | Rendah |

### B.2 Riwayat dan Data

| # | Asumsi | Status | Biaya ubah |
|---|---|:--:|---|
| AS-04 | Riwayat tidak dapat dihapus atau diubah oleh siapa pun, termasuk admin. Kesalahan diperbaiki lewat catatan koreksi, dan keduanya tetap terlihat | ✅ | **Tinggi** |
| AS-05 | Setiap catatan riwayat dapat memuat maksimal 5 foto, masing-masing maksimal 10 MB | ✅ | Rendah |
| AS-06 | Foto bukti disimpan selama asetnya masih tercatat, termasuk setelah dihapuskan. Tidak ada penghapusan otomatis berdasarkan umur | ✅ | Rendah |
| AS-07 | Prosedur permintaan penghapusan data pribadi **belum diatur di v1**; ditangani manual bila muncul | ✅ | Rendah |

### B.3 Penomoran dan Struktur Aset

| # | Asumsi | Status | Biaya ubah |
|---|---|:--:|---|
| AS-08 | Kode aset berpola `{KODE_RS}-{KODE_INSTALASI}-{TAHUN}-{URUTAN}`, contoh `RSXX-RAD-2026-0012` | ✅ | Rendah sekarang, **tinggi setelah label dicetak** |
| AS-09 | Kode aset tidak berubah ketika barang dimutasi ke instalasi lain | ✅ | Sedang |
| AS-10 | Hubungan aset induk dan anak **tidak dibangun di v1**; setiap aset berdiri sendiri | ✅ | Rendah, cukup menambah satu kolom nullable |
| AS-11 | Penghapusan aset dapat dibatalkan selama **30 hari**. Setelah itu final, tetapi barisnya tetap tersimpan di basis data — tidak pernah dihapus secara fisik | ✅ | Sedang |

### B.4 Akses dan Keamanan

| # | Asumsi | Status | Biaya ubah |
|---|---|:--:|---|
| AS-12 | Orang yang memindai QR tanpa login melihat nama barang, ruangan, status, penanggung jawab, dan riwayat ringkas — tetapi tidak melihat harga, nomor seri, foto, maupun identitas peminjam | ✅ | Rendah |
| AS-13 | Teknisi tidak dapat melihat nilai perolehan barang | ✅ | Rendah |
| AS-14 | Akun hanya lahir dari undangan admin; tidak ada pendaftaran mandiri | ✅ | Rendah |
| AS-15 | Sesi login berumur **12 jam**, atau **7 hari** bila pengguna memilih "Ingat saya" | ✅ | Rendah |
| AS-16 | Autentikasi dua faktor tersedia dan **opsional** — setiap pengguna dapat mengaktifkannya sendiri, tidak diwajibkan peran mana pun | ✅ | Rendah |

### B.5 Operasional

| # | Asumsi | Status | Biaya ubah |
|---|---|:--:|---|
| AS-17 | Ukuran label bawaan 50 × 30 mm, dengan varian mini 25 × 15 mm | ⬜ | Rendah |
| AS-18 | Antarmuka satu bahasa (Indonesia) dan satu zona waktu (WIB) | ⬜ | Sedang |
| AS-19 | Laporan dibuat langsung saat diminta, tanpa antrean latar belakang | ⬜ | Rendah |

AS-17 sebaiknya menunggu jawaban Q-12 tentang printer, karena ukuran label mengikuti
perangkat yang tersedia.

> Catatan bila ada yang tidak disetujui:
>

---

## C. Pertanyaan yang Perlu Dijawab

Tidak satu pun menghambat dimulainya M0, tetapi masing-masing punya tenggat.
Bagian **C.1** untuk tim pengembang, bagian **C.2** untuk pihak rumah sakit.

---

### C.1 Untuk Tim Pengembang

#### Q-01 · Domain produksi ⬜

**Dibutuhkan sebelum:** M2 selesai — **paling mendesak dari seluruh daftar ini**

**Pertanyaan:** Apa nama domain final yang akan dipakai sistem ini?

**Mengapa penting:** Alamat domain tertanam di dalam setiap QR Code yang dicetak. Mengubah
domain setelah label tercetak berarti mencetak dan menempel ulang seluruh label, satu per
satu, di seluruh rumah sakit. Ini satu-satunya kesalahan dalam proyek ini yang biayanya
bersifat fisik dan berlipat sesuai jumlah aset.

**Yang perlu dipastikan:**
- [ ] Nama domain sudah final dan disetujui pihak RS
- [ ] DNS-nya dapat diarahkan ke VPS
- [ ] Ada subdomain kedua untuk berkas, misalnya `berkas.{domain}`

> Jawaban:
> - Domain aplikasi:
> - Domain berkas:
> - Pengelola DNS:

---

#### Q-02 · VPS ⬜

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

#### Q-03 · Tujuan penyimpanan cadangan ⬜

**Dibutuhkan sebelum:** go-live

**Pertanyaan:** Ke mana salinan cadangan akan dikirim?

**Mengapa penting:** Cadangan yang tersimpan di disk yang sama dengan datanya bukanlah
cadangan. Ketika VPS bermasalah, keduanya hilang bersamaan.

**Pilihan yang umum:** Cloudflare R2, Backblaze B2, atau penyimpanan objek milik penyedia
VPS yang sama tetapi di wilayah berbeda.

> Jawaban:
> - Tujuan cadangan:
> - Pemegang kredensial:

---

#### Q-04 · Kepemilikan sistem setelah selesai ⬜

**Dibutuhkan sebelum:** go-live

**Pertanyaan:** Siapa yang merawat sistem ini setelah pengembangan selesai? Siapa yang
menanggapi peringatan cadangan gagal?

**Mengapa penting:** Sistem tanpa pemilik yang jelas berhenti dirawat dalam hitungan bulan.
Sertifikat kedaluwarsa, disk penuh, cadangan berhenti diam-diam, dan tidak ada yang menyadari
sampai terjadi kehilangan data.

> Jawaban:
> - Penanggung jawab teknis:
> - Email penerima peringatan:
> - Penanggung jawab pengganti:

---

### C.2 Untuk Pihak Rumah Sakit

Bagian ini dapat diteruskan langsung kepada bagian aset, IPSRS, atau manajemen RS.

---

#### Q-05 · Status rumah sakit ⬜

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

#### Q-06 · Daftar aset yang sudah ada ⬜

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

#### Q-07 · Struktur lokasi ⬜

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

#### Q-08 · Kategori barang dan jadwal kalibrasi ⬜

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

#### Q-09 · Instalasi percontohan ⬜

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

#### Q-10 · Survei sinyal ⬜

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

#### Q-11 · Email pengirim notifikasi ⬜

**Dibutuhkan sebelum:** M6

**Pertanyaan:** Apakah rumah sakit memiliki server email sendiri, dan alamat apa yang akan
dipakai sebagai pengirim notifikasi?

**Mengapa ditanyakan:** Sistem mengirim ringkasan harian berisi jatuh tempo kalibrasi dan
barang yang belum kembali. Email yang dikirim atas nama domain rumah sakit memerlukan
penyiapan teknis singkat oleh pengelola domain, agar tidak berakhir di folder spam.

> Jawaban:
> - Alamat pengirim yang diinginkan:
> - Ada server email sendiri:
> - Pengelola domain email:

---

#### Q-12 · Printer dan label ⬜

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

#### Q-13 · Kebijakan IT rumah sakit ⬜

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

#### Q-14 · Daftar pengguna awal ⬜

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

## D. Hal yang Sengaja Tidak Ditangani

Bukan karena terlupa, melainkan karena diputuskan berada di luar batas sistem ini.

| Hal | Alasan |
|---|---|
| Penyusutan dan nilai buku | Ranah sistem akuntansi. Sistem ini melacak keberadaan fisik, bukan nilai finansial |
| Pengadaan dan tender | Sistem berbeda. Aset masuk ke sini setelah diterima |
| Manajemen suku cadang | Bagian dari stok, bukan aset per-unit |
| Hubungan aset induk dan anak | Diputuskan tidak perlu di v1; komponen dicatat di kolom catatan |
| Penjadwalan pemakaian alat | Menyerupai sistem pemesanan ruang, kebutuhan yang berbeda |
| Pelacakan lokasi waktu nyata (RFID, BLE) | Biaya perangkat jauh melampaui manfaatnya pada skala ini |
| Data dan rekam medis pasien | Sepenuhnya di luar lingkup. Tidak ada data pasien di sistem ini |

---

## E. Batas yang Perlu Diingat

Hal-hal yang akan menjadi masalah **bila skala tumbuh jauh melampaui asumsi**, beserta
tandanya:

| Batas | Tanda mulai terasa | Yang perlu dilakukan |
|---|---|---|
| Laporan dibuat sinkron | Ekspor melebihi sekitar 5.000 baris dan mulai memakan waktu | Pindahkan ke pekerjaan latar dengan pemberitahuan email |
| Worker berada dalam proses aplikasi | Tugas terjadwal mengganggu waktu tanggap halaman | Pisahkan menjadi kontainer tersendiri |
| Foto tersimpan di disk VPS | Pemakaian disk melewati 70% | Pindahkan bucket ke Cloudflare R2 |
| Satu instans aplikasi | Waktu henti saat pembaruan tidak lagi dapat diterima | Jalankan dua instans di belakang Caddy |
| Pencarian teks penuh PostgreSQL | Lebih dari sekitar 50.000 aset | Pertimbangkan mesin pencarian khusus |

Seluruh batas di atas berjarak jauh dari skala yang direncanakan. Dicatat agar ketika
tandanya muncul, penyebabnya langsung dikenali.

---

## F. Ringkasan Tenggat

| Tenggat | Yang harus sudah dijawab |
|---|---|
| **Sebelum M0 selesai** | Q-02 VPS, Q-13 kebijakan IT |
| **Sebelum M1 selesai** | Q-07 struktur lokasi |
| **Sebelum M2 selesai** | **Q-01 domain (paling mendesak)**, Q-05 status RS |
| **Sebelum M5 selesai** | Q-08 kategori dan kalibrasi |
| **Sebelum M6 selesai** | Q-06 daftar aset, Q-11 email |
| **Sebelum M8 dimulai** | Q-09 instalasi percontohan, Q-10 survei sinyal, Q-12 printer, Q-14 pengguna |
| **Sebelum go-live** | Q-03 cadangan, Q-04 kepemilikan sistem |
| **Kapan saja, makin cepat makin baik** | Seluruh Bagian B |
