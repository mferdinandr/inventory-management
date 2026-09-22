# 01 — Project Brief

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
| **Super Admin** | IT / pengelola sistem | Kelola pengguna, master data, konfigurasi |
| **Admin** | IPSRS, Bagian Umum, Bagian Aset | Lihat dan ubah seluruh aset lintas ruangan, laporan, penghapusan aset |
| **PIC Ruangan** | Kepala ruangan / penanggung jawab instalasi | Kelola aset di ruangannya, catat peminjaman dan pengecekan |
| **Teknisi** | Teknisi elektromedik / IT / maintenance | Catat perbaikan dan kalibrasi lintas ruangan |
| **Viewer** | Manajemen, auditor internal | Lihat data dan laporan, tanpa mengubah apa pun |
| **Publik** | Siapa pun yang memindai QR | Lihat informasi dasar dan riwayat ringkas satu aset |

## 6. Ruang Lingkup v1

### Termasuk

- Master data: organisasi, lokasi berjenjang, kategori, vendor, pengguna
- CRUD aset dengan data perolehan dan sumber dana
- Generate, cetak, dan cetak ulang QR Code (label tunggal dan lembar A4)
- Halaman publik hasil scan dengan data terbatas
- Pencatatan riwayat append-only dengan lampiran foto
- Peminjaman dan pengembalian, termasuk peminjam non-pengguna
- Mutasi/transfer aset antar ruangan
- Jadwal kalibrasi dan pemeliharaan ringkas, dengan unggah sertifikat
- Dashboard: jatuh tempo, peminjaman berjalan, aset bermasalah
- Notifikasi email untuk jatuh tempo dan peminjaman yang belum kembali
- Ekspor Excel/CSV per ruangan dan per kategori
- Autentikasi berbasis undangan, RBAC dengan pembatasan ruangan
- Audit log untuk aksi non-aset

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

## 7. Batasan dan Asumsi

**Batasan:**

- Dijalankan di satu VPS milik sendiri. Kapasitas disk dan backup adalah tanggung jawab tim.
- Wajib HTTPS — kamera browser untuk memindai QR tidak berjalan di HTTP.
- Perlu sinyal internet di titik pencatatan. Ruang tanpa sinyal harus diidentifikasi sejak awal.
- Label harus tahan desinfektan; kertas stiker biasa tidak akan bertahan.

**Asumsi:**

- Volume awal di bawah 2.000 aset dan 50 pengguna.
- Satu rumah sakit, satu zona waktu (WIB), satu bahasa (Indonesia).
- Tidak ada data pasien di dalam sistem ini.

## 8. Risiko Utama

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Petugas tidak disiplin mencatat | Sistem jadi tidak dipercaya, lebih buruk dari tidak ada | Alur pencatatan sangat pendek; tanpa approval; scan langsung ke form; dorongan dari manajemen |
| Label rusak/lepas | Aset kehilangan jalur akses cepat | Bahan tahan kimia, penempatan terlindung, fitur cetak ulang, pencarian manual sebagai cadangan |
| Data awal tidak lengkap | Sistem kosong dan ditinggalkan | Impor massal via Excel pada fase onboarding, dilakukan bertahap per ruangan |
| Disk VPS penuh oleh foto | Layanan berhenti | Kompresi di klien, kuota per entri, monitoring disk, jalur migrasi ke R2 sudah disiapkan |
| Halaman publik membocorkan data | Risiko keamanan/informasi | Data publik dibatasi ketat, ID acak tidak bisa ditebak, rate limiting |
| Ruangan tanpa sinyal | Pencatatan tertunda atau tidak dilakukan | Survei sinyal saat onboarding; pertimbangkan akses Wi-Fi atau mode offline di v2 |

## 9. Definisi Selesai untuk v1

v1 dianggap selesai ketika satu instalasi (misalnya Instalasi Radiologi) dapat:
seluruh asetnya terdata dan berlabel, setiap peminjaman dan perbaikan selama satu bulan
tercatat di sistem tanpa buku manual, jatuh tempo kalibrasi muncul otomatis di dashboard
dan terkirim lewat email, dan laporan aset ruangan tersebut dapat diekspor dalam satu klik.
