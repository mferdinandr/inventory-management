# 07 — RBAC dan Keamanan

## 1. Peran

| Peran | Cakupan | Ringkasan |
|---|---|---|
| `SUPERADMIN` | Seluruh organisasi | Pengelola sistem. Konfigurasi, pengguna, master data, seluruh aset |
| `ADMIN` | Seluruh organisasi | Pengelola aset. Seluruh aset lintas ruangan, laporan, penghapusan aset |
| `PIC_ROOM` | Lokasi yang ditugaskan, termasuk seluruh sublokasinya | Mengelola aset di ruangannya |
| `TECHNICIAN` | Seluruh organisasi, terbatas jenis tindakan | Mencatat perbaikan dan kalibrasi di mana pun |
| `VIEWER` | Seluruh organisasi, hanya baca | Manajemen dan auditor |
| *(anonim)* | Satu aset per pemindaian | Hanya data publik |

**Cakupan lokasi** bekerja menurun. Pengguna `PIC_ROOM` yang ditugaskan pada Instalasi
Radiologi memperoleh akses ke seluruh ruangan di bawahnya, tanpa perlu didaftarkan satu per satu.

---

## 2. Matriks Izin

Legenda: ✅ boleh · 🔶 boleh dalam cakupan lokasinya · ❌ tidak boleh

| Kemampuan | SUPERADMIN | ADMIN | PIC_ROOM | TECHNICIAN | VIEWER | Anonim |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Aset** |
| Melihat daftar dan detail aset | ✅ | ✅ | 🔶 | ✅ | ✅ | ❌ |
| Melihat kolom sensitif (nilai, sumber dana, nomor seri) | ✅ | ✅ | 🔶 | ❌ | ✅ | ❌ |
| Mendaftarkan aset | ✅ | ✅ | 🔶 | ❌ | ❌ | ❌ |
| Mengubah data aset | ✅ | ✅ | 🔶 | ❌ | ❌ | ❌ |
| Mutasi antar ruangan | ✅ | ✅ | 🔶 asal dan tujuan | ❌ | ❌ | ❌ |
| Mengubah status | ✅ | ✅ | 🔶 | 🔶 hanya terkait perbaikan | ❌ | ❌ |
| Menghapuskan aset | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Membatalkan penghapusan dalam 30 hari | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Impor massal | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Riwayat** |
| Melihat riwayat lengkap dan lampiran | ✅ | ✅ | 🔶 | ✅ | ✅ | ❌ |
| Mencatat entri umum | ✅ | ✅ | 🔶 | ❌ | ❌ | ❌ |
| Mencatat perbaikan dan kalibrasi | ✅ | ✅ | 🔶 | ✅ | ❌ | ❌ |
| Membuat koreksi | ✅ | ✅ | 🔶 hanya entri yang dicatatnya | 🔶 hanya entri yang dicatatnya | ❌ | ❌ |
| Mengubah atau menghapus riwayat | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Peminjaman** |
| Mencatat peminjaman dan pengembalian | ✅ | ✅ | 🔶 | 🔶 | ❌ | ❌ |
| Melihat identitas dan kontak peminjam | ✅ | ✅ | 🔶 | 🔶 | ✅ | ❌ |
| **Label** |
| Mencetak dan mencetak ulang | ✅ | ✅ | 🔶 | ❌ | ❌ | ❌ |
| **Master data** |
| Lokasi, kategori, vendor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pengguna dan peran | ✅ | 🔶 tidak boleh membuat SUPERADMIN | ❌ | ❌ | ❌ | ❌ |
| Konfigurasi organisasi | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lain-lain** |
| Laporan dan ekspor | ✅ | ✅ | 🔶 | ❌ | ✅ | ❌ |
| Audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Catatan yang mudah terlewat: `TECHNICIAN` tidak melihat nilai perolehan. Teknisi perlu tahu
alat apa dan riwayat teknisnya, bukan berapa harganya.

---

## 3. Data pada Halaman Publik

| Field | Publik | Alasan |
|---|:--:|---|
| Nama aset, kode aset, kategori | ✅ | Identifikasi dasar, inti manfaat pemindaian |
| Merek dan model | ✅ | Membantu mengenali barang, tidak sensitif |
| Ruangan saat ini | ✅ | Menjawab "barang ini milik ruangan mana" |
| Status dan kondisi | ✅ | Menjawab "boleh dipakai atau tidak" |
| Nama PIC ruangan | ✅ | Menjawab "hubungi siapa" — hanya nama, tanpa kontak |
| Jatuh tempo kalibrasi berikutnya | ✅ | Keamanan pasien; siapa pun berhak tahu alat medis masih berlaku |
| 10 riwayat terakhir: tanggal, jenis, judul | ✅ | Inti transparansi yang diinginkan |
| Nomor seri | ❌ | Dapat dipakai untuk klaim garansi atau penyamaran kepemilikan |
| Nilai perolehan, sumber dana, nomor dokumen | ❌ | Informasi keuangan internal |
| Vendor | ❌ | Informasi pengadaan |
| Seluruh lampiran foto | ❌ | Berisiko memuat wajah staf atau pasien secara tidak sengaja |
| Isi catatan lengkap | ❌ | Sering memuat nama orang dan detail internal |
| Identitas dan nomor HP peminjam | ❌ | Data pribadi |
| Nama pencatat | ❌ | Data pegawai |

Teknik penegakan: kueri halaman publik menyebut kolom aman **satu per satu** dalam
`select` Prisma. Tidak ada pola "ambil semua lalu hapus field", karena pola itu bocor
setiap kali ada kolom baru ditambahkan.

---

## 4. Autentikasi

- **Tidak ada pendaftaran mandiri.** Akun hanya lahir dari undangan Admin.
- Kata sandi minimal 10 karakter, di-hash dengan **Argon2id**.
- Token undangan dan atur ulang kata sandi: 32 byte acak, disimpan sebagai hash,
  berlaku 7 hari untuk undangan dan 1 jam untuk atur ulang, sekali pakai.
- Sesi berbasis cookie: `HttpOnly`, `Secure`, `SameSite=Lax`. Umur **12 jam**, atau
  **7 hari** bila pengguna memilih "Ingat saya" saat login.
- **Autentikasi dua faktor bersifat opsional** dan dapat diaktifkan sendiri oleh pengguna
  mana pun dari halaman profil, memakai TOTP. Tidak diwajibkan peran mana pun di v1.
  Saat diaktifkan, sistem menampilkan kode pemulihan sekali saja; kode disimpan dalam
  bentuk hash dan dihapus setelah dipakai. Super Admin dapat menonaktifkan 2FA milik
  pengguna lain bila kode pemulihannya ikut hilang, dan tindakan itu tercatat di audit log.
- Pengguna dapat melihat daftar perangkat yang sedang aktif dan mengeluarkan salah satunya.
- Pembatasan percobaan login: 5 kegagalan per 15 menit per IP dan per akun.
  Pesan kegagalan tidak membedakan antara email tidak dikenal dan kata sandi salah.
- Menonaktifkan pengguna langsung mencabut seluruh sesinya, termasuk sesi "Ingat saya".

---

## 5. Model Ancaman

| Ancaman | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| Penelusuran seluruh aset lewat tebakan URL | Sedang | Sedang | `public_id` acak 12 karakter, pembatasan laju, 404 netral |
| Foto QR tersebar di luar RS | Sedang | Rendah | Data publik sudah dibatasi sejak desain |
| Peminjaman fiktif atas nama orang lain | Sedang | Sedang | `recorded_by` selalu tercatat; riwayat tidak dapat dihapus; audit menunjukkan pola |
| Penghapusan bukti oleh pelaku internal | Rendah | Tinggi | Append-only ditegakkan di basis data; hak `UPDATE`/`DELETE` dicabut dari peran aplikasi |
| Unggahan berkas berbahaya | Rendah | Sedang | Daftar putih jenis berkas, batas ukuran, kunci objek ditentukan server, bucket tidak pernah melayani HTML, `Content-Disposition: attachment` |
| Lampiran bocor lewat tautan | Sedang | Sedang | Bucket privat, URL bertanda tangan berumur 15 menit, pemeriksaan wewenang sebelum penerbitan |
| Data lintas organisasi terbaca | Rendah | Tinggi | `organization_id` pada setiap kueri, Row Level Security sebagai jaring pengaman |
| Pengambilalihan akun | Rendah | Tinggi | Pembatasan login, kata sandi kuat, sesi pendek, pencabutan sesi, 2FA opsional bagi yang mengaktifkan |
| Ponsel dinas dipakai bergantian | Sedang | Sedang | Sesi bawaan 12 jam, "Ingat saya" tidak aktif secara bawaan, daftar perangkat aktif dapat dilihat dan dikeluarkan sendiri |
| Aset dihapuskan karena salah klik | Sedang | Rendah | Masa pembatalan 30 hari dengan pemulihan ke status semula |
| Kehilangan data | Rendah | Tinggi | Cadangan harian, uji pulih tiap kuartal, penyimpanan cadangan di luar VPS |
| SQL injection | Rendah | Tinggi | Prisma dengan kueri berparameter; `$queryRaw` hanya dengan templat tagged |
| XSS pada catatan pengguna | Rendah | Sedang | React melakukan escaping bawaan; tidak ada `dangerouslySetInnerHTML` |
| CSRF | Rendah | Sedang | Perlindungan bawaan Server Actions, `SameSite=Lax` |

---

## 6. Perlindungan Data Pribadi

Sistem ini menyimpan data pribadi dalam skala terbatas: nama dan kontak pegawai, serta nama
dan nomor HP peminjam luar. Tidak ada data pasien.

- Nomor HP peminjam hanya terlihat oleh peran yang berwenang, tidak pernah publik.
- Foto lampiran berpotensi memuat orang secara tidak sengaja. Panduan pemakaian: **foto
  barang, bukan orang**. Ini dicantumkan sebagai petunjuk di formulir unggah.
- Retensi: data peminjaman dan lampiran foto disimpan selama asetnya masih tercatat,
  termasuk setelah aset dihapuskan. Tidak ada penghapusan otomatis berdasarkan umur data.
- **Prosedur permintaan penghapusan data pribadi belum diatur di v1.** Bila permintaan
  semacam itu muncul, tangani secara manual dan catat keputusannya. Ketika hendak
  diformalkan, jalur yang dianjurkan adalah menganonimkan nama dan nomor HP peminjam luar
  sambil mempertahankan entri riwayatnya, agar jejak keberadaan aset tidak berlubang.
  Kolom `anonymized_at` pada tabel `loans` disiapkan untuk itu di v2.

---

## 7. Keamanan Operasional

- Seluruh trafik lewat HTTPS. HSTS aktif setelah masa uji coba domain selesai.
- Header keamanan: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
- Konsol MinIO tidak diekspos ke internet; hanya dapat diakses lewat terowongan SSH.
- PostgreSQL tidak mempublikasikan porta ke luar; hanya dapat dicapai dari jaringan Docker.
- Akses SSH ke VPS memakai kunci saja, autentikasi kata sandi dinonaktifkan.
- Rahasia tersimpan di berkas `.env` di server dengan izin `600`, tidak pernah masuk ke Git.
- Pembaruan citra dasar dan dependensi dijadwalkan bulanan.

---

## 8. Yang Dicatat di Audit Log

Masuk ke `audit_logs`: keberhasilan dan kegagalan login, undangan dan penonaktifan pengguna,
perubahan peran, perubahan master data, perubahan konfigurasi organisasi, ekspor laporan,
dan penerbitan URL bertanda tangan untuk berkas sensitif.

Tidak masuk ke `audit_logs`: seluruh kegiatan terhadap aset — itu sudah menjadi isi
`asset_events`, yang sifatnya lebih kuat daripada audit log biasa karena tidak dapat diubah.
