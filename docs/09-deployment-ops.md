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

## 6. Pemantauan

- Titik cek `GET /api/health` (memeriksa koneksi DB), dipantau uptime-checker gratis.
- Peringatan bila disk > 80%.
- Log aplikasi lewat `docker compose logs`.

## 7. Pembaruan

Push ke `main` → GitHub Actions: lint, tes, build image, SSH ke server, `docker compose pull
&& up -d`, `prisma migrate deploy`. Migrasi harus kompatibel mundur satu versi.

## 8. Daftar periksa go-live

- [ ] HTTPS aktif, kamera memindai di ponsel sungguhan
- [ ] SUPERADMIN dibuat, 3 akun lain dibuat lewat UI, kata sandi awal sudah diganti
- [ ] Hak `UPDATE/DELETE` pada `item_logs` dicabut (diuji)
- [ ] Cadangan berjalan **dan** pemulihan teruji
- [ ] Satu label lolos satu siklus sterilisasi dan masih terbaca
- [ ] Kedua jalur (steril via CSSD, non-steril via Alkes) dan satu catatan maintenance dicoba oleh petugas sungguhan
- [ ] Impor data awal diuji pada salinan basis data dan hasilnya dicocokkan dengan daftar sumber
