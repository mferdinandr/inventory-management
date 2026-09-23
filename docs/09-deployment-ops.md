# 09 — Deployment dan Operasional

Target: satu VPS milik sendiri, dijalankan dengan Docker Compose.

---

## 1. Spesifikasi Server

| Komponen | Yang dipakai | Catatan |
|---|---|---|
| CPU | 2 vCPU | Cukup; beban terberat adalah kueri basis data, bukan pemrosesan berkas |
| RAM | 8 GB | Lapang untuk Next.js dan PostgreSQL pada skala ini |
| Disk | 100 GB NVMe | Hanya untuk aplikasi, basis data, dan cadangan lokal |
| Sistem operasi | Ubuntu 24.04 LTS | |
| Lokasi | Indonesia atau Singapura | |

**Mengapa disk 100 GB cukup.** Foto seluruh pelanggan berada di Cloudflare R2, bukan di
disk VPS. Yang tersisa di sini hanya basis data dan cadangan.

Perkiraan per organisasi dengan 2.000 aset: sekitar 24.000 entri riwayat per tahun
menghasilkan basis data di bawah 500 MB. Sepuluh pelanggan pun masih di bawah 5 GB.
Fotonya — sekitar 14 GB per pelanggan per tahun — seluruhnya ke R2 dan tidak menyentuh
disk ini sama sekali.

Inilah alasan R2 dipakai sejak awal, bukan menunggu disk penuh: memindahkan puluhan giga
foto milik pelanggan aktif jauh lebih merepotkan daripada menyiapkannya dari hari pertama.

---

## 2. Docker Compose

Produksi tidak menjalankan MinIO — foto berada di Cloudflare R2. MinIO hanya hadir di
`docker-compose.dev.yml` untuk pengembangan lokal.

```yaml
# docker-compose.yml — produksi
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]

  app:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
    expose: ["3000"]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: simaset
      POSTGRES_USER: simaset
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    secrets: [pg_password]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U simaset"]
      interval: 10s
      timeout: 5s
      retries: 5
    # tanpa pemetaan porta: hanya dapat dicapai dari jaringan Docker

  backup:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./scripts/backup.sh:/backup.sh:ro
      - backups:/backups
    entrypoint: ["/bin/sh", "-c", "crond -f -l 2"]

volumes:
  pgdata:
  backups:
  caddy_data:
  caddy_config:

secrets:
  pg_password: { file: ./secrets/pg_password }
```

```yaml
# docker-compose.dev.yml — hanya pengembangan lokal
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: simaset
      MINIO_ROOT_PASSWORD: simaset-dev-only
    volumes:
      - miniodata:/data
    ports: ["9000:9000", "9001:9001"]

volumes:
  miniodata:
```

Di lokal, `APP_URL` bernilai `http://localhost:3000`. Peramban mengecualikan `localhost`
dari keharusan HTTPS, sehingga kamera pemindai QR tetap dapat diuji tanpa sertifikat.

## 3. Caddyfile

```caddy
{DOMAIN} {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options    "nosniff"
        X-Frame-Options           "DENY"
        Referrer-Policy           "strict-origin-when-cross-origin"
    }

    # Pembatasan laju halaman publik hasil pemindaian
    @public path /a/* /api/public/*
    rate_limit @public {
        zone public { key {remote_host}  events 60  window 1m }
    }

    reverse_proxy app:3000
}

```

Hanya satu blok domain: seluruh pelanggan berbagi domain ini, dan berkas dilayani langsung
oleh Cloudflare R2 sehingga tidak melewati Caddy sama sekali.

Caddi mengurus sertifikat Let's Encrypt dan perpanjangannya tanpa konfigurasi tambahan.
Modul `rate_limit` perlu disertakan saat membangun citra Caddy dengan xcaddy.

---

## 4. Penyiapan Awal

```bash
# 1. Keamanan dasar server
adduser --disabled-password deploy
usermod -aG sudo,docker deploy
# nonaktifkan login kata sandi dan login root di /etc/ssh/sshd_config
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# 2. Pasang Docker
curl -fsSL https://get.docker.com | sh

# 3. Ambil kode dan siapkan rahasia
git clone <repo> /opt/simaset && cd /opt/simaset
mkdir -p secrets
openssl rand -base64 32 > secrets/pg_password
chmod 600 secrets/*
# Bucket R2 dan kuncinya dibuat lewat dasbor Cloudflare, lalu diisikan ke .env
cp .env.example .env && $EDITOR .env

# 4. Jalankan
docker compose up -d --build

# 5. Siapkan basis data dan bucket
docker compose exec app pnpm prisma migrate deploy
docker compose exec app pnpm prisma db seed

# 6. Pastikan bucket R2 tidak dapat diakses anonim, lalu buat organisasi
#    pelanggan pertama lewat panel operator di /operator
```

---

## 5. Cadangan

`scripts/backup.sh`, dijalankan setiap hari pukul 01:00 WIB:

```bash
#!/bin/sh
set -eu
STAMP=$(date +%Y%m%d-%H%M)

# Basis data
pg_dump -h postgres -U simaset simaset | gzip > "/backups/db-$STAMP.sql.gz"

# Foto tidak perlu dicadangkan di sini: R2 sudah tereplikasi oleh Cloudflare.
# Yang tidak tergantikan adalah basis data, karena di situlah kunci objek tersimpan.

# Kirim ke penyimpanan luar server
rclone sync /backups remote:simaset-backup --transfers 4

# Simpan 30 hari terakhir secara lokal
find /backups -name 'db-*.sql.gz' -mtime +30 -delete
```

**Tujuan cadangan: Cloudflare R2, bucket terpisah dari bucket foto.** Memisahkannya
memastikan salah konfigurasi pada satu bucket tidak merusak yang lain.

**Aturan yang tidak boleh dilanggar:** salinan cadangan harus berada **di luar VPS**.
Cadangan yang tersimpan di disk yang sama dengan datanya bukanlah cadangan.

**Uji pemulihan setiap kuartal.** Pulihkan ke lingkungan terpisah, buka aplikasinya, dan
pastikan foto masih dapat dibuka. Cadangan yang tidak pernah diuji sering ternyata tidak dapat dipulihkan.

---

## 6. Pemantauan

Pada skala ini, pemantauan sederhana sudah memadai:

| Yang dipantau | Cara | Ambang peringatan |
|---|---|---|
| Aplikasi hidup | Endpoint `/api/health` diperiksa Uptime Kuma atau layanan gratis | Gagal 2 kali berturut-turut |
| Penggunaan disk | Tugas cron harian | Di atas 75% |
| Keberhasilan cadangan | Skrip mengirim email saat gagal | Setiap kegagalan |
| Galat aplikasi | Log Pino selama MVP; Sentry dipasang di M7 | Lonjakan tak wajar |
| Konsistensi data | Tugas `consistency-check` harian | Setiap ketidaksesuaian |
| Pemakaian kuota pelanggan | Panel operator dan ringkasan mingguan | Organisasi melewati 80% kuota |
| Biaya R2 | Dasbor Cloudflare | Lonjakan tak wajar dari satu organisasi |

Endpoint `/api/health` memeriksa koneksi basis data dan penyimpanan objek, lalu
mengembalikan `{ "status": "ok", "db": "ok", "storage": "ok", "version": "..." }`.

---

## 7. Pembaruan Versi

Deploy berjalan **otomatis lewat GitHub Actions** setiap kali ada push ke `main`, dan hanya
setelah seluruh pengujian lulus — termasuk uji isolasi tenant.

Urutan yang dijalankan pipeline:

1. Lint, tes unit dan integrasi, uji isolasi tenant. Gagal di sini berarti deploy dibatalkan.
2. Build citra Docker.
3. SSH ke VPS memakai kunci yang tersimpan di GitHub Secrets.
4. **Cadangkan basis data lebih dulu**, selalu.
5. `prisma migrate deploy`.
6. Ganti container aplikasi.
7. Periksa `/api/health`. Bila gagal, kembalikan ke citra sebelumnya.

Deploy manual, bila diperlukan:

```bash
cd /opt/simaset
docker compose exec backup /backup.sh          # cadangkan lebih dulu, selalu
git pull
docker compose build app
docker compose exec app pnpm prisma migrate deploy
docker compose up -d app
curl -sf https://{DOMAIN}/api/health
```

Waktu henti sekitar 10–20 detik. Pada skala ini hal tersebut dapat diterima; lakukan di luar
jam sibuk. Bila kelak tidak dapat diterima, jalankan dua kontainer aplikasi di belakang Caddy
dan perbarui bergantian.

**Kunci SSH untuk deploy** dibatasi hanya untuk menjalankan skrip deploy, bukan akses shell
penuh. Kunci pribadi Anda sendiri tetap terpisah dari kunci yang dipegang GitHub Actions.

**Migrasi basis data harus selalu kompatibel mundur** dalam satu langkah rilis: tambahkan
kolom sebagai nullable dulu, isi datanya, baru jadikan wajib pada rilis berikutnya.

---

## 8. Runbook Insiden

### Aplikasi tidak dapat diakses

```bash
docker compose ps                    # periksa kontainer yang mati
docker compose logs --tail=200 app
docker compose logs --tail=100 caddy
df -h                                # disk penuh adalah penyebab paling umum
docker compose restart app
```

### Disk penuh

Karena foto berada di R2, disk hanya terisi oleh basis data, cadangan lokal, dan citra Docker.

1. `docker system prune -a` untuk membersihkan citra lama — biasanya ini saja sudah cukup.
2. Hapus berkas cadangan lokal yang sudah tersalin ke penyimpanan luar.
3. Periksa pertumbuhan basis data per organisasi; pertumbuhan tak wajar biasanya berarti
   ada yang salah, bukan sekadar pemakaian normal.
4. Bila basis data benar-benar melampaui disk, saatnya menaikkan ukuran VPS — bukan
   memindahkan data, karena yang tersisa di sini memang tidak dapat dipindahkan.

### Basis data tidak mau hidup

```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U simaset
# bila data rusak, pulihkan dari cadangan:
gunzip -c /backups/db-YYYYMMDD-HHMM.sql.gz | docker compose exec -T postgres psql -U simaset simaset
```

### Status aset tidak sesuai dengan peminjaman

Jalankan pemeriksa konsistensi:

```sql
-- Aset ON_LOAN tanpa peminjaman aktif
SELECT a.id, a.asset_code FROM assets a
WHERE a.status = 'ON_LOAN'
  AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.asset_id = a.id AND l.returned_at IS NULL);

-- Peminjaman aktif tetapi aset tidak ON_LOAN
SELECT l.id, a.asset_code, a.status FROM loans l
JOIN assets a ON a.id = l.asset_id
WHERE l.returned_at IS NULL AND a.status <> 'ON_LOAN';
```

Perbaikan dilakukan melalui layanan aplikasi agar tetap meninggalkan jejak riwayat,
**bukan** dengan UPDATE langsung ke basis data.

### Foto tidak dapat dibuka

1. Periksa status Cloudflare R2 dan kebenaran kredensial di `.env`.
2. Pastikan `S3_PUBLIC_ENDPOINT` menunjuk domain publik bucket R2.
3. Periksa jam sistem — URL bertanda tangan gagal bila jam server menyimpang jauh.
4. Di lokal, periksa kontainer MinIO: `docker compose -f docker-compose.dev.yml ps`.

---

## 9. Daftar Periksa Sebelum Go-Live

- [ ] Domain produksi final dan DNS mengarah ke VPS
- [ ] HTTPS aktif dan halaman publik terbuka dari ponsel di jaringan RS
- [ ] Rahasia dibangkitkan ulang, tidak ada nilai contoh yang tersisa
- [ ] Cadangan pertama berhasil dan salinannya terverifikasi ada di penyimpanan luar
- [ ] Pemulihan cadangan sudah diuji satu kali di lingkungan terpisah
- [ ] SMTP terverifikasi; email undangan dan ringkasan harian benar-benar terkirim
- [ ] Akun Super Admin pertama dibuat dan akun contoh dihapus
- [ ] Master data lokasi dan kategori terisi
- [ ] Pemantauan aktif dan mengirim peringatan ke alamat yang benar
- [ ] Zona waktu server disetel `Asia/Jakarta`
- [ ] Pemindaian QR diuji pada ponsel Android dan iOS sungguhan, di dalam gedung RS
- [ ] Bucket R2 dipastikan **tidak** dapat diakses anonim
- [ ] Porta PostgreSQL dipastikan tidak terekspos ke internet
- [ ] Row Level Security aktif dan diuji: pengguna organisasi A tidak dapat membaca data organisasi B
- [ ] Koneksi operator yang melewati RLS memakai kredensial terpisah dari koneksi aplikasi
- [ ] Kuota bawaan terisi pada setiap organisasi yang dibuat
