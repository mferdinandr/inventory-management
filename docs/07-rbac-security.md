# 07 — RBAC & Keamanan

## 1. Peran

| Peran | Siapa | Singkatnya |
|---|---|---|
| `OPERASI` | Petugas ruang operasi | Mendaftarkan dan mengirim |
| `STERIL` | Petugas CSSD | Mengecek, memperbarui jumlah, mengembalikan |
| `ALKES` | Kantor Alkes | Memantau; mengembalikan barang non-steril |
| `SUPERADMIN` | Pengelola sistem | Akses penuh + kelola pengguna |

Peran hanya dapat diubah oleh SUPERADMIN.

## 2. Matriks izin

| Aksi | OPERASI | STERIL | ALKES | SUPERADMIN |
|---|:-:|:-:|:-:|:-:|
| Lihat daftar, detail, riwayat | ✅ | ✅ | ✅ | ✅ |
| Cari / pindai | ✅ | ✅ | ✅ | ✅ |
| Daftarkan barang | ✅ | ❌ | ❌ | ✅ |
| Ubah nama/keterangan/jalur | ✅ (di Operasi) | ❌ | ❌ | ✅ |
| Ubah isi & jumlah | ✅ (di Operasi) | ✅ (di CSSD) | ❌ | ✅ (di mana saja) |
| Kirim (ke CSSD/Alkes sesuai jalur) | ✅ | ❌ | ❌ | ✅ |
| Kembalikan dari CSSD | ❌ | ✅ | ❌ | ✅ |
| Kembalikan dari Alkes | ❌ | ❌ | ✅ | ✅ |
| Arsipkan / pulihkan | ✅ | ❌ | ❌ | ✅ |
| Cetak label | ✅ | ❌ | ❌ | ✅ |
| Kelola pengguna | ❌ | ❌ | ❌ | ✅ |

Izin diperiksa **di server** pada setiap endpoint; menyembunyikan tombol di UI hanya
kenyamanan. Matriks ini ada di satu berkas (`permissions.ts`) dan diuji.

## 3. Autentikasi

- Username + kata sandi (argon2id).
- Sesi 30 hari, cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Batas percobaan: 5 gagal / 10 menit per username + IP.
- SUPERADMIN pertama dibuat lewat CLI; sisanya dibuat SUPERADMIN dari UI. Kata sandi awal
  wajib diganti saat login pertama (`must_change_password`).
- Pengguna tidak dihapus, hanya dinonaktifkan. Selalu tersisa ≥ 1 SUPERADMIN aktif.
- Kata sandi minimal 8 karakter.

## 4. Akun bersama dan penelusuran

Bila satu akun peran dipakai banyak orang, `user_id` saja tidak cukup menunjukkan siapa
pelakunya. Karena itu setiap **kirim** dan **kembalikan** mewajibkan **nama petugas**
(`actor_name`), tersimpan di riwayat.

## 5. Ancaman dan mitigasi

| Ancaman | Mitigasi |
|---|---|
| Orang luar membuka data | Semua halaman butuh login; tidak ada halaman publik |
| Tebak kata sandi | Argon2id, pembatasan percobaan |
| Peran melampaui wewenang | Pemeriksaan peran **dan lokasi barang** di server, bukan hanya UI |
| Akun SUPERADMIN disalahgunakan | Hanya segelintir orang; semua aksinya tetap tercatat di riwayat; kata sandi kuat |
| Riwayat diubah | Hak `UPDATE/DELETE` dicabut dari peran basis data aplikasi |
| Perubahan jumlah saling menimpa | Kolom `version` + transaksi |
| Injeksi SQL | Prisma berparameter |
| Kebocoran rahasia | `.env` di luar git; `AUTH_SECRET` panjang acak |
| Cadangan hilang | Cadangan harian ke luar server, uji pemulihan sebelum go-live |

## 6. Data

Tidak ada data pasien dalam sistem. Hanya nama barang, jumlah, dan nama petugas.
