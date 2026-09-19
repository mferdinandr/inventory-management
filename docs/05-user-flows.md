# 05 — Alur Penggunaan

Dokumen ini menggambarkan bagaimana sistem dipakai sehari-hari, bukan bagaimana ia dibangun.

---

## 1. Peta Besar

```mermaid
flowchart LR
    A["PIC mendaftarkan aset"] --> B["Sistem membuat<br/>QR dan kode aset"]
    B --> C["Label dicetak"]
    C --> D["Label ditempel<br/>di barang"]
    D --> E["Barang dipindai<br/>kapan pun"]
    E --> F{"Punya akun?"}
    F -->|Tidak| G["Lihat informasi<br/>dan riwayat ringkas"]
    F -->|Ya| H["Lihat detail penuh<br/>dan catat kegiatan"]
    H --> I["Pinjam / kembalikan<br/>periksa / perbaiki<br/>kalibrasi / mutasi"]
    I --> J["Riwayat bertambah<br/>permanen"]
    J --> E
```

---

## 2. Onboarding Awal (satu kali)

Dilakukan sebelum sistem dipakai harian. Inilah tahap yang paling menentukan apakah sistem
akan dipakai atau ditinggalkan.

1. **Super Admin** menyiapkan organisasi: nama RS, kode RS, logo.
2. Menyusun struktur lokasi: gedung, lantai, instalasi, ruangan, lengkap dengan kode instalasi.
3. Menyusun kategori dan menandai mana yang alat medis beserta interval kalibrasinya.
4. Mengundang pengguna dan menetapkan peran. PIC Ruangan dikaitkan dengan ruangannya.
5. **Pendataan per ruangan, bukan serentak.** Ambil satu instalasi sebagai percontohan.
   Data dapat diinput satu per satu atau diimpor massal dari Excel.
6. Cetak seluruh label instalasi tersebut sekaligus, tempel dalam satu sesi.
7. Jalankan satu bulan penuh di instalasi itu sebelum melebar ke instalasi berikutnya.

> Kesalahan yang paling sering terjadi adalah mencoba mendata seluruh rumah sakit sekaligus.
> Pendataan menjadi pekerjaan berbulan-bulan, tidak ada yang memakai sistemnya, dan data
> pertama sudah basi sebelum data terakhir masuk.

---

## 3. Mendaftarkan Aset Baru

**Pelaku:** PIC Ruangan atau Admin

```mermaid
flowchart TD
    A["Buka Aset → Tambah"] --> B["Isi data wajib:<br/>nama, kategori, ruangan,<br/>kondisi, tanggal perolehan"]
    B --> C["Isi data opsional:<br/>merek, model, nomor seri,<br/>nilai, sumber dana, vendor"]
    C --> D["Unggah foto utama"]
    D --> E["Simpan"]
    E --> F["Sistem membuat public_id<br/>dan asset_code"]
    F --> G["Entri riwayat CREATED tercatat"]
    G --> H{"Kategori alat medis?"}
    H -->|Ya| I["Jadwal kalibrasi dibuat otomatis"]
    H -->|Tidak| J["Lewati"]
    I --> K["Halaman aset terbuka<br/>dengan QR siap cetak"]
    J --> K
```

**Yang perlu diperhatikan:**
- Nomor seri yang sudah pernah dipakai akan memunculkan peringatan. Ini biasanya berarti
  barang yang sama didata dua kali.
- Kalau barang datang dalam jumlah banyak dan identik, gunakan impor massal, bukan mengisi
  formulir berulang kali.

---

## 4. Mencetak dan Menempel Label

**Pelaku:** PIC Ruangan atau Admin

1. Dari halaman aset, pilih **Cetak Label**; atau dari daftar aset, centang banyak aset lalu
   pilih **Cetak Lembar A4**.
2. Pilih ukuran label sesuai printer yang tersedia.
3. Periksa pratinjau, lalu cetak.
4. Tempel pada permukaan yang **datar, bersih, dan tidak sering disentuh atau diseka**.
   Hindari menempel di dekat engsel, roda, permukaan panas, atau bagian yang dibongkar saat servis.
5. Pindai sendiri label yang baru ditempel untuk memastikan terbaca. Ini langkah yang paling
   sering dilewatkan dan paling sering disesali.

**Bila label rusak atau hilang:** buka aset lewat pencarian kode, pilih Cetak Ulang, isi
alasannya. QR yang baru mengarah ke aset yang sama — identitas aset tidak pernah berubah.

---

## 5. Memindai QR

### 5.1 Oleh orang tanpa akun

```mermaid
flowchart TD
    A["Buka kamera ponsel<br/>arahkan ke QR"] --> B["Ketuk notifikasi tautan"]
    B --> C["Halaman publik aset terbuka"]
    C --> D["Terlihat: nama, kode, kategori,<br/>merek, ruangan, status, kondisi,<br/>PIC ruangan, kalibrasi berikutnya,<br/>10 riwayat terakhir secara ringkas"]
    D --> E["Tombol: Masuk untuk detail lengkap"]
```

Tidak perlu memasang aplikasi apa pun. Kamera bawaan ponsel sudah cukup.

### 5.2 Oleh petugas yang sudah login

Dari dalam aplikasi, tombol **Pindai** membuka kamera dan langsung menuju halaman aset
dengan seluruh tombol tindakan tersedia. Bila label rusak sehingga tidak terbaca, tersedia
isian kode aset manual.

---

## 6. Peminjaman

**Pelaku:** PIC Ruangan, Admin, atau Teknisi — bukan peminjamnya sendiri.

```mermaid
sequenceDiagram
    actor P as Peminjam
    actor T as Petugas
    participant S as Sistem

    P->>T: Meminta pinjam barang
    T->>S: Pindai QR barang
    S-->>T: Halaman aset, status AVAILABLE
    T->>S: Ketuk Pinjamkan
    alt Peminjam punya akun
        T->>S: Pilih nama dari daftar pengguna
    else Peminjam tidak punya akun
        T->>S: Isi nama, nomor HP, keperluan
    end
    T->>S: Kondisi saat diserahkan, jatuh tempo (opsional), foto (opsional)
    T->>S: Simpan
    S->>S: Status → ON_LOAN, riwayat LOAN_OUT tercatat
    S-->>T: Berhasil
    T->>P: Serahkan barang
```

**Aturan yang berlaku:**
- Tidak ada persetujuan. Peminjaman langsung berlaku begitu disimpan.
- Barang yang sedang dipinjam tidak bisa dipinjamkan lagi. Sistem menolak dan menunjukkan
  siapa yang sedang memegangnya.
- Jatuh tempo boleh dikosongkan, tetapi peminjaman tanpa jatuh tempo yang berjalan lebih
  dari tujuh hari akan muncul di dashboard sebagai perlu ditinjau.
- Yang bertanggung jawab atas pencatatan adalah petugas yang login, bukan peminjam.

### Pengembalian

```mermaid
flowchart TD
    A["Peminjam mengembalikan barang"] --> B["Petugas memindai QR"]
    B --> C["Sistem menampilkan peminjaman aktif"]
    C --> D["Ketuk Kembalikan"]
    D --> E["Isi kondisi saat kembali<br/>catatan, foto opsional"]
    E --> F{"Kondisi barang"}
    F -->|Baik| G["Status → AVAILABLE"]
    F -->|Rusak| H["Status → DAMAGED<br/>dan muncul di daftar perlu perbaikan"]
    G --> I["Riwayat LOAN_RETURN tercatat"]
    H --> I
```

---

## 7. Pengecekan Rutin

**Pelaku:** PIC Ruangan

Ronde berkala memeriksa barang di ruangannya:

1. Buka daftar aset ruangan, atau langsung pindai satu per satu.
2. Untuk tiap barang, catat entri **Pengecekan** berisi kondisi saat diperiksa, catatan,
   dan foto bila ada temuan.
3. Bila barang tidak ditemukan, ubah statusnya menjadi `LOST` disertai catatan. Status ini
   dapat dikembalikan bila barang ditemukan lagi — dan perjalanan itu tetap terekam.

---

## 8. Perbaikan

**Pelaku:** Teknisi atau Admin

```mermaid
flowchart TD
    A["Kerusakan dilaporkan"] --> B["Pindai QR, catat entri Kerusakan"]
    B --> C["Status → DAMAGED"]
    C --> D{"Ditangani di mana?"}
    D -->|Internal| E["Status → UNDER_REPAIR"]
    D -->|Vendor luar| F["Status → AT_VENDOR<br/>catat vendor dan nomor surat jalan"]
    E --> G["Catat entri Perbaikan:<br/>tanggal, pelaksana, tindakan,<br/>suku cadang, biaya, foto"]
    F --> G
    G --> H{"Hasil"}
    H -->|Berhasil| I["Status → AVAILABLE"]
    H -->|Gagal| J["Status → DAMAGED"]
    J --> K{"Layak diperbaiki lagi?"}
    K -->|Tidak| L["Usul penghapusan"]
    K -->|Ya| D
```

Barang yang keluar rumah sakit untuk diservis **harus** diberi status `AT_VENDOR`, bukan
dibiarkan `AVAILABLE`. Inilah titik di mana barang paling sering hilang tanpa jejak.

---

## 9. Kalibrasi Alat Medis

**Pelaku:** Teknisi elektromedik atau Admin

```mermaid
flowchart TD
    A["Dashboard menampilkan<br/>jatuh tempo 30 hari"] --> B["Email ringkasan harian<br/>ke Admin dan PIC"]
    B --> C["Jadwalkan dengan lembaga kalibrasi"]
    C --> D["Alat dikalibrasi<br/>status AT_VENDOR bila keluar"]
    D --> E["Catat pelaksanaan:<br/>tanggal, pelaksana, hasil,<br/>nomor sertifikat, berlaku sampai"]
    E --> F["Unggah berkas sertifikat"]
    F --> G{"Hasil"}
    G -->|Lulus| H["Jatuh tempo berikutnya dihitung<br/>dari masa berlaku sertifikat"]
    G -->|Tidak lulus| I["Status → DAMAGED<br/>peringatan: alat tidak boleh dipakai"]
    H --> J["Status → AVAILABLE"]
```

Sertifikat yang terunggah menjadi bukti saat akreditasi. Inilah alasan berkas sertifikat
disimpan di sistem, bukan hanya nomornya.

---

## 10. Mutasi Ruangan

**Pelaku:** Admin, atau PIC asal dengan sepengetahuan PIC tujuan

1. Buka aset, pilih **Mutasi**.
2. Pilih ruangan tujuan, isi alasan dan tanggal kejadian.
3. PIC aset otomatis mengikuti PIC ruangan tujuan, dan dapat diubah manual.
4. Bila aset memiliki aset anak, sistem menawarkan memindahkan seluruhnya.
5. Entri riwayat `TRANSFER` tercatat lengkap dengan ruangan asal dan tujuan.

Mutasi berbeda dari peminjaman: mutasi bersifat permanen dan mengubah siapa yang bertanggung
jawab, peminjaman bersifat sementara dan menuntut pengembalian. Barang yang sedang dipinjam
tidak dapat dimutasi sebelum dikembalikan.

---

## 11. Mengoreksi Kesalahan Pencatatan

Riwayat tidak dapat diubah maupun dihapus. Bila terjadi salah catat:

1. Buka entri yang keliru pada linimasa.
2. Pilih **Koreksi**.
3. Tuliskan apa yang sebenarnya terjadi dan mengapa entri sebelumnya keliru.
4. Kedua entri tetap tampil. Entri lama diberi tanda telah dikoreksi dan tertaut ke koreksinya.

Ini terasa lebih merepotkan daripada tombol hapus, dan memang disengaja. Riwayat yang bisa
dihapus tidak bernilai sebagai bukti.

---

## 12. Penghapusan Aset

**Pelaku:** Admin atau Super Admin

1. Buka aset, pilih **Hapuskan Aset**.
2. Pilih alasan: rusak total, hilang, dihibahkan, dijual, atau kedaluwarsa.
3. Isi tanggal dan nomor dokumen penghapusan bila ada.
4. Status menjadi `DISPOSED`, aset keluar dari daftar aktif.
5. Halaman publiknya tetap dapat dibuka dan menampilkan penanda bahwa aset telah dihapuskan,
   sehingga label yang masih menempel tetap memberi jawaban yang benar.

---

## 13. Kegiatan Harian per Peran

| Peran | Yang dilakukan setiap hari |
|---|---|
| **PIC Ruangan** | Mencatat peminjaman dan pengembalian di ruangannya, menanggapi jatuh tempo yang muncul di dashboard, mencatat temuan pengecekan |
| **Teknisi** | Membuka daftar aset rusak, mencatat perbaikan dan kalibrasi beserta bukti foto |
| **Admin** | Meninjau peminjaman yang telat, memantau kepatuhan kalibrasi, mendaftarkan aset baru dari pengadaan, mengekspor laporan |
| **Super Admin** | Mengelola pengguna dan master data, memantau cadangan dan kesehatan sistem |
| **Manajemen** | Membuka dashboard dan laporan, tanpa perlu mengubah apa pun |
