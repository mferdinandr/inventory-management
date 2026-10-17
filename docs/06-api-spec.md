# 06 — Spesifikasi API

Semua endpoint butuh sesi, kecuali `/api/auth/*`. Format JSON. Peran per endpoint mengikuti
[07](07-rbac-security.md); lokasi barang ikut diperiksa.

## 1. Bentuk respons

```json
{ "data": { } }
```
```json
{ "error": { "code": "STATE_CONFLICT", "message": "Barang sudah berada di CSSD." } }
```

| Kode | HTTP | Arti |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Belum login |
| `FORBIDDEN` | 403 | Peran/lokasi tidak mengizinkan |
| `NOT_FOUND` | 404 | Tidak ada |
| `STATE_CONFLICT` | 409 | Lokasi tidak sesuai tindakan |
| `VERSION_CONFLICT` | 409 | `version` basi; muat ulang |
| `LAST_SUPERADMIN` | 409 | Tindakan menyisakan nol SUPERADMIN aktif |
| `VALIDATION_ERROR` | 422 | Masukan tidak valid (jumlah negatif, rusak > jumlah) |
| `RATE_LIMITED` | 429 | Terlalu banyak percobaan login |

## 2. Barang

### `GET /api/items?q=&location=&room=&damaged=&dueSoon=&archived=false`
Semua peran. `q` mencari kode, nama, merek, nomor seri, kamar. Mengembalikan
`code, name, room, needsSterilization, location, locationSince, quantity, damagedQuantity, nextDue`.

### `POST /api/items` — OPERASI, SUPERADMIN
```json
{
  "name": "Mesin Anestesi Drager",
  "needsSterilization": false,
  "room": "Kamar Operasi 103",
  "description": "",
  "quantity": 1,
  "damagedQuantity": 0,
  "brand": "Drager", "model": "…", "serialNumber": "…",
  "purchaseDate": "2024-03-01", "purchasePrice": 450000000,
  "supplier": "PT …", "fundingSource": "APBD", "warrantyUntil": "2027-03-01",
  "contents": [
    { "name": "Jarum", "brand": "…", "quantity": 10, "damagedQuantity": 0, "note": "" }
  ]
}
```
Hanya `name` dan `needsSterilization` wajib. `serialNumber` hanya boleh bila `quantity` = 1. Membuat barang + isi + log `REGISTER` dalam satu transaksi.
Respons menyertakan `code` dan `warnings` (mis. `DUPLICATE_SERIAL`).

### `GET /api/items/{code}`
Semua peran. Seluruh kolom barang, `contents`, 50 riwayat terakhir, 10 catatan maintenance
terakhir, dan `nextDue`.

### `GET /api/items/{code}/logs?cursor=` · `GET /api/items/{code}/maintenance?cursor=`
Semua peran. Daftar lengkap, terbaru dulu.

### `PATCH /api/items/{id}` — OPERASI, SUPERADMIN
```json
{ "version": 3, "name": "…", "needsSterilization": true, "room": "…", "quantity": 4,
  "damagedQuantity": 1, "brand": "…", "purchasePrice": 1000000,
  "contents": [ { "id": "…", "name": "Jarum", "quantity": 8, "damagedQuantity": 0 } ] }
```
Barang tidak boleh sedang di CSSD (kecuali SUPERADMIN). Alat tanpa sterilisasi selalu di Operasi sehingga selalu dapat diubah. Field yang dikirim saja yang berubah;
`contents`, bila ada, menggantikan seluruh daftar. Selisih menjadi `changes` pada log `EDIT`.

### `PATCH /api/items/{id}/contents` — STERIL (barang di CSSD), SUPERADMIN
Mengubah `quantity`, `damagedQuantity`, `note`, atau menambah baris, tanpa memindahkan
barang. Body: `{ "version", "actorName", "contents": [...] }`.

### `POST /api/items/{id}/archive` · `/restore` — OPERASI, SUPERADMIN

## 3. Perpindahan (hanya barang yang perlu sterilisasi)

### `POST /api/items/{id}/send` — OPERASI, SUPERADMIN
```json
{ "actorName": "Sari", "note": "" }
```
Syarat `location = OPERASI` dan `needsSterilization = true`. Lokasi → `CSSD`, log `SEND`.
Barang tanpa sterilisasi → `STATE_CONFLICT`.

### `POST /api/items/{id}/return` — STERIL, SUPERADMIN
```json
{ "version": 4, "actorName": "Budi", "note": "1 gunting diganti",
  "contents": [ { "id": "…", "quantity": 3, "damagedQuantity": 0 } ] }
```
Syarat `location = CSSD`. Satu transaksi: lokasi → `OPERASI`, perubahan isi, log `RETURN`.
`contents` boleh kosong bila tidak ada perubahan.

## 4. Maintenance — semua peran

### `POST /api/items/{id}/maintenance`
Berlaku di lokasi mana pun, oleh peran mana pun yang login. Badan bergantung pada `type`:

```json
{
  "type": "PERBAIKAN",
  "actorName": "Andi",
  "performedOn": "2026-10-12",
  "performer": "Teknisi Skytron",
  "cost": 1500000,
  "damagedAfter": 0,
  "note": "",
  "details": {
    "complaint": "Oli hidrolik bocor",
    "action": "Ganti seal silinder",
    "parts": "Seal kit",
    "finishedOn": "2026-10-13"
  }
}
```
```json
{ "type": "PEMELIHARAAN", "details": { "activities": "Cek tegangan, pelumasan", "findings": "Normal" },
  "nextDue": "2027-04-12", … }
```
```json
{ "type": "KALIBRASI", "details": { "institution": "BPFK", "certificateNo": "…",
  "result": "LULUS", "validUntil": "2027-10-12" }, … }
```

Wajib per jenis: `performedOn, performer, actorName, damagedAfter` + `complaint` (perbaikan),
`activities` (pemeliharaan), `institution`/`result`/`validUntil` (kalibrasi).
`nextDue` untuk kalibrasi diisi otomatis dari `validUntil`. Satu transaksi: insert record,
update `damaged_quantity`, insert log `MAINTENANCE`.

## 5. Ringkasan

### `GET /api/summary`
Semua peran.
```json
{ "operasi": 120, "cssd": 5, "damaged": 2, "dueSoon": 4 }
```
(tidak menghitung barang terarsip; `dueSoon` = `next_due` ≤ 30 hari ke depan).

Kartu Beranda lain memakai fungsi internal `summary.service`:
- `listDueSoon` — barang jatuh tempo beserta `next_due` terdekat dan jenisnya
  (PEMELIHARAAN/KALIBRASI), diurutkan dari yang paling mendesak.
- `listNeedsSterilization` — barang aktif berstatus `needsSterilization`,
  terlama di lokasi lebih dulu.

## 6. QR

### `GET /api/qr/{code}?format=svg&size=512`
Semua peran. SVG QR berisi `https://{DOMAIN}/i/{code}`.

## 7. Pengguna — SUPERADMIN saja

| Endpoint | Fungsi |
|---|---|
| `GET /api/users` | Daftar pengguna |
| `POST /api/users` | `{ username, name, role, password }` — `mustChangePassword` otomatis true |
| `PATCH /api/users/{id}` | Ubah `name`, `role`, `isActive` |
| `POST /api/users/{id}/reset-password` | `{ password }` baru |

`POST /api/auth/change-password` (semua peran) untuk mengganti kata sandi sendiri.

## 8. Yang tidak ada

Tidak ada `PUT`/`DELETE` pada barang, riwayat, maintenance, maupun pengguna. Tidak ada
endpoint unggah berkas. Impor data awal lewat skrip CLI, bukan API.
