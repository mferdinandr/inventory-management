# 06 — Spesifikasi API

Sebagian besar mutasi di antarmuka internal dijalankan lewat **Server Actions** Next.js.
Endpoint HTTP di bawah ini disediakan untuk hal-hal yang memang memerlukannya: unggahan,
pemindaian, pembuatan QR, dan integrasi di masa depan.

**Basis URL:** `https://{domain}/api`
**Autentikasi:** cookie sesi. Endpoint publik ditandai secara eksplisit.
**Format:** JSON. Seluruh waktu dikirim dan diterima dalam ISO 8601 UTC.

---

## 1. Bentuk Respons

Berhasil:

```json
{ "ok": true, "data": { } }
```

Gagal:

```json
{
  "ok": false,
  "error": {
    "code": "ASSET_NOT_AVAILABLE",
    "message": "Aset sedang dipinjam oleh Budi Santoso sejak 12 September 2026.",
    "details": { "currentStatus": "ON_LOAN", "loanId": "..." }
  }
}
```

### Kode error

| Kode | HTTP | Arti |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Tidak ada sesi yang sah |
| `FORBIDDEN` | 403 | Sesi ada, tetapi peran atau cakupan lokasi tidak mengizinkan |
| `NOT_FOUND` | 404 | Sumber daya tidak ada, atau ada tetapi di luar organisasi pemanggil |
| `VALIDATION_ERROR` | 422 | Masukan tidak lolos validasi; `details` berisi kesalahan per field |
| `ASSET_NOT_AVAILABLE` | 409 | Aset tidak berada pada status yang memungkinkan tindakan ini |
| `INVALID_STATUS_TRANSITION` | 409 | Transisi status tidak sah |
| `LOAN_ALREADY_ACTIVE` | 409 | Aset sudah memiliki peminjaman aktif |
| `ASSET_DISPOSED` | 409 | Aset telah dihapuskan dan tidak dapat diubah |
| `EVENT_IMMUTABLE` | 409 | Percobaan mengubah atau menghapus riwayat |
| `UPLOAD_TOO_LARGE` | 413 | Berkas melebihi batas |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Jenis berkas tidak diizinkan |
| `RATE_LIMITED` | 429 | Terlalu banyak permintaan |
| `INTERNAL_ERROR` | 500 | Galat tak terduga; `details.ref` berisi nomor rujukan untuk log |

---

## 2. Endpoint Publik

### `GET /a/{publicId}` — halaman, bukan JSON

Halaman hasil pemindaian. Mengembalikan HTML. Tanpa autentikasi.
Dibatasi 60 permintaan per menit per alamat IP.

### `GET /api/public/assets/{publicId}`

Versi JSON dari halaman publik. Tanpa autentikasi, dibatasi laju yang sama.

```json
{
  "ok": true,
  "data": {
    "publicId": "x7Kp92mQr4Lt",
    "assetCode": "RSXX-RAD-2026-0012",
    "name": "Ventilator Dewasa",
    "category": "Elektromedik",
    "brand": "Contoh",
    "model": "V-200",
    "location": "Gedung A / Lantai 2 / Instalasi Radiologi / Ruang CT-Scan",
    "status": "AVAILABLE",
    "condition": "GOOD",
    "roomPicName": "Siti Aminah",
    "nextCalibrationDue": "2027-03-15",
    "isDisposed": false,
    "recentEvents": [
      { "type": "CALIBRATION", "title": "Kalibrasi tahunan, lulus", "occurredAt": "2026-03-15T02:00:00Z" },
      { "type": "INSPECTION",  "title": "Pengecekan rutin bulanan",  "occurredAt": "2026-08-01T01:30:00Z" }
    ]
  }
}
```

Respons ini **tidak pernah** memuat nomor seri, nilai perolehan, sumber dana, vendor,
lampiran, isi catatan, identitas peminjam, maupun nama pencatat.

### `GET /api/qr/{publicId}?format=svg&size=512`

Mengembalikan gambar QR. Tanpa autentikasi — isinya hanya sebuah URL yang memang tercetak
di label fisik. Disajikan dengan header cache panjang karena tidak pernah berubah.

---

## 3. Aset

### `GET /api/assets`

Parameter: `q`, `locationId` (termasuk seluruh sublokasi), `categoryId`, `status`,
`condition`, `responsibleUserId`, `dueBefore`, `includeDisposed`, `cursor`, `limit` (maks 100),
`sort`.

```json
{
  "ok": true,
  "data": {
    "items": [ { "id": "...", "assetCode": "...", "name": "...", "status": "AVAILABLE" } ],
    "nextCursor": "eyJpZCI6...",
    "total": 1834
  }
}
```

### `POST /api/assets`

```json
{
  "name": "Ventilator Dewasa",
  "categoryId": "...",
  "locationId": "...",
  "condition": "GOOD",
  "acquisitionDate": "2026-01-20",
  "brand": "Contoh",
  "model": "V-200",
  "serialNumber": "SN-99812",
  "acquisitionCost": 185000000,
  "fundingSource": "BLUD",
  "vendorId": "...",
  "warrantyUntil": "2028-01-20",
  "responsibleUserId": "...",
  "parentAssetId": null,
  "primaryPhotoKey": "...",
  "notes": ""
}
```

Efek: membuat aset, menghasilkan `publicId` dan `assetCode`, menulis entri `CREATED`, dan
membuat jadwal kalibrasi bila kategorinya alat medis.

`409 DUPLICATE_SERIAL` dikembalikan bila nomor seri sudah dipakai, kecuali permintaan
menyertakan `"confirmDuplicateSerial": true`.

### `GET /api/assets/{id}`

Detail penuh termasuk lokasi, kategori, vendor, PIC, jadwal, peminjaman aktif, aset anak,
dan ringkasan riwayat.

### `PATCH /api/assets/{id}`

Mengubah data deskriptif. **Tidak dapat** mengubah `status`, `locationId`, `publicId`,
maupun `assetCode` — masing-masing punya endpoint tersendiri agar selalu meninggalkan jejak.

### `POST /api/assets/{id}/transfer`

```json
{
  "toLocationId": "...",
  "reason": "Realokasi ke Instalasi Bedah",
  "occurredAt": "2026-09-19T03:00:00Z",
  "moveChildren": true,
  "newResponsibleUserId": "...",
  "attachmentKeys": []
}
```

### `POST /api/assets/{id}/status`

```json
{
  "status": "DAMAGED",
  "reason": "Layar tidak menyala setelah pemadaman listrik",
  "occurredAt": "2026-09-19T03:00:00Z",
  "attachmentKeys": []
}
```

Ditolak dengan `INVALID_STATUS_TRANSITION` bila transisi tidak sah, dan tidak dapat dipakai
untuk memasuki atau meninggalkan `ON_LOAN`.

### `POST /api/assets/{id}/dispose`

```json
{
  "reason": "RUSAK_TOTAL",
  "disposedAt": "2026-09-19",
  "documentNo": "BA-HPS/2026/014",
  "notes": "Tidak ekonomis diperbaiki, usia 12 tahun",
  "attachmentKeys": []
}
```

### `POST /api/assets/import`

Impor massal. Menerima berkas Excel/CSV yang sudah diunggah, mengembalikan hasil validasi
per baris. Menyimpan hanya bila `"commit": true`.

---

## 4. Riwayat

### `GET /api/assets/{id}/events`

Parameter: `type`, `from`, `to`, `cursor`, `limit`.
Terurut menurun berdasarkan `occurredAt`. Entri yang telah dikoreksi ditandai
`"correctedBy": "<eventId>"`.

### `POST /api/events`

```json
{
  "assetId": "...",
  "type": "INSPECTION",
  "title": "Pengecekan rutin bulanan",
  "notes": "Kabel daya mulai getas, dijadwalkan penggantian",
  "occurredAt": "2026-09-18T07:00:00Z",
  "attachmentKeys": ["org/assets/.../a1b2.jpg"],
  "newCondition": "MINOR_ISSUE"
}
```

Aturan: `occurredAt` tidak boleh melewati waktu sekarang. `recordedAt` dan `recordedBy`
selalu ditetapkan server dan mengabaikan nilai dari klien. Maksimal 5 lampiran.

### `POST /api/events/{id}/correction`

```json
{
  "title": "Koreksi: pengecekan dilakukan 17 September, bukan 18",
  "notes": "Salah input tanggal saat pencatatan mundur",
  "occurredAt": "2026-09-19T02:00:00Z",
  "attachmentKeys": []
}
```

### `PUT` / `DELETE` pada `/api/events/{id}`

Selalu mengembalikan `409 EVENT_IMMUTABLE`. Endpoint ini sengaja ada agar kesalahan
pemakaian API terjawab dengan jelas, bukan dengan 404 yang membingungkan.

---

## 5. Peminjaman

### `POST /api/loans`

Peminjam terdaftar:

```json
{
  "assetId": "...",
  "borrowerType": "INTERNAL_USER",
  "borrowerUserId": "...",
  "purpose": "Pemeriksaan pasien di Ruang IGD",
  "borrowedAt": "2026-09-19T04:00:00Z",
  "dueAt": "2026-09-20T04:00:00Z",
  "conditionOut": "GOOD",
  "attachmentKeys": []
}
```

Peminjam luar:

```json
{
  "assetId": "...",
  "borrowerType": "EXTERNAL_PERSON",
  "borrowerName": "Budi Santoso",
  "borrowerPhone": "081234567890",
  "borrowerUnit": "Instalasi Gizi",
  "purpose": "Kegiatan penyuluhan di aula",
  "borrowedAt": "2026-09-19T04:00:00Z",
  "dueAt": null,
  "conditionOut": "GOOD",
  "attachmentKeys": []
}
```

Gagal dengan `ASSET_NOT_AVAILABLE` bila status aset tidak memungkinkan, atau
`LOAN_ALREADY_ACTIVE` bila ada permintaan lain yang menang dalam perlombaan penyimpanan.

### `POST /api/loans/{id}/return`

```json
{
  "returnedAt": "2026-09-20T09:00:00Z",
  "conditionIn": "MINOR_ISSUE",
  "notes": "Roda depan longgar",
  "attachmentKeys": []
}
```

`conditionIn` bernilai `NEEDS_REPAIR` atau `UNUSABLE` membuat status aset menjadi `DAMAGED`.

### `GET /api/loans`

Parameter: `active`, `overdue`, `assetId`, `borrowerUserId`, `locationId`, `from`, `to`.

---

## 6. Pemeliharaan dan Kalibrasi

### `GET /api/maintenance/due`

Parameter: `within` (`overdue`, `7d`, `30d`, `90d`), `locationId`, `categoryId`, `type`.

### `POST /api/maintenance/schedules`

```json
{ "assetId": "...", "type": "CALIBRATION", "intervalMonths": 12, "nextDueAt": "2027-03-15" }
```

### `POST /api/maintenance/records`

```json
{
  "assetId": "...",
  "scheduleId": "...",
  "type": "CALIBRATION",
  "performedAt": "2026-09-15",
  "performedByVendorId": "...",
  "result": "PASS",
  "validUntil": "2027-09-15",
  "certificateNumber": "KAL/2026/0881",
  "certificateObjectKey": "...",
  "cost": 2500000,
  "description": "Kalibrasi tahunan sesuai standar pabrikan",
  "attachmentKeys": []
}
```

Efek: menulis entri riwayat, memperbarui jadwal, dan pada `result = "FAIL"` mengubah status
aset menjadi `DAMAGED`.

---

## 7. Unggahan

### `POST /api/uploads/presign`

```json
{ "purpose": "EVENT_ATTACHMENT", "assetId": "...", "filename": "kerusakan.jpg", "contentType": "image/jpeg", "sizeBytes": 412880 }
```

Respons:

```json
{
  "ok": true,
  "data": {
    "uploadUrl": "https://berkas.rs-contoh.co.id/simaset/...?X-Amz-Signature=...",
    "objectKey": "org/assets/.../a1b2c3.jpg",
    "expiresIn": 300
  }
}
```

Nilai `purpose` yang berlaku: `EVENT_ATTACHMENT`, `ASSET_PHOTO`, `CERTIFICATE`,
`ORG_LOGO`, `IMPORT_FILE`. Jenis berkas yang diizinkan: `image/jpeg`, `image/png`,
`image/webp`, dan `application/pdf` khusus untuk `CERTIFICATE`.

Kunci objek yang dikembalikan **ditentukan server**; klien tidak boleh menyusunnya sendiri.

### `GET /api/uploads/signed-url?key=...`

Menerbitkan URL baca berumur pendek. Memerlukan sesi dan memeriksa bahwa pemanggil berhak
atas aset pemilik berkas tersebut.

---

## 8. Cetak Label

### `GET /print/label/{assetId}?size=50x30`
### `GET /print/sheet?ids=a,b,c&layout=a4-3x8`

Halaman HTML dengan gaya cetak. Mengakses keduanya mencatat baris pada `label_prints`,
dengan `reason` diambil dari parameter kueri `reason`.

---

## 9. Master Data dan Pengguna

Pola CRUD yang seragam, seluruhnya memerlukan peran Admin atau Super Admin:

```
GET|POST        /api/locations         PATCH /api/locations/{id}
GET|POST        /api/categories        PATCH /api/categories/{id}
GET|POST        /api/vendors           PATCH /api/vendors/{id}
GET|POST        /api/users             PATCH /api/users/{id}
POST            /api/users/{id}/resend-invite
POST            /api/users/{id}/disable
```

Tidak ada `DELETE` pada satu pun sumber daya di atas. Penonaktifan dilakukan dengan
`is_active` atau `status`.

---

## 10. Laporan

```
GET /api/reports/assets-by-room?locationId=...&format=xlsx
GET /api/reports/asset-history/{assetId}?format=pdf
GET /api/reports/loans?from=...&to=...&format=xlsx
GET /api/reports/calibration-compliance?format=xlsx
GET /api/reports/disposed?from=...&to=...&format=xlsx
```

Laporan besar dibuat secara sinkron pada skala v1. Bila kelak melampaui sekitar 5.000 baris,
alihkan ke pekerjaan latar dengan pemberitahuan lewat email.

---

## 11. Pembatasan Laju

| Kelompok | Batas |
|---|---|
| Endpoint publik | 60 per menit per IP |
| Login | 5 kegagalan per 15 menit per IP dan per akun |
| Penerbitan presign | 30 per menit per pengguna |
| Umum bagi pengguna terautentikasi | 300 per menit per pengguna |
