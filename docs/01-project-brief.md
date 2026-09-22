# 01 — Project Brief

## 0. Bentuk Produk

SIMASET dibangun sebagai **produk SaaS multi-tenant untuk rumah sakit**, dijalankan dan
dimiliki sendiri, bukan sistem pesanan untuk satu rumah sakit tertentu.

| Aspek | Keputusan |
|---|---|
| Model | Satu instans, satu basis data, banyak rumah sakit |
| Isolasi | `organization_id` pada setiap tabel, ditambah Row Level Security |
| Onboarding | Pemilik platform membuat organisasi lewat panel operator; tidak ada pendaftaran mandiri |
| Penagihan | Di luar sistem. Organisasi cukup ditandai aktif atau tidak aktif |
| Sasaran pasar | Khusus rumah sakit — kalibrasi dan istilah instalasi adalah pembeda, bukan beban |
| Alamat publik | Satu domain bersama untuk semua pelanggan |

**Mengapa khusus rumah sakit.** Aplikasi inventaris umum sudah banyak dan sulit dibedakan.
Yang membuat produk ini punya alasan untuk dibeli adalah hal-hal yang hanya dimengerti oleh
orang rumah sakit: kalibrasi alat medis yang jatuh tempo, sertifikat yang dicari auditor
akreditasi, dan pertanyaan "alat ini terakhir dipegang siapa" yang tidak pernah terjawab.

---

## 1. Latar Belakang

Rumah sakit menyimpan aset bernilai tinggi yang tersebar di puluhan ruangan dan berpindah
tangan setiap hari: alat elektromedik, kursi roda, tempat tidur, perangkat IT, furnitur.
Saat ini perpindahan itu tidak tercatat di mana pun, atau tercatat di buku tulis dan
spreadsheet yang tidak seorang pun percayai.

Akibatnya:

- **Barang hilang tanpa jejak.** Ketika sebuah alat tidak ditemukan, tidak ada catatan
  siapa terakhir memegangnya, kapan, dan untuk keperluan apa.
- **Tanggung jawab kabur.** Saat barang rusak, tidak jelas apakah rusak karena pemakaian
  wajar atau kelalaian, dan siapa yang bertanggung jawab.
- **Riwayat perawatan tidak terdokumentasi.** Alat diperbaiki, tetapi tidak ada catatan
  kapan, oleh siapa, dengan biaya berapa, dan apa yang diganti.
- **Jatuh tempo kalibrasi terlewat.** Alat medis wajib dikalibrasi berkala, tetapi tanpa
  pengingat terpusat, jatuh tempo baru diketahui saat audit.
- **Kerugian finansial.** Pengadaan ulang barang yang sebenarnya masih ada tapi tidak
  ditemukan, dan kerugian langsung dari barang yang benar-benar hilang.

## 2. Masalah yang Diselesaikan

> Setiap barang bernilai di rumah sakit harus bisa dijawab empat pertanyaannya dalam
> sepuluh detik: **di mana**, **siapa yang bertanggung jawab**, **apa yang pernah terjadi
> padanya**, dan **kapan dia perlu diperhatikan lagi**.

## 3. Solusi

Sebuah aplikasi web di mana setiap aset memiliki identitas permanen dan riwayat yang tidak
bisa dihapus, diakses melalui QR Code yang ditempel fisik pada barang.

Tiga pilar:

1. **Identitas fisik.** Setiap aset punya QR Code unik yang dicetak dan ditempel.
   Memindainya langsung membuka halaman aset tersebut — tanpa perlu mencari, mengetik,
   atau tahu kode apa pun.
2. **Riwayat append-only.** Setiap perlakuan terhadap aset — peminjaman, pengecekan,
   perbaikan, kalibrasi, mutasi ruangan, catatan bebas — tersimpan permanen lengkap dengan
   waktu kejadian, waktu pencatatan, pelaku, dan foto bukti.
3. **Pengingat proaktif.** Sistem memberi tahu sebelum masalah terjadi: kalibrasi akan
   jatuh tempo, barang sudah lama dipinjam dan belum kembali.

## 4. Sasaran

### Sasaran bisnis

| Sasaran | Indikator | Target 6 bulan setelah live |
|---|---|---|
| Aset terdata dan berlabel | Persentase aset bernilai yang punya QR aktif | ≥ 90% |
| Peminjaman tercatat | Peminjaman yang dicatat di sistem vs total | ≥ 80% |
| Kehilangan turun | Jumlah aset berstatus `LOST` per kuartal | Turun vs baseline |
| Kepatuhan kalibrasi | Alat medis dengan kalibrasi tidak kedaluwarsa | ≥ 95% |
| Kecepatan audit | Waktu menyiapkan data aset per ruangan untuk audit | Dari hitungan hari ke hitungan menit |

### Sasaran pengalaman pengguna

- Mencatat satu peminjaman dari scan sampai tersimpan: **di bawah 60 detik**.
- Melihat riwayat lengkap sebuah aset: **satu kali scan**, tanpa login.
- Menambahkan aset baru sampai QR siap cetak: **di bawah 3 menit**.

## 5. Pengguna

| Peran | Siapa | Kebutuhan utama |
|---|---|---|
| **Platform Owner** | Anda, pemilik SIMASET | Membuat organisasi pelanggan, mengatur kuota, mendukung troubleshooting |
| **Super Admin** | IT / pengelola sistem di RS pelanggan | Kelola pengguna, master data, konfigurasi organisasinya |
| **Admin** | IPSRS, Bagian Umum, Bagian Aset | Lihat dan ubah seluruh aset lintas ruangan, laporan, penghapusan aset |
| **PIC Ruangan** | Kepala ruangan / penanggung jawab instalasi | Kelola aset di ruangannya, catat peminjaman dan pengecekan |
| **Teknisi** | Teknisi elektromedik / IT / maintenance | Catat perbaikan dan kalibrasi lintas ruangan |
| **Viewer** | Manajemen, auditor internal | Lihat data dan laporan, tanpa mengubah apa pun |
| **Publik** | Siapa pun yang memindai QR | Lihat informasi dasar dan riwayat ringkas satu aset |

## 6. Ruang Lingkup v1

### MVP — 6 minggu

- Fondasi multi-tenant: `organization_id`, Row Level Security, pemilihan organisasi
- Panel operator: membuat organisasi pelanggan, mengatur kuota, masuk sebagai organisasi
- Master data: lokasi berjenjang, kategori, pengguna
- CRUD aset dengan data perolehan dan sumber dana
- Generate, cetak, dan cetak ulang QR Code (label tunggal dan lembar A4)
- Halaman publik hasil scan dengan data terbatas
- Pemindai QR dari dalam aplikasi
- Pencatatan riwayat append-only dengan lampiran foto
- Mutasi antar ruangan, penghapusan aset dengan pembatalan 30 hari
- Peminjaman dan pengembalian, termasuk peminjam non-pengguna
- Autentikasi berbasis undangan, RBAC dengan pembatasan ruangan

### v1.1 — sekitar 3 minggu berikutnya

Wajib selesai **sebelum data pelanggan sungguhan masuk**.

- Jadwal kalibrasi dan pemeliharaan ringkas, dengan unggah sertifikat
- Dashboard: jatuh tempo, peminjaman berjalan, aset bermasalah
- Notifikasi email untuk jatuh tempo dan peminjaman yang belum kembali
- Ekspor Excel/CSV per ruangan dan per kategori
- Impor massal dari Excel
- Vendor / penyedia
- Autentikasi dua faktor opsional
- Audit log lengkap, pembatasan laju, pengerasan keamanan, uji pemulihan cadangan

**Skema basis data dibangun lengkap sejak minggu pertama**, termasuk tabel untuk fitur
v1.1. Menambah tabel ke basis data kosong itu murah; menambahkannya setelah ada data
pelanggan tidak.

### Tidak termasuk (dan alasannya)

| Tidak termasuk | Alasan |
|---|---|
| Stok barang habis pakai | Model data berbeda; menggandakan kompleksitas v1 |
| Mode offline / sinkronisasi | Effort besar; ditunda sampai terbukti benar-benar menghambat di lapangan |
| Approval peminjaman | Diputuskan memperlambat alur tanpa manfaat sepadan |
| Hubungan aset induk dan anak | Setiap aset berdiri sendiri di v1; komponen dicatat di kolom catatan |
| Tanda tangan digital serah terima | Foto dan pencatat sudah cukup untuk pertanggungjawaban v1 |
| Integrasi SIMRS / SIMDA | Belum ada spesifikasi; ditangani lewat ekspor Excel dulu |
| Penyusutan dan nilai buku akuntansi | Ranah sistem akuntansi, bukan pelacakan fisik |
| Notifikasi WhatsApp | Butuh WABA berbayar dan verifikasi; email dulu |
| Aplikasi mobile native | Web responsif sudah menjawab kebutuhan scan |
| Pendaftaran mandiri organisasi | Onboarding manual sudah cukup sampai ada beberapa pelanggan |
| Penagihan dan langganan otomatis | Diurus di luar sistem lewat invoice biasa |
| Custom domain per pelanggan | Satu domain bersama; custom domain menyisakan masalah label yang terlanjur tercetak |

## 7. Batasan dan Asumsi

**Batasan:**

- Dijalankan di satu VPS milik sendiri: 2 vCPU, 8 GB RAM, 100 GB NVMe.
  Cadangan adalah tanggung jawab pemilik platform.
- Foto pelanggan disimpan di Cloudflare R2, bukan di disk VPS. Disk 100 GB hanya untuk
  aplikasi dan basis data.
- Wajib HTTPS di produksi — kamera peramban untuk memindai QR tidak berjalan di HTTP.
  Di lokal, `localhost` dikecualikan oleh peramban sehingga pengembangan tetap lancar.
- Perlu sinyal internet di titik pencatatan. Ruang tanpa sinyal perlu diidentifikasi
  saat onboarding tiap pelanggan.
- Label harus tahan desinfektan; kertas stiker biasa tidak akan bertahan.

**Asumsi:**

- Kuota bawaan tiap organisasi: 2.000 aset, 20 GB penyimpanan, 50 pengguna.
- Antarmuka satu bahasa (Indonesia). Zona waktu diatur per organisasi, sehingga pelanggan
  di WITA dan WIT melihat waktu yang benar.
- Tidak ada data pasien di dalam sistem ini.
- Jumlah pelanggan pada tahun pertama masih di bawah sepuluh organisasi.

## 8. Risiko Utama

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Petugas tidak disiplin mencatat | Sistem jadi tidak dipercaya, lebih buruk dari tidak ada | Alur pencatatan sangat pendek; tanpa approval; scan langsung ke form; dorongan dari manajemen |
| Label rusak/lepas | Aset kehilangan jalur akses cepat | Bahan tahan kimia, penempatan terlindung, fitur cetak ulang, pencarian manual sebagai cadangan |
| Data awal tidak lengkap | Sistem kosong dan ditinggalkan | Impor massal via Excel pada fase onboarding, dilakukan bertahap per ruangan |
| Disk VPS penuh oleh foto | Layanan berhenti | Kompresi di klien, kuota per entri, monitoring disk, jalur migrasi ke R2 sudah disiapkan |
| Halaman publik membocorkan data | Risiko keamanan/informasi | Data publik dibatasi ketat, ID acak tidak bisa ditebak, rate limiting |
| Ruangan tanpa sinyal | Pencatatan tertunda atau tidak dilakukan | Survei sinyal saat onboarding; pertimbangkan akses Wi-Fi atau mode offline di v2 |

## 9. Definisi Selesai

**MVP dianggap selesai ketika** dua organisasi contoh dapat dibuat dari panel operator,
masing-masing dengan strukturnya sendiri; sebuah aset dapat didaftarkan, dicetak labelnya,
ditempel, dipindai dengan ponsel sungguhan, dan halaman publiknya terbuka tanpa login;
peminjaman dan pengembaliannya tercatat; riwayatnya tidak dapat diubah; dan **pengguna
organisasi pertama sama sekali tidak dapat melihat data organisasi kedua** — dibuktikan
lewat pengujian, bukan asumsi.

**v1.1 dianggap selesai ketika** jatuh tempo kalibrasi muncul otomatis di dashboard dan
terkirim lewat email, laporan aset per ruangan dapat diekspor dalam satu klik, dan seluruh
daftar periksa go-live di [09-deployment-ops.md](09-deployment-ops.md) tercentang.
Sebelum titik ini, data pelanggan sungguhan tidak boleh masuk.
