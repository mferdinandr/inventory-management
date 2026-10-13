# 07 — RBAC & Keamanan

## 1. Peran

| Peran | Siapa | Singkatnya |
|---|---|---|
| `OPERASI` | Petugas ruang operasi | Mendaftarkan, mengubah, mengirim set ke CSSD |
| `STERIL` | Petugas CSSD | Mengecek, memperbarui jumlah, mengembalikan |
| `ALKES` | Kantor Alkes | Hanya melihat (plus maintenance, seperti semua peran) |
| `SUPERADMIN` | Pengelola sistem | Akses penuh + kelola pengguna |

Peran hanya dapat diubah oleh SUPERADMIN.

## 2. Matriks izin

| Aksi | OPERASI | STERIL | ALKES | SUPERADMIN |
|---|:-:|:-:|:-:|:-:|
| Lihat daftar, detail, riwayat, maintenance | ✅ | ✅ | ✅ | ✅ |
| Cari / pindai | ✅ | ✅ | ✅ | ✅ |
| Daftarkan barang | ✅ | ❌ | ❌ | ✅ |
| Ubah identitas/detail/pembelian | ✅ (tidak di CSSD) | ❌ | ❌ | ✅ |
| Ubah isi & jumlah/rusak | ✅ (tidak di CSSD) | ✅ (di CSSD) | ❌ | ✅ (di mana saja) |
| Kirim ke CSSD (hanya yang perlu sterilisasi) | ✅ | ❌ | ❌ | ✅ |
| Kembalikan dari CSSD | ❌ | ✅ | ❌ | ✅ |
| **Maintenance** (3 form) | ✅ | ✅ | ✅ | ✅ (lokasi mana pun) |
| Arsipkan / pulihkan | ✅ | ❌ | ❌ | ✅ |
| Cetak label | ✅ | ❌ | ❌ | ✅ |
| Kelola pengguna | ❌ | ❌ | ❌ | ✅ |

Izin diperiksa **di server** pada setiap endpoint, termasuk **lokasi barang**; menyembunyikan
tombol di UI hanya kenyamanan. Matriks ini ada di satu berkas (`permissions.ts`) dan diuji
per peran × lokasi.

## 3. Autentikasi

- Username + kata sandi (argon2id), minimal 8 karakter.
- Sesi 30 hari, cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Batas percobaan: 5 gagal / 10 menit per username + IP.
- SUPERADMIN pertama dibuat lewat CLI; sisanya oleh SUPERADMIN dari UI. Kata sandi awal
  wajib diganti saat login pertama.
- Pengguna tidak dihapus, hanya dinonaktifkan. Selalu tersisa ≥ 1 SUPERADMIN aktif.

## 4. Akun bersama dan penelusuran

Bila satu akun dipakai banyak orang, `user_id` tidak cukup menunjukkan pelakunya. Karena itu
setiap **kirim**, **kembalikan**, dan **maintenance** mewajibkan **nama petugas**
(`actor_name`), tersimpan di riwayat.

## 5. Ancaman dan mitigasi

| Ancaman | Mitigasi |
|---|---|
| Orang luar membuka data | Semua halaman butuh login; tidak ada halaman publik |
| Tebak kata sandi | Argon2id, pembatasan percobaan |
| Peran melampaui wewenang | Pemeriksaan peran **dan lokasi barang** di server |
| Akun SUPERADMIN disalahgunakan | Hanya segelintir orang; aksinya tetap tercatat; kata sandi kuat |
| Riwayat/maintenance diubah | Trigger basis data menolak UPDATE/DELETE/TRUNCATE pada tabel riwayat |
| Perubahan jumlah saling menimpa | Kolom `version` + transaksi |
| Injeksi SQL | Prisma berparameter |
| Kebocoran rahasia | `.env` di luar git; `AUTH_SECRET` panjang acak |
| Cadangan hilang | Cadangan harian ke luar server, uji pemulihan sebelum go-live |

## 6. Data

Tidak ada data pasien. Data yang tersimpan: nama barang, jumlah, detail pembelian (harga,
supplier), catatan maintenance, dan nama petugas. Harga pembelian bersifat internal; sistem
hanya dapat diakses setelah login.
