# 08 — QR & Label

Hanya **barang besar dan wadah** yang diberi QR. Item di dalam wadah tidak.

## 1. Isi QR

```
https://{DOMAIN}/i/BRG-0001
```

- Hanya kode barang. Tidak ada data lain di dalam QR.
- Tidak ada halaman publik: pemindai tanpa login diarahkan ke login lalu kembali ke barang.
- Kode (`BRG-0001`) permanen. Cetak ulang menghasilkan QR yang sama.
- Koreksi level: **M** (cukup untuk label kecil; **Q** bila label sering tergores).

## 2. Isi label

```
┌────────────────────────┐
│ ▓▓▓▓▓   BRG-0001       │
│ ▓▓▓▓▓   Perlengkapan 1 │
│ ▓▓▓▓▓                  │
└────────────────────────┘
```

QR + kode (cetak tebal) + nama (dipotong bila panjang). Kamar tidak dicetak karena barang berpindah. Kode tercetak supaya label yang
rusak masih bisa dicari manual.

## 3. Ukuran

| Ukuran | Pemakaian |
|---|---|
| **50 × 30 mm** (standar) | Wadah, meja, TV |
| **Lembar A4** | Cetak banyak sekaligus saat pendataan awal; centang beberapa barang di daftar |

Satu ukuran standar dulu; tambah bila pelanggan butuh.

## 4. Bahan — hal yang paling menentukan

Wadah jalur `STERIL` di CSSD melewati **pembersihan dan sterilisasi**. Label kertas biasa akan rusak.

- Konfirmasi ke CSSD: **metode sterilisasi** yang dipakai (uap/autoklaf, suhu, dll).
- Gunakan label/tag yang **tahan proses itu** (mis. label tahan autoklaf atau tag logam
  bergravir). Uji dulu satu label melewati satu siklus sebelum cetak massal.
- Untuk alat tanpa sterilisasi (TV, meja, mesin) yang tidak masuk CSSD, label tahan desinfektan cukup.
- Tempel di permukaan datar, jauh dari engsel atau bagian yang dibuka.

## 5. Setelah menempel

Pindai sendiri label yang baru ditempel. Setelah satu siklus sterilisasi pertama, pindai lagi.

## 6. Cetak ulang

Halaman barang → **Cetak Label**. Tidak ada alasan wajib atau riwayat khusus; kodenya sama.
