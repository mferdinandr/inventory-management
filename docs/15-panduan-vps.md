# 15 — Panduan Menyiapkan VPS

Langkah dari server kosong sampai SIMASET berjalan di HTTPS dan ter-deploy otomatis dari
`main`. Ringkasan arsitektur ada di [09](09-deployment-ops.md).

## 1. Yang disiapkan

- VPS Ubuntu 24.04 (1 vCPU, 2 GB RAM, 20 GB disk cukup), dengan IP publik tetap.
- **Domain** dan akses ke pengaturan DNS-nya. Domain tertulis di QR, jadi putuskan sebelum cetak label.
- Port 80 dan 443 terbuka ke internet (Caddy memakai keduanya untuk sertifikat HTTPS).

## 2. DNS

Buat rekaman **A** `simaset.contoh.sch.id` → IP VPS. Tunggu sampai `dig +short <domain>`
mengembalikan IP itu sebelum menyalakan Caddy.

## 3. Server

```sh
# sebagai root, sekali saja
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
mkdir -p /opt/simaset && chown deploy:deploy /opt/simaset
```

Matikan login kata sandi SSH (`PasswordAuthentication no` di `/etc/ssh/sshd_config`) setelah
kunci SSH berfungsi.

## 4. Kunci deploy

Di laptop, buat kunci khusus deploy (tanpa passphrase karena dipakai GitHub Actions):

```sh
ssh-keygen -t ed25519 -f simaset-deploy -C "simaset-deploy" -N ""
ssh-copy-id -i simaset-deploy.pub deploy@<IP-VPS>
ssh-keyscan -t ed25519 <IP-VPS>      # simpan keluarannya untuk DEPLOY_KNOWN_HOSTS
```

Jangan commit `simaset-deploy`; hapus dari laptop setelah dimasukkan ke GitHub.

## 5. Pertama kali di server

```sh
# sebagai deploy
cd /opt/simaset
git clone https://github.com/mferdinandr/inventory-management.git .
cp .env.example .env
```

Isi `.env`:

| Variabel | Nilai |
|---|---|
| `APP_URL` | `https://<domain>` |
| `DOMAIN` | `<domain>` |
| `DB_PASSWORD` | `openssl rand -base64 24` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL` | dapat diabaikan; compose menyusunnya dari `DB_PASSWORD` |

```sh
docker compose up -d --build
docker compose exec app node_modules/.bin/prisma migrate deploy
docker compose exec app pnpm user:create     # SUPERADMIN pertama
curl -s https://<domain>/api/health          # {"ok":true}
```

## 6. Deploy otomatis

Di GitHub: **Settings → Secrets and variables → Actions**.

| Jenis | Nama | Isi |
|---|---|---|
| Secret | `DEPLOY_HOST` | IP atau domain VPS |
| Secret | `DEPLOY_USER` | `deploy` |
| Secret | `DEPLOY_SSH_KEY` | isi `simaset-deploy` (kunci privat) |
| Secret | `DEPLOY_KNOWN_HOSTS` | keluaran `ssh-keyscan` |
| Secret | `DEPLOY_PATH` | `/opt/simaset` (boleh kosong) |
| Variable | `DEPLOY_URL` | `https://<domain>` (untuk cek kesehatan setelah deploy) |

Selama secret belum diisi, workflow **Deploy** melewati langkahnya dan tetap hijau. Setelah
diisi, setiap push ke `main` yang lolos CI menjalankan `scripts/deploy.sh` di server:
cadangan, `git reset --hard origin/main`, build image, `prisma migrate deploy`, restart.
Bisa juga dijalankan manual lewat **Actions → Deploy → Run workflow**.

## 7. Cadangan dan pemantauan

- Pasang cron cadangan harian dan salinan ke luar server ([09 §5](09-deployment-ops.md)); jalankan `scripts/restore-check.sh` sekali sebelum data sungguhan masuk.
- Daftarkan `https://<domain>/api/health` ke uptime-checker gratis (mis. UptimeRobot).
- Cek disk berkala: `df -h /` dan `docker system df`.

## 8. Pemulihan cepat bila deploy gagal

```sh
cd /opt/simaset
git log --oneline -5                    # cari commit yang baik
git reset --hard <sha> && docker compose up -d --build
```

Migrasi harus kompatibel mundur satu versi, jadi kembali ke commit sebelumnya aman. Untuk
mengembalikan data, pakai cadangan ([09 §5](09-deployment-ops.md)).
