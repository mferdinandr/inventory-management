# 09 — Deployment & Operasional

## 1. Kebutuhan server

Aplikasi kecil: 1 vCPU, 2 GB RAM, 20 GB disk sudah lebih dari cukup (tanpa foto, hanya
teks). VPS yang sudah diputuskan sebelumnya tetap bisa dipakai; server di RS juga bisa,
asalkan HTTPS tersedia.

HTTPS **wajib** di produksi — kamera peramban tidak berjalan di HTTP. Di lokal,
`localhost` dikecualikan.

## 2. Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    image: simaset-app:latest
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: simaset
      POSTGRES_USER: simaset
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U simaset"]
      interval: 10s
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [app]
    restart: unless-stopped

volumes:
  pgdata:
  caddy_data:
```

```
# Caddyfile
{$DOMAIN} {
  encode zstd gzip
  reverse_proxy app:3000
}
```

## 3. Variabel lingkungan

| Variabel | Isi |
|---|---|
| `APP_URL` | `https://{DOMAIN}` — dipakai di QR |
| `DATABASE_URL` | Koneksi ke `db` |
| `DB_PASSWORD` | Kata sandi basis data |
| `AUTH_SECRET` | Acak, ≥ 32 byte |
| `DOMAIN` | Untuk Caddy |

Tidak ada kunci penyimpanan objek, SMTP, atau tenant.

## 4. Penyiapan awal

```bash
git clone … && cd simaset
cp .env.example .env            # isi nilai
docker compose up -d
docker compose exec app pnpm prisma migrate deploy
docker compose exec app pnpm user:create   # buat SUPERADMIN pertama
# lalu login dan buat akun OPERASI, STERIL, ALKES dari halaman Pengguna
<<<<<<< HEAD
# data awal (sekali): docker compose exec app pnpm import:csv --items items.csv --contents contents.csv
```

Setelah migrasi: cabut `UPDATE`/`DELETE` pada `item_logs` untuk peran basis data aplikasi
(termasuk di skrip migrasi agar ikut otomatis).

## 5. Cadangan

Harian, lewat cron di host:

```sh
docker compose exec -T db pg_dump -U simaset simaset | gzip > /backups/simaset-$(date +%F).sql.gz
# salin ke luar server (rclone/scp); simpan 30 hari
```

Uji pemulihan ke basis data kosong **sebelum** data sungguhan masuk, dan ulangi tiap
beberapa bulan.
=======
# data awal (sekali): lihat [14 — Impor CSV](14-impor-csv.md); selalu mulai dengan --dry-run
```

Aturan append-only (trigger) dan constraint CHECK sudah bagian dari migrasi, tidak ada langkah
tambahan.

## 5. Cadangan

Harian, lewat cron di host (jalankan dari folder proyek):

```sh
# crontab -e   (setiap hari 02:00)
0 2 * * * cd /opt/simaset && RCLONE_REMOTE=gdrive:simaset-backups scripts/backup.sh >> backups/backup.log 2>&1
```

`scripts/backup.sh` menjalankan `pg_dump` lewat `docker compose exec -T db`, menulis
`./backups/simaset-YYYY-MM-DD.sql.gz` (berkas `./backups/` tidak masuk git), menghapus dump
yang lebih tua dari 30 hari, dan, bila `RCLONE_REMOTE` diisi, menyalinnya ke luar server.
Tanpa `RCLONE_REMOTE` cadangan hanya ada di server yang sama: **atur salinan ke luar server**
sebelum go-live.

| Variabel | Bawaan | Fungsi |
|---|---|---|
| `COMPOSE_FILE` | `docker-compose.yml` | Berkas compose; `docker-compose.dev.yml` untuk basis data dev |
| `DB_SERVICE` / `DB_USER` / `DB_NAME` | `db` / `simaset` / `simaset` | Layanan, pengguna, dan nama basis data |
| `BACKUP_DIR` | `./backups` | Folder hasil |
| `KEEP_DAYS` | `30` | Lama simpan |
| `RCLONE_REMOTE` | kosong | Tujuan `rclone copy`, mis. `gdrive:simaset-backups` |

**Uji pemulihan** (sebelum data sungguhan masuk, lalu tiap beberapa bulan):

```sh
scripts/restore-check.sh              # dump terbaru di ./backups
scripts/restore-check.sh path/ke/simaset-2026-10-15.sql.gz
```

Skrip memulihkan dump ke basis data sementara, memeriksa tabel `users`, `items`,
`item_contents`, `item_logs`, `maintenance_records` serta trigger append-only, mencetak
jumlah barisnya, lalu menghapus basis data sementara. Kode keluar bukan 0 bila ada yang gagal,
jadi aman dipasang di cron mingguan. Di mesin dev:
`COMPOSE_FILE=docker-compose.dev.yml DB_NAME=simaset_<branch> scripts/backup.sh`.

**Memulihkan sungguhan** (mis. membatalkan impor yang salah, [14](14-impor-csv.md)): hentikan
aplikasi (`docker compose stop app`), `DROP DATABASE simaset; CREATE DATABASE simaset;`, lalu
`gunzip -c backups/simaset-….sql.gz | docker compose exec -T db psql -U simaset simaset`, dan
nyalakan lagi aplikasinya.
>>>>>>> origin/main

## 6. Pemantauan

- Titik cek `GET /api/health` (memeriksa koneksi DB), dipantau uptime-checker gratis.
- Peringatan bila disk > 80%.
- Log aplikasi lewat `docker compose logs`.

## 7. Pembaruan

<<<<<<< HEAD
Push ke `main` → GitHub Actions: lint, tes, build image, SSH ke server, `docker compose pull
&& up -d`, `prisma migrate deploy`. Migrasi harus kompatibel mundur satu versi.
=======
Push ke `main` → CI (lint, tipe, tes, build) → bila lulus, workflow **Deploy** masuk ke server
lewat SSH dan menjalankan `scripts/deploy.sh`: cadangan, tarik `main`, build image di server,
`prisma migrate deploy`, `docker compose up -d`, lalu cek `/api/health`. Tanpa registry image.
Langkah penyiapan dan secret ada di [15 — Panduan VPS](15-panduan-vps.md). Migrasi harus
kompatibel mundur satu versi.
>>>>>>> origin/main

## 8. Daftar periksa go-live

- [ ] HTTPS aktif, kamera memindai di ponsel sungguhan
- [ ] SUPERADMIN dibuat, 3 akun lain dibuat lewat UI, kata sandi awal sudah diganti
<<<<<<< HEAD
- [ ] Hak `UPDATE/DELETE` pada `item_logs` dicabut (diuji)
- [ ] Cadangan berjalan **dan** pemulihan teruji
- [ ] Satu label lolos satu siklus sterilisasi dan masih terbaca
- [ ] Alur set (Operasi → CSSD → Operasi), pengeditan alat besar oleh Operasi, tampilan Alkes, dan satu catatan maintenance dicoba oleh petugas sungguhan
- [ ] Impor data awal diuji pada salinan basis data dan hasilnya dicocokkan dengan daftar sumber
=======
- [ ] Trigger append-only pada `item_logs` dan `maintenance_records` aktif (uji: UPDATE/DELETE ditolak)
- [ ] Cadangan berjalan **dan** pemulihan teruji
- [ ] Satu label lolos satu siklus sterilisasi dan masih terbaca
- [ ] Alur set (Operasi → CSSD → Operasi), pengeditan alat besar oleh Operasi, tampilan Alkes, dan satu catatan maintenance dicoba oleh petugas sungguhan
- [ ] Impor data awal ([14](14-impor-csv.md)) diuji pada salinan basis data dan hasilnya dicocokkan dengan daftar sumber
>>>>>>> origin/main
