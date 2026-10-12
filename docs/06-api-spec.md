# 06 — Spesifikasi API

Semua endpoint butuh sesi, kecuali `/api/auth/*`. Format JSON.

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
| `FORBIDDEN` | 403 | Peran tidak berhak |
| `NOT_FOUND` | 404 | Barang tidak ada |
| `LAST_SUPERADMIN` | 409 | Tindakan akan menyisakan nol SUPERADMIN aktif |
| `VALIDATION_ERROR` | 422 | Masukan tidak valid (jumlah negatif, nama kosong) |
| `STATE_CONFLICT` | 409 | Lokasi tidak sesuai tindakan (mis. kirim barang yang sudah di CSSD) |
| `VERSION_CONFLICT` | 409 | `version` basi; muat ulang |
| `RATE_LIMITED` | 429 | Terlalu banyak percobaan login |

## 2. Barang

### `GET /api/items?q=&location=&archived=false`
Semua peran. Mengembalikan `code, name, route, location, locationSince`.

### `POST /api/items` — OPERASI
```json
{ "name": "Perlengkapan 1", "description": "", "route": "STERIL", "contents": [ { "name": "Jarum", "quantity": 10 } ] }
```
Membuat barang + isi + log `REGISTER` dalam satu transaksi. Mengembalikan barang beserta `code`.

### `GET /api/items/{code}`
Semua peran. Barang, `contents`, dan 50 riwayat terakhir.

### `GET /api/items/{code}/logs?cursor=`
Semua peran. Riwayat penuh, terbaru dulu.

### `PATCH /api/items/{id}` — OPERASI
```json
{ "version": 3, "name": "…", "description": "…", "route": "STERIL", "contents": [ { "id": "…", "name": "Jarum", "quantity": 8 } ] }
```
Barang harus di Operasi (nama, keterangan, `route`, isi dan jumlah). `contents`
menggantikan seluruh daftar; selisihnya menjadi `changes` pada log `EDIT`.

### `PATCH /api/items/{id}/contents` — STERIL (barang di CSSD), SUPERADMIN (di mana saja)
Mengubah isi/jumlah tanpa memindahkan barang. Body: `{ "version", "contents": [...] }`.

### `POST /api/items/{id}/archive` · `/restore` — OPERASI
Log `ARCHIVE` / `RESTORE`.

## 3. Alur

### `POST /api/items/{id}/send` — OPERASI, SUPERADMIN
```json
{ "actorName": "Sari", "note": "" }
```
Syarat `location = OPERASI`. Tujuan dihitung server dari `route`: `STERIL` → `CSSD`,
`NON_STERIL` → `ALKES`. Log `SEND`. Selain itu `STATE_CONFLICT`.

### `POST /api/items/{id}/return` — STERIL (dari CSSD), ALKES (dari Alkes), SUPERADMIN
```json
{
  "version": 4,
  "actorName": "Budi",
  "note": "1 gunting diganti",
  "contents": [ { "id": "…", "name": "Gunting", "quantity": 3 } ]
}
```
Syarat `location` = `CSSD` atau `ALKES`, dan peran sesuai lokasi. Dalam satu transaksi: lokasi → `OPERASI`, jumlah diperbarui,
log `RETURN` berisi `changes`. `contents` boleh dikosongkan bila tidak ada perubahan; peran ALKES tidak mengirim `contents`.

## 4. Ringkasan

### `GET /api/summary`
Semua peran. `{ "operasi": 12, "cssd": 5, "alkes": 3 }` (tidak menghitung yang diarsipkan).

## 5. QR

### `GET /api/qr/{code}?format=svg&size=512`
Semua peran. SVG QR berisi `https://{DOMAIN}/i/{code}`.

## 6. Pengguna — SUPERADMIN saja

| Endpoint | Fungsi |
|---|---|
| `GET /api/users` | Daftar pengguna |
| `POST /api/users` | `{ username, name, role, password }` — `mustChangePassword` otomatis true |
| `PATCH /api/users/{id}` | Ubah `name`, `role`, `isActive` |
| `POST /api/users/{id}/reset-password` | `{ password }` baru, `mustChangePassword` true |

Menonaktifkan atau menurunkan SUPERADMIN terakhir → `LAST_SUPERADMIN`.
`POST /api/auth/change-password` (semua peran) untuk mengganti kata sandi sendiri.

## 7. Yang tidak ada

Tidak ada `PUT`/`DELETE` pada barang, riwayat, maupun pengguna. Tidak ada endpoint unggah berkas.
