# 14 — Impor CSV (data awal)

Skrip sekali pakai untuk memuat daftar inventaris rumah sakit ([12](12-data-contoh.md)) ke
SIMASET. Dijalankan SUPERADMIN/pengembang, bukan fitur UI. Logikanya ada di
`src/server/import/`; `scripts/import-csv.ts` hanya pembungkus perintah.

```bash
pnpm import:csv --items items.csv --contents contents.csv --as <username> [--dry-run] [--skip-invalid] [--map-out import-map.csv]
```

| Opsi | Arti |
|---|---|
| `--items`, `--contents` | Dua berkas CSV (wajib) |
| `--as` | Username yang dicatat sebagai `user_id` pada log (wajib; harus ada dan aktif) |
| `--dry-run` | Validasi dan cetak ringkasan; **tidak menulis apa pun** |
| `--skip-invalid` | Impor baris yang valid, laporkan sisanya. Tanpa opsi ini, satu galat membatalkan seluruh impor |
| `--map-out` | Berkas pemetaan `ref -> kode` (bawaan `import-map.csv`, di-gitignore) |

Contoh berkas ada di [`contoh/csv/`](contoh/csv/): `items.sample.csv` dan
`contents.sample.csv`. **Keduanya data rekaan** yang meniru bentuk dua daftar RS (set MAYOR,
mesin anestesi Drager, meja stainless); jangan diimpor ke produksi.

## 1. Format berkas

UTF-8 (BOM boleh), baris pertama adalah header. Pemisah koma **atau** titik koma dikenali
otomatis (Excel berbahasa Indonesia biasanya menyimpan dengan titik koma). Isi sel yang
mengandung pemisah, tanda kutip, atau baris baru dibungkus tanda kutip ganda; kutip di dalamnya
digandakan (`""`). Nama kolom tidak peka huruf besar-kecil. Kolom yang tidak dikenal dianggap
galat (agar salah ketik seperti `serial` tidak membuang data diam-diam).

### items.csv

| Kolom | Wajib | Isi |
|---|---|---|
| `ref` | ya | Kunci unik dalam berkas ini yang menghubungkan ke `contents.csv`. Bebas, mis. `MAYOR-1` |
| `name` | ya | Nama barang (maks. 120) |
| `needs_sterilization` | ya | `ya`/`tidak`, `true`/`false`, atau `1`/`0` |
| `room` | | Kamar/ruang (maks. 120) |
| `description` | | Maks. 1000 karakter |
| `quantity` | | Bilangan bulat ≥ 0; kosong = 1 |
| `damaged_quantity` | | Bilangan bulat ≥ 0 dan ≤ `quantity`; kosong = 0 |
| `brand`, `model` | | Maks. 80 |
| `serial_number` | | Maks. 80; **hanya boleh bila `quantity` = 1** |
| `purchase_date`, `warranty_until` | | `YYYY-MM-DD` atau `DD/MM/YYYY` |
| `purchase_price` | | Angka rupiah; `Rp`, titik, koma, dan spasi dibuang (`Rp 1.500.000` = 1500000) |
| `supplier`, `funding_source` | | Maks. 120 |

### contents.csv

| Kolom | Wajib | Isi |
|---|---|---|
| `ref` | ya | Harus ada di `items.csv` |
| `name` | ya | Nama isi (maks. 120); unik per barang (tanpa membedakan huruf besar-kecil) |
| `brand` | | Maks. 80 |
| `quantity` | | Kosong = 1 |
| `damaged_quantity` | | ≤ `quantity`; kosong = 0 |
| `note` | | Maks. 300 |

## 2. Aturan

- **Aturan sama dengan aplikasi.** Setiap barang divalidasi dengan skema Zod yang sama dengan
  formulir pendaftaran (`registerItemSchema`): nomor seri mensyaratkan jumlah 1, jumlah rusak
  ≤ jumlah, nama isi tidak boleh ganda, dan seterusnya.
- **Semua galat dikumpulkan**, bukan hanya yang pertama. Setiap galat memuat nama berkas dan
  nomor baris seperti tampil di Excel (header = baris 1, data pertama = baris 2) dalam
  bahasa Indonesia, mis. `items.csv baris 7: damaged_quantity: Jumlah rusak tidak boleh melebihi jumlah`.
- **Satu barang dengan galat (juga pada salah satu baris isinya) tidak diimpor.** Baris isi yang
  `ref`-nya tidak ada di `items.csv` adalah galat.
- Tanpa `--skip-invalid`, ada galat berarti **tidak ada yang ditulis**. Dengan opsi itu, barang
  valid tetap masuk dan yang dilewati dilaporkan; kode keluar tetap 1 agar tidak terlewat.
- **Satu transaksi per barang**: barang, isinya, dan log `REGISTER` ditulis bersama atau tidak
  sama sekali. Kegagalan tak terduga pada satu barang dilaporkan sebagai galat dan barang
  lain tetap diproses.
- **Kode `BRG-xxxx`** diberikan basis data; urutannya mengikuti urutan baris `items.csv`.
- **Log `REGISTER`** memakai `actor_name` = `Impor CSV` dan `user_id` = pengguna `--as`.
- **Lokasi** awal semua barang adalah `OPERASI` (default skema).
- **Nomor seri ganda** (sudah dipakai barang lain, atau dua kali dalam berkas) hanya
  **peringatan**, seperti di aplikasi; barang tetap diimpor.

## 3. Menyiapkan CSV dari Excel rumah sakit

Minta berkas Excel asli, bukan PDF ([12](12-data-contoh.md)). Lalu, di salinan berkas:

1. **Daftar set instrumen** (MAYOR 1 dst.): untuk tiap set, satu baris di `items.csv` dengan
   `needs_sterilization` = `ya`, `quantity` = 1, `ref` = nama set (mis. `MAYOR-1`). Tiap
   baris item pada set menjadi satu baris di `contents.csv` dengan `ref` set itu.
   Pemetaan kolom Excel: NAMA ITEM → `name`, MEREK → `brand`, JUMLAH → `quantity`,
   CATATAN → `note`. Kolom KONDISI "RUSAK" menjadi `damaged_quantity` (sama dengan
   `quantity` bila seluruhnya rusak). STATUS dan TANGGAL VERIFIKASI tidak diimpor.
2. **Alat besar / barang kamar**: satu baris di `items.csv` per alat (`needs_sterilization` =
   `tidak`), isi `room`, `brand`, `model`, `serial_number`, dan data pembelian bila ada.
   Barang sejenis di satu kamar (mis. Meja stainless 4 buah) cukup satu baris dengan
   `quantity` = 4.
3. **Daftar anestesi per kamar**: kolom Jumlah Alat → `quantity`, Alat Rusak →
   `damaged_quantity`, Keterangan → `description`; nama kamar → `room`.
4. Buat `ref` unik (mis. gabungan kamar dan nama). Kolom `ref` bisa diisi rumus Excel
   lalu di-*paste values*.
5. Di Excel: *File → Save As → CSV UTF-8 (Comma delimited)*. Simpan **dua** sheet sebagai dua
   berkas. Buka hasilnya di editor teks untuk memeriksa bahwa huruf dan tanda kutip tidak rusak.
6. Pastikan tidak ada formula/format di sel (tanggal dan harga ditulis sebagai teks atau
   angka biasa).

## 4. Alur kerja yang disarankan

1. **Cadangkan** basis data: `scripts/backup.sh` ([09](09-deployment-ops.md)).
2. **Dry-run** dan perbaiki CSV sampai bersih:
   ```bash
   pnpm import:csv --items items.csv --contents contents.csv --as admin --dry-run
   ```
3. **Uji pada salinan basis data** (bukan produksi) dan cocokkan hasilnya dengan daftar sumber
   (jumlah barang, jumlah baris isi, beberapa set diperiksa manual).
4. **Impor sungguhan**; ringkasan dan `import-map.csv` dicetak.
5. Mulai kecil: pendataan bertahap (beberapa set dan satu kamar), jalankan sebulan, lalu lanjut.

Di server produksi berkas harus ada di dalam kontainer:

```bash
docker compose cp items.csv app:/app/items.csv
docker compose cp contents.csv app:/app/contents.csv
docker compose exec app pnpm import:csv --items items.csv --contents contents.csv --as admin --dry-run
docker compose exec app pnpm import:csv --items items.csv --contents contents.csv --as admin
docker compose cp app:/app/import-map.csv ./import-map.csv
```

### Ringkasan dan pemetaan

Ringkasan memuat jumlah baris barang dan isi, dibuat, dilewati (sudah ada / galat), galat,
dan peringatan. `import-map.csv` berisi `ref,code,status` (`dibuat` atau `sudah ada`). Pakai
untuk menulis kode `BRG-xxxx` ke daftar sumber atau mencetak label.

## 5. Menjalankan ulang

Impor bersifat **idempotensi per barang**: barang yang `name` dan `room`-nya sudah ada di
basis data (tanpa membedakan huruf besar-kecil, termasuk yang diarsipkan) **dilewati
seluruhnya, termasuk isinya**, dan dilaporkan sebagai `LEWAT`. Baris dengan nama dan
ruang yang sama dua kali dalam satu berkas juga dilewati (yang pertama dipakai).
Konsekuensinya:

- Aman mengulang setelah memperbaiki beberapa baris dengan `--skip-invalid`: hanya barang
  yang belum ada yang dibuat.
- Skrip **tidak memperbarui** barang yang sudah ada. Mengubah isi set yang sudah diimpor
  dilakukan lewat aplikasi (edit isi) agar tercatat di riwayat.
- `import-map.csv` ditulis ulang tiap kali dan memuat kode barang yang sudah ada dengan status
  `sudah ada`.

## 6. Membatalkan impor (rollback)

**Tidak ada fitur hapus**: riwayat bersifat append-only dan barang hanya bisa diarsipkan.
Cara membatalkan impor yang salah adalah **memulihkan cadangan** yang dibuat sebelum impor
(langkah 1), sesuai bagian "Memulihkan sungguhan" di [09](09-deployment-ops.md). Karena itu
cadangan sebelum impor wajib, dan impor dilakukan saat belum ada petugas yang mengubah data.
Bila hanya beberapa barang yang salah, arsipkan lewat aplikasi lalu impor ulang dengan nama
atau ruang yang benar.
