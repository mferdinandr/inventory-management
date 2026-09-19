# 09 — Deployment dan Operasional

Target: satu VPS milik sendiri, dijalankan dengan Docker Compose.

---

## 1. Spesifikasi Server

| Komponen | Minimal | Anjuran |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 60 GB SSD | 160 GB SSD |
| Sistem operasi | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| Lokasi | Indonesia atau Singapura | Indonesia, untuk latensi terendah |

**Perhitungan kebutuhan disk.** Dengan 2.000 aset, rata-rata 12 entri riwayat per aset per
tahun, rata-rata 1,5 foto per entri, dan sekitar 400 KB per foto setelah kompresi:

```
2.000 × 12 × 1,5 × 400 KB ≈ 14 GB per tahun
```

Basis data itu sendiri di bawah 1 GB. Disk 160 GB memberi ruang sekitar lima tahun sekaligus
menampung salinan cadangan lokal.

---

## 2. Docker Compose

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app, minio]

  app:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      minio:    { condition: service_healthy }
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

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER_FILE: /run/secrets/minio_user
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_password
    volumes:
      - miniodata:/data
    secrets: [minio_user, minio_password]
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 15s
      timeout: 5s
      retries: 5
    expose: ["9000", "9001"]
    # konsol 9001 tidak diekspos ke internet; akses lewat terowongan SSH

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
  miniodata:
  backups:
  caddy_data:
  caddy_config:

secrets:
  pg_password:    { file: ./secrets/pg_password }
  minio_user:     { file: ./secrets/minio_user }
  minio_password: { file: ./secrets/minio_password }
```

## 3. Caddyfile

```caddy
inventaris.rs-contoh.co.id {
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

berkas.rs-contoh.co.id {
    encode gzip
    # Hanya melayani objek; bucket bersifat privat dan diakses lewat URL bertanda tangan
    header Content-Disposition "attachment"
    reverse_proxy minio:9000
}
```

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
openssl rand -base64 32 > secrets/minio_password
echo "simaset-admin" > secrets/minio_user
chmod 600 secrets/*
cp .env.example .env && $EDITOR .env

# 4. Jalankan
docker compose up -d --build

# 5. Siapkan basis data dan bucket
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
docker compose exec minio mc mb local/simaset
docker compose exec minio mc anonymous set none local/simaset   # pastikan privat
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

# Objek penyimpanan
mc mirror --overwrite --remove local/simaset "/backups/objects/"

# Kirim ke penyimpanan luar server
rclone sync /backups remote:simaset-backup --transfers 4

# Simpan 30 hari terakhir secara lokal
find /backups -name 'db-*.sql.gz' -mtime +30 -delete
```

**Aturan yang tidak boleh dilanggar:** salinan cadangan harus berada **di luar VPS**.
Cadangan yang tersimpan di disk yang sama dengan datanya bukanlah cadangan. Gunakan
Cloudflare R2, Backblaze B2, atau penyimpanan objek penyedia VPS sebagai tujuan rclone.

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
| Galat aplikasi | Log Pino, opsional Sentry | Lonjakan tak wajar |
| Konsistensi data | Tugas `consistency-check` harian | Setiap ketidaksesuaian |

Endpoint `/api/health` memeriksa koneksi basis data dan penyimpanan objek, lalu
mengembalikan `{ "status": "ok", "db": "ok", "storage": "ok", "version": "..." }`.

---

## 7. Pembaruan Versi

```bash
cd /opt/simaset
docker compose exec backup /backup.sh          # cadangkan lebih dulu, selalu
git pull
docker compose build app
docker compose exec app npx prisma migrate deploy
docker compose up -d app
curl -sf https://inventaris.rs-contoh.co.id/api/health
```

Waktu henti sekitar 10–20 detik. Pada skala ini hal tersebut dapat diterima; lakukan di luar
jam sibuk. Bila kelak tidak dapat diterima, jalankan dua kontainer aplikasi di belakang Caddy
dan perbarui bergantian.

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

1. `docker system prune -a` untuk membersihkan citra lama.
2. Hapus berkas cadangan lokal yang sudah tersalin ke luar.
3. Jalankan tugas `orphan-cleanup` untuk menghapus objek yatim.
4. Bila tetap penuh, ini saatnya memindahkan penyimpanan objek ke Cloudflare R2 —
   cukup mengubah variabel lingkungan `S3_*` dan menyalin isi bucket.

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

1. Periksa kesehatan MinIO: `docker compose exec minio mc ready local`.
2. Pastikan `S3_PUBLIC_ENDPOINT` cocok dengan domain berkas pada Caddyfile.
3. Periksa jam sistem — URL bertanda tangan gagal bila jam server menyimpang jauh.

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
- [ ] Bucket MinIO dipastikan **tidak** dapat diakses anonim
- [ ] Konsol MinIO dan porta PostgreSQL dipastikan tidak terekspos ke internet
