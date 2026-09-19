# 11 — Asumsi dan Pertanyaan Terbuka

---

## A. Keputusan yang Sudah Final

Ditetapkan dalam diskusi perencanaan, 19 September 2026.

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

---

## B. Asumsi yang Saya Ambil Sendiri

Butir-butir ini tidak dibahas secara eksplisit. Saya memutuskannya agar dokumen dapat
selesai, dan masing-masing **dapat diubah dengan biaya rendah** kecuali disebut sebaliknya.

| # | Asumsi | Biaya mengubah |
|---|---|---|
| B-01 | Tanggal jatuh tempo peminjaman bersifat opsional, dengan peringatan otomatis setelah 7 hari | Rendah |
| B-02 | `asset_code` berpola `{KODE_RS}-{KODE_INSTALASI}-{TAHUN}-{URUTAN}` | Rendah sebelum label dicetak, **tinggi sesudahnya** |
| B-03 | `asset_code` tidak berubah ketika aset dimutasi antar instalasi | Sedang |
| B-04 | Maksimal 5 lampiran per entri riwayat, 10 MB per berkas | Rendah |
| B-05 | Aset induk-anak dibatasi satu tingkat | Sedang |
| B-06 | Akun hanya lahir dari undangan; tidak ada pendaftaran mandiri | Rendah |
| B-07 | Peran `TECHNICIAN` tidak melihat nilai perolehan aset | Rendah |
| B-08 | Sesi berumur 12 jam | Rendah |
| B-09 | Tidak ada autentikasi dua faktor di v1 | Rendah |
| B-10 | Satu bahasa (Indonesia) dan satu zona waktu (WIB) | Sedang |
| B-11 | Laporan dibuat sinkron, tanpa antrean | Rendah |
| B-12 | Ukuran label bawaan 50 × 30 mm, dengan varian mini 25 × 15 mm | Rendah |
| B-13 | Lampiran disimpan minimal 5 tahun | Rendah |
| B-14 | Penghapusan data pribadi dilakukan dengan menganonimkan nama peminjam, bukan menghapus riwayat | Rendah |
| B-15 | Status `DISPOSED` bersifat final dan tidak dapat dikembalikan | Sedang |

Bila ada yang tidak sesuai, sebutkan nomornya dan saya sesuaikan dokumennya.

---

## C. Pertanyaan yang Masih Perlu Dijawab

Tidak satu pun menghambat dimulainya M0. Namun masing-masing memiliki tenggat kapan
jawabannya dibutuhkan.

### C-01 — Domain produksi *(dibutuhkan sebelum M2 selesai — paling mendesak)*

URL produksi masuk ke dalam setiap QR yang dicetak. Mencetak label dengan domain sementara
berarti mencetak ulang seluruhnya nanti.

**Yang dibutuhkan:** nama domain final dan kepastian bahwa DNS-nya dapat diarahkan ke VPS.

### C-02 — Status rumah sakit: pemerintah atau swasta *(dibutuhkan sebelum M2)*

Menentukan apakah field sumber dana, nomor dokumen perolehan, dan format kode aset perlu
mengikuti ketentuan aset daerah. RS pemerintah biasanya wajib merekonsiliasi dengan
aplikasi aset milik pemda.

**Yang dibutuhkan:** status RS, dan bila pemerintah, contoh format kode inventaris yang
dipakai saat ini.

### C-03 — Sistem inventaris yang sudah berjalan *(dibutuhkan sebelum M6)*

Apakah sudah ada daftar aset dalam Excel atau aplikasi lain yang bisa diimpor? Ini menentukan
bentuk templat impor massal dan apakah nomor inventaris lama perlu disimpan sebagai rujukan.

**Yang dibutuhkan:** contoh berkas daftar aset yang ada saat ini, apa pun bentuknya.

### C-04 — Instalasi mana yang menjadi percontohan *(dibutuhkan sebelum M8)*

Pilihan ini menentukan keberhasilan uji coba. Yang dicari: aset bernilai cukup banyak,
PIC yang kooperatif, dan jumlah aset tidak lebih dari sekitar 150 unit.

### C-05 — Interval kalibrasi per kategori *(dibutuhkan sebelum M5)*

Saya mengasumsikan 12 bulan untuk seluruh alat medis. Kenyataannya berbeda per jenis alat
dan sebagian mengikuti ketentuan pabrikan.

**Yang dibutuhkan:** daftar kategori alat medis beserta interval kalibrasinya.

### C-06 — SMTP yang akan dipakai *(dibutuhkan sebelum M6)*

Apakah RS memiliki server SMTP sendiri, atau akan memakai layanan luar? Bila memakai layanan
luar, email keluar dari domain RS memerlukan penyiapan SPF dan DKIM agar tidak masuk ke spam.

### C-07 — Pengadaan printer label *(dibutuhkan sebelum M8)*

Apakah anggaran printer thermal transfer tersedia, atau uji coba akan memakai stiker vinyl
pada printer laser yang ada? Keduanya bisa dijalankan; yang penting keputusannya diambil
sebelum pendataan percontohan dimulai.

### C-08 — Survei sinyal *(dibutuhkan sebelum M8)*

Ruangan mana saja yang tidak memiliki sinyal seluler atau Wi-Fi memadai? Bila jumlahnya
banyak, mode offline naik prioritas dari v2 menjadi kebutuhan mendesak.

**Cara memeriksanya:** berjalan keliling instalasi percontohan sambil membuka sebuah halaman
web di ponsel, catat ruangan yang gagal memuat.

### C-09 — Kepemilikan dan pemeliharaan sistem *(dibutuhkan sebelum go-live)*

Siapa yang akan merawat VPS setelah pengembangan selesai? Siapa yang menanggapi peringatan
cadangan gagal pada pukul dua pagi? Sistem tanpa pemilik yang jelas akan berhenti dirawat
dalam hitungan bulan.

### C-10 — Kebijakan IT rumah sakit *(sebaiknya diperiksa lebih awal)*

Apakah ada ketentuan internal yang melarang data aset disimpan di luar jaringan RS? VPS
umumnya berada di luar. Ini tidak menyangkut data pasien, tetapi sebagian rumah sakit tetap
memiliki aturan tersendiri.

---

## D. Hal yang Sengaja Tidak Ditangani

Bukan karena terlupa, melainkan karena diputuskan berada di luar batas sistem ini.

| Hal | Alasan |
|---|---|
| Penyusutan dan nilai buku | Ranah sistem akuntansi. Sistem ini melacak keberadaan fisik, bukan nilai finansial |
| Pengadaan dan tender | Sistem berbeda. Aset masuk ke sini setelah diterima |
| Manajemen suku cadang | Bagian dari stok, bukan aset per-unit |
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
