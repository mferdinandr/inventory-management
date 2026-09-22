# 04 — Arsitektur Teknis

## 1. Stack Terpilih

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15** (App Router) + TypeScript | Satu basis kode untuk halaman publik, aplikasi internal, dan API. Server Components memangkas JavaScript di sisi klien — penting untuk halaman scan yang dibuka di ponsel dengan jaringan RS |
| UI | Tailwind CSS + shadcn/ui | Komponen dimiliki sendiri di dalam repo, tidak ada ketergantungan versi pihak ketiga |
| Basis data | **PostgreSQL 16** | Butuh transaksi, constraint parsial unik, JSONB, dan pencarian teks penuh |
| ORM | **Prisma** | Migrasi yang jelas dan tipe otomatis. Kueri berat memakai SQL mentah lewat `$queryRaw` |
| Autentikasi | **Auth.js v5**, provider kredensial | Cukup untuk model undangan; tidak ada kebutuhan OAuth |
| Penyimpanan objek | **Cloudflare R2** di produksi, **MinIO** di Docker untuk pengembangan lokal | Keduanya kompatibel S3, sehingga perbedaannya hanya variabel lingkungan. R2 tanpa biaya egress dan tanpa batas disk, sehingga VPS 100 GB tidak menjadi langit-langit pertumbuhan pelanggan |
| Validasi | **Zod** | Satu skema dipakai untuk form dan untuk validasi sisi server |
| Tugas terjadwal | **pg-boss** | Antrean di dalam PostgreSQL yang sama; tidak perlu Redis pada skala ini |
| Email | **Nodemailer** ke SMTP, atau Resend | Email dikirim dari domain SIMASET sendiri untuk seluruh pelanggan, sehingga SPF dan DKIM cukup disiapkan satu kali |
| QR | `qrcode` (server, SVG) + `@zxing/browser` (pemindai) | Pembuatan di server agar konsisten; pemindaian memakai WebAssembly yang andal di peramban ponsel |
| Reverse proxy | **Caddy** | HTTPS dan pembaruan sertifikat otomatis, konfigurasi beberapa baris |
| Orkestrasi | **Docker Compose** | Sesuai untuk satu VPS |
| Log | Pino ke stdout, dikumpulkan Docker | Sederhana dan cukup pada skala ini |

### Mengapa bukan pilihan lain

- **Bukan backend terpisah.** Pada skala beberapa pelanggan dengan masing-masing di bawah 2.000 aset, memisahkan API menambah
  kerja penyebaran dan autentikasi tanpa manfaat nyata. Bila integrasi SIMRS datang,
  route handler Next.js sudah merupakan REST API yang dapat dibuka ke luar.
- **Bukan Laravel.** Alur kritis produk ini adalah pemindaian kamera, kompresi gambar di
  klien, dan unggah langsung ke penyimpanan objek — seluruhnya berada di sisi peramban.
  Satu bahasa untuk kedua sisi mengurangi gesekan.
- **Bukan Redis.** pg-boss menempatkan antrean di PostgreSQL yang sudah ada, sehingga
  satu servis lebih sedikit untuk dirawat dan dicadangkan.

---

## 2. Diagram Komponen

```mermaid
flowchart TB
    subgraph Klien
        HP["Ponsel petugas<br/>pemindai QR"]
        PC["Peramban desktop<br/>admin"]
        PUB["Pengunjung<br/>memindai QR"]
    end

    subgraph VPS["VPS — Docker Compose (2 vCPU / 8 GB / 100 GB)"]
        CADDY["Caddy<br/>HTTPS, reverse proxy"]
        APP["Next.js<br/>web + API + worker"]
        PG[("PostgreSQL 16<br/>semua tenant, RLS aktif")]
        BACKUP["Tugas cadangan<br/>pg_dump + rclone"]
    end

    R2[("Cloudflare R2<br/>foto seluruh pelanggan")]
    SMTP["SMTP<br/>pengiriman email"]

    HP --> CADDY
    PC --> CADDY
    PUB --> CADDY
    CADDY --> APP
    APP --> PG
    APP --> SMTP
    HP -.->|"unggah & unduh langsung<br/>lewat URL bertanda tangan"| R2
    PC -.-> R2
    APP -->|"menerbitkan URL<br/>bertanda tangan"| R2
    BACKUP --> PG
```

Unggahan dan pengunduhan lampiran berjalan **langsung antara peramban dan penyimpanan
objek** melalui URL bertanda tangan. Aplikasi hanya menerbitkan URL tersebut, tidak pernah
menyalurkan isi berkas. Ini yang menjaga memori dan bandwidth VPS tetap rendah berapa pun
jumlah pelanggan, dan yang membuat disk 100 GB tidak menjadi batas pertumbuhan.

---

## 3. Struktur Direktori

```
/
├── docs/                          # dokumen perencanaan
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── a/[publicId]/page.tsx      # halaman hasil scan, tanpa login
│   │   │   └── login/page.tsx
│   │   ├── (app)/                          # butuh sesi
│   │   │   ├── dashboard/
│   │   │   ├── assets/
│   │   │   │   ├── page.tsx                # daftar
│   │   │   │   ├── new/
│   │   │   │   ├── import/
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx            # detail + linimasa
│   │   │   │       ├── events/new/
│   │   │   │       ├── loan/
│   │   │   │       ├── transfer/
│   │   │   │       └── label/
│   │   │   ├── scan/                       # pemindai kamera
│   │   │   ├── loans/
│   │   │   ├── maintenance/
│   │   │   ├── reports/
│   │   │   └── settings/                   # lokasi, kategori, vendor, pengguna
│   │   ├── (platform)/                      # hanya PLATFORM_OWNER
│   │   │   └── operator/
│   │   │       ├── page.tsx                # daftar organisasi + pemakaian kuota
│   │   │       ├── new/                    # buat organisasi pelanggan
│   │   │       └── [orgId]/
│   │   │           ├── page.tsx            # detail, kuota, status langganan
│   │   │           └── impersonate/        # masuk sebagai organisasi ini
│   │   ├── print/
│   │   │   ├── label/[id]/page.tsx         # label tunggal, tata letak cetak
│   │   │   └── sheet/page.tsx              # lembar A4
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── uploads/presign/
│   │       ├── assets/
│   │       ├── events/
│   │       ├── loans/
│   │       └── qr/[publicId]/              # SVG QR
│   ├── server/
│   │   ├── auth/                           # konfigurasi sesi, guard
│   │   ├── db.ts                           # klien Prisma, menetapkan app.current_org
│   │   ├── db-platform.ts                  # koneksi khusus operator, melewati RLS
│   │   ├── tenant.ts                       # resolusi organisasi aktif dari sesi
│   │   ├── quota.ts                        # pemeriksaan kuota aset, storage, pengguna
│   │   ├── storage.ts                      # klien S3, presign
│   │   ├── mailer.ts
│   │   ├── jobs/                           # definisi pg-boss
│   │   │   ├── daily-digest.ts
│   │   │   ├── recompute-due.ts
│   │   │   └── consistency-check.ts
│   │   └── services/                       # seluruh logika bisnis ada di sini
│   │       ├── asset.service.ts
│   │       ├── event.service.ts            # satu-satunya penulis asset_events
│   │       ├── loan.service.ts
│   │       ├── maintenance.service.ts
│   │       ├── label.service.ts
│   │       └── status-machine.ts
│   ├── lib/
│   │   ├── permissions.ts                  # matriks RBAC
│   │   ├── public-id.ts                    # pembuat id acak
│   │   ├── asset-code.ts
│   │   ├── image-compress.ts               # kompresi di klien
│   │   └── validators/                     # skema Zod
│   └── components/
├── docker-compose.yml
├── Caddyfile
└── .env.example
```

**Aturan struktural yang penting:** seluruh mutasi melewati `src/server/services`.
Route handler dan Server Action hanya memvalidasi masukan, memeriksa izin, lalu memanggil
servis. Khususnya, hanya `event.service.ts` yang boleh menulis ke `asset_events`, dan hanya
`status-machine.ts` yang boleh mengubah `assets.status`. Aturan ini yang membuat jaminan
append-only bertahan seiring bertambahnya fitur.

**Aturan tenant:** `db.ts` adalah satu-satunya tempat koneksi basis data dibuka untuk
pengguna biasa, dan ia selalu menetapkan `app.current_org` dari sesi sebelum kueri apa pun
berjalan. `db-platform.ts` yang melewati RLS hanya boleh diimpor oleh berkas di bawah
`app/(platform)/` — ditegakkan dengan aturan lint agar tidak pernah bocor ke tempat lain.

---

## 4. Alur Teknis Kunci

### 4.1 Pemindaian QR sampai halaman aset

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant B as Peramban
    participant N as Next.js
    participant DB as PostgreSQL

    U->>B: Pindai QR dengan kamera
    B->>B: Baca URL https://simaset.id/a/x7Kp92mQr4Lt
    B->>N: GET /a/x7Kp92mQr4Lt
    N->>N: Periksa sesi
    alt Ada sesi dan berwenang
        N-->>B: Alihkan ke /assets/{id}
    else Tanpa sesi
        N->>DB: Ambil aset + 10 riwayat terakhir (kolom publik saja)
        DB-->>N: Data terbatas
        N-->>B: Halaman publik + tombol masuk
    end
```

Halaman publik memakai Server Component dengan kueri `select` yang **secara eksplisit
menyebut kolom aman**, bukan mengambil seluruh baris lalu menyaringnya di komponen.
Kolom sensitif tidak pernah meninggalkan basis data.

### 4.2 Mencatat riwayat dengan foto

```mermaid
sequenceDiagram
    participant B as Peramban
    participant N as Next.js
    participant S as R2 / MinIO
    participant DB as PostgreSQL

    B->>B: Pengguna memilih foto
    B->>B: Kompresi ke maks 1600px, ~500KB
    B->>N: POST /api/uploads/presign (jenis, ukuran)
    N->>N: Validasi izin, jenis, ukuran
    N->>S: Buat URL PUT bertanda tangan (berlaku 5 menit)
    N-->>B: URL + objectKey
    B->>S: PUT langsung ke penyimpanan objek
    S-->>B: 200
    B->>N: POST /api/events (data + daftar objectKey)
    N->>DB: BEGIN
    N->>DB: INSERT asset_events
    N->>DB: INSERT attachments
    N->>DB: UPDATE assets.status (bila ada transisi)
    N->>DB: COMMIT
    N-->>B: Berhasil, alihkan ke detail aset
```

Objek yang terlanjur terunggah tetapi entrinya gagal tersimpan menjadi yatim. Tugas
pembersih mingguan menghapus objek tanpa baris `attachments` yang berumur lebih dari 24 jam.

### 4.3 Peminjaman

Seluruhnya dalam satu transaksi:

1. Kunci baris aset dengan `SELECT ... FOR UPDATE`.
2. Tolak bila status bukan `AVAILABLE` atau `IN_USE`.
3. Sisipkan `asset_events` bertipe `LOAN_OUT`.
4. Sisipkan `loans` yang menunjuk entri tersebut.
5. Perbarui `assets.status = 'ON_LOAN'`.

Indeks parsial unik `loans_one_active_per_asset` menjadi penjaga terakhir bila dua petugas
menekan simpan bersamaan; permintaan kedua gagal di basis data dan diterjemahkan menjadi
pesan "Aset ini baru saja dipinjam orang lain".

### 4.4 Tugas terjadwal

| Tugas | Jadwal | Isi |
|---|---|---|
| `recompute-due` | Harian 06:00 WIB | Hitung ulang `next_due_at`, tandai jadwal yang terlewat |
| `daily-digest` | Harian 07:00 WIB | Susun dan kirim email ringkasan ke Admin dan PIC terkait |
| `consistency-check` | Harian 02:00 WIB | Cari ketidaksesuaian antara status aset dan peminjaman aktif, laporkan lewat log dan email ke Super Admin |
| `orphan-cleanup` | Mingguan | Hapus objek penyimpanan tanpa baris `attachments`, lalu hitung ulang `used_storage_bytes` tiap organisasi |
| `backup` | Harian 01:00 WIB | `pg_dump` terkompresi ke penyimpanan luar. Objek R2 tidak perlu dicermin karena sudah tereplikasi oleh Cloudflare |

Worker berjalan **di dalam proses Next.js yang sama** pada skala ini, diaktifkan lewat
variabel lingkungan `ENABLE_WORKER=true` sehingga dapat dipisahkan menjadi kontainer
tersendiri bila kelak diperlukan.

---

## 5. Keputusan Arsitektur

### ADR-01 — `public_id` acak, bukan berurutan

**Keputusan.** QR memuat pengenal acak 12 karakter dari alfabet tanpa karakter ambigu
(`23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`).

**Alasan.** Halaman `/a/{id}` terbuka untuk publik. Pengenal berurutan mengundang penelusuran
menyeluruh seluruh aset rumah sakit oleh siapa pun yang memfoto satu label. Ruang 12 karakter
membuat penebakan tidak praktis. Kode terbaca manusia tetap ada sebagai `asset_code`, tetapi
tidak menjadi jalan masuk.

### ADR-02 — Append-only ditegakkan di basis data, bukan hanya aplikasi

**Keputusan.** Cabut hak `UPDATE` dan `DELETE` pada `asset_events` untuk peran aplikasi, dan
pasang rule PostgreSQL sebagai lapisan kedua.

**Alasan.** Nilai sistem ini bersandar pada riwayat yang dapat dipercaya. Jaminan yang hanya
hidup di kode aplikasi akan bocor melalui skrip perbaikan data, migrasi terburu-buru, atau
fitur baru yang ditulis enam bulan kemudian.

### ADR-03 — Perubahan status hanya melalui satu pintu

**Keputusan.** `status-machine.ts` adalah satu-satunya modul yang mengubah `assets.status`,
dan selalu menulis entri riwayat dalam transaksi yang sama.

**Alasan.** Mencegah status dan riwayat menceritakan hal berbeda. Bila keduanya dapat
berubah terpisah, cepat atau lambat keduanya akan berbeda.

### ADR-04 — Unggah langsung ke penyimpanan objek

**Keputusan.** Berkas tidak pernah melewati proses aplikasi.

**Alasan.** VPS kecil akan cepat kehabisan memori bila menyalurkan unggahan foto. Presigned
URL memindahkan pekerjaan itu ke penyimpanan objek. Pola yang sama berjalan tanpa perubahan
kode baik terhadap MinIO di lingkungan lokal maupun Cloudflare R2 di produksi.

### ADR-05 — `organization_id` di seluruh tabel sejak migrasi pertama

**Keputusan.** Seluruh tabel utama membawa kolom organisasi sejak migrasi pertama, dan seed
membuat dua organisasi contoh, bukan satu.

**Alasan.** Menambahkan isolasi tenant ke basis data yang sudah berisi data produksi berarti
menyentuh setiap tabel, setiap kueri, dan setiap indeks. Dan isolasi yang hanya diuji dengan
satu tenant sebenarnya tidak pernah diuji sama sekali — kebocoran baru terlihat ketika ada
tenant kedua untuk membocorkannya.

### ADR-06 — Jalur lokasi disimpan sebagai `path`

**Keputusan.** Simpan jalur leluhur pada setiap lokasi, bukan hanya `parent_id`.

**Alasan.** Pertanyaan paling sering adalah "seluruh aset di Instalasi X", yang dengan
`parent_id` saja memerlukan CTE rekursif pada setiap permintaan. Jalur terwujud mengubahnya
menjadi satu pencocokan awalan berindeks. Biayanya adalah pembaruan jalur seluruh anak ketika
sebuah lokasi dipindahkan — peristiwa yang sangat jarang.

### ADR-08 — Multi-tenant dalam satu basis data, dijaga Row Level Security

**Keputusan.** Seluruh pelanggan berbagi satu aplikasi dan satu basis data, dipisahkan
`organization_id` dan kebijakan RLS pada setiap tabel bertenant. Bukan database terpisah
per pelanggan, bukan pula instans terpisah.

**Alasan.** Pada skala yang direncanakan — di bawah sepuluh pelanggan pada tahun pertama —
satu deployment berarti satu proses pembaruan, satu cadangan, dan satu tempat memeriksa
ketika ada yang bermasalah. Database terpisah per pelanggan mengalikan seluruh pekerjaan itu
tanpa memberi keuntungan yang terasa sebelum ada tuntutan isolasi dari pelanggan besar.

**Risiko yang diterima.** Satu kueri yang lupa memfilter organisasi akan membocorkan data
antar rumah sakit. Ini risiko yang tidak dapat ditoleransi, maka penanganannya berlapis:
`organization_id` wajib di setiap kueri, RLS aktif sebagai jaring pengaman di tingkat basis
data, dan satu pengujian otomatis di CI yang mencoba membaca data tenant lain dan memastikan
hasilnya kosong.

**Konsekuensi.** `app.current_org` ditetapkan di awal tiap transaksi dari sesi pengguna,
tidak pernah dari parameter permintaan. Panel operator memakai koneksi basis data terpisah
yang melewati RLS, dan hanya itu satu-satunya jalan melewatinya.

### ADR-09 — Satu domain bersama untuk seluruh pelanggan

**Keputusan.** Halaman publik hasil pemindaian berada di satu domain untuk semua pelanggan,
misalnya `simaset.id/a/{public_id}`. Tidak ada subdomain maupun custom domain per pelanggan.

**Alasan.** URL itu tercetak permanen pada label fisik. Subdomain per pelanggan berarti
nama rumah sakit ikut tercetak, sehingga perubahan nama, merger, atau restrukturisasi
subdomain mengharuskan pencetakan ulang seluruh label pelanggan tersebut. `public_id` sudah
unik global, jadi satu domain bersama tidak menimbulkan tabrakan sama sekali.

**Konsekuensi.** Halaman publik harus menampilkan nama dan logo rumah sakit pemilik aset,
karena domainnya sendiri tidak lagi memberi petunjuk itu.

### ADR-07 — Penghapusan aset memiliki masa pembatalan, bukan penghapusan fisik

**Keputusan.** Menghapuskan aset mengubah statusnya menjadi `DISPOSED` dan menyimpan batas
waktu pembatalan 30 hari. Setelah batas itu lewat, pembatalan ditolak, tetapi barisnya
tetap tersimpan selamanya. Tidak ada pekerjaan terjadwal yang menghapus baris aset.

**Alasan.** Dua kebutuhan yang tampak bertentangan sebenarnya dapat dipenuhi bersamaan.
Pengguna membutuhkan kelonggaran untuk memperbaiki salah klik — itu dijawab oleh masa 30 hari.
Sistem membutuhkan data yang tidak berlubang — itu dijawab dengan menyimpan barisnya.

Menghapus baris secara fisik akan merusak tiga hal sekaligus: label QR yang masih menempel
pada barang yang dihibahkan atau dijual berhenti menjawab, laporan penghapusan aset tahunan
kehilangan isinya, dan riwayat kalibrasi alat lenyap justru ketika auditor memintanya.

Dari sudut pandang pengguna kedua pendekatan terlihat sama: aset hilang dari seluruh daftar,
pencarian, dan dashboard. Perbedaannya hanya terasa pada dua tempat yang justru paling
penting — hasil pemindaian dan laporan.

**Konsekuensi.** Setiap kueri daftar wajib memfilter `status <> 'DISPOSED'` secara bawaan.
Ini ditegakkan lewat satu fungsi pembangun kueri bersama, bukan diulang di tiap halaman.

---

## 6. Performa

Pada 2.000 aset target performa tercapai tanpa upaya khusus, asalkan:

- Daftar aset memakai kursor pagination, tidak memuat seluruh baris.
- Linimasa riwayat dibatasi 20 entri dengan tombol muat lebih banyak.
- Halaman publik memakai cache Next.js dengan revalidasi 60 detik, dan di-invalidasi
  lewat tag ketika aset atau riwayatnya berubah.
- Hitungan dashboard memakai agregasi SQL, bukan perulangan di JavaScript.
- QR dihasilkan sebagai SVG dan di-cache dengan header panjang; isinya tidak pernah berubah.

---

## 7. Penanganan Kesalahan

- Seluruh Server Action mengembalikan bentuk hasil bertipe `{ ok: true, data } | { ok: false, error }`,
  tidak melempar pengecualian ke peramban.
- Pelanggaran constraint basis data diterjemahkan ke pesan berbahasa Indonesia yang bermakna,
  terutama pelanggaran indeks peminjaman aktif.
- Galat tak terduga dicatat lengkap di server dan ditampilkan ke pengguna sebagai pesan singkat
  dengan nomor rujukan.
- Kegagalan unggah tidak boleh membuat pengguna kehilangan isi formulir: isian tetap ada dan
  hanya bagian foto yang meminta coba ulang.

---

## 8. Pengujian

| Lapisan | Cakupan minimal |
|---|---|
| **Isolasi tenant** | **Wajib, dijalankan di CI.** Pengguna organisasi A mencoba membaca, mengubah, dan menghapus aset organisasi B lewat setiap endpoint — seluruhnya harus gagal atau mengembalikan kosong. Termasuk percobaan menebak `public_id` dan mengakses lampiran milik tenant lain |
| Unit | `status-machine` seluruh transisi sah dan tidak sah; pembuat `asset_code` dan `public_id`; matriks izin; pemeriksaan kuota |
| Integrasi | Servis peminjaman dengan basis data sungguhan, termasuk dua permintaan bersamaan pada satu aset; penegakan append-only; penghitungan ulang jadwal; penolakan saat kuota terlampaui |
| End-to-end | Daftarkan aset → cetak label → buka halaman publik → catat peminjaman → kembalikan; batas akses halaman publik |
| Manual | Pemindaian kamera pada ponsel Android dan iOS sungguhan, di bawah pencahayaan ruangan rumah sakit |

---

## 9. Variabel Lingkungan

```bash
# Aplikasi
# Lokal: http://localhost:3000 — nilai ini yang masuk ke dalam QR.
# JANGAN mencetak label sungguhan selama APP_URL belum menunjuk domain produksi final.
APP_URL=http://localhost:3000
NODE_ENV=development
AUTH_SECRET=                      # 32 byte acak
SESSION_MAX_AGE_HOURS=12          # sesi biasa
SESSION_REMEMBER_ME_DAYS=7        # bila "Ingat saya" dipilih
TOTP_ENCRYPTION_KEY=              # 32 byte acak, untuk mengenkripsi secret 2FA
DISPOSAL_REVERT_DAYS=30           # masa pembatalan penghapusan aset

# Basis data
DATABASE_URL=postgresql://simaset:***@postgres:5432/simaset

# Penyimpanan objek (kompatibel S3)
# Lokal  : MinIO di Docker
# Produksi: Cloudflare R2
S3_ENDPOINT=http://minio:9000                 # R2: https://<account>.r2.cloudflarestorage.com
S3_PUBLIC_ENDPOINT=http://localhost:9000      # R2: domain publik bucket
S3_REGION=auto                                # R2 memakai "auto"
S3_BUCKET=simaset
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_FORCE_PATH_STYLE=true          # true untuk MinIO, false untuk R2
UPLOAD_MAX_BYTES=10485760
PRESIGN_PUT_TTL_SECONDS=300
PRESIGN_GET_TTL_SECONDS=900

# Email
SMTP_HOST=                        # atau Resend / Amazon SES
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="SIMASET <noreply@simaset.id>"

# Pekerjaan terjadwal
ENABLE_WORKER=true
TZ=Asia/Jakarta

# Pembatasan laju halaman publik
PUBLIC_RATE_LIMIT_PER_MINUTE=60

# Multi-tenant
DATABASE_URL_PLATFORM=            # koneksi terpisah untuk panel operator, melewati RLS
DEFAULT_QUOTA_ASSETS=2000
DEFAULT_QUOTA_STORAGE_BYTES=21474836480   # 20 GB
DEFAULT_QUOTA_USERS=50
```
