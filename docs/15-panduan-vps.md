# 15 — Panduan Vercel + VPS

Langkah dari nol sampai aplikasi berjalan: **aplikasi Next.js di Vercel, PostgreSQL di VPS**.
Arsitektur dan alasannya ada di [09](09-deployment-ops.md). Ganti `contoh.sch.id` dengan domain Anda.

## 1. Yang disiapkan

- VPS Ubuntu 24.04 (1 vCPU, 1–2 GB RAM, 20 GB disk), IP publik tetap, lokasi dekat Indonesia.
- **Domain** dan akses DNS-nya. Domain aplikasi tertulis di QR, jadi putuskan sebelum cetak label.
- Akun Vercel dan akses ke repo GitHub. Paket Hobby hanya untuk non-komersial.

Dua nama yang dipakai:

| Nama | Menuju | Untuk |
|---|---|---|
| `simaset.contoh.sch.id` | Vercel | aplikasi (dan isi QR) |
| `db.contoh.sch.id` | IP VPS | database + sertifikat TLS |

## 2. DNS database

Rekaman **A** `db.contoh.sch.id` → IP VPS. Tunggu sampai `dig +short db.contoh.sch.id`
mengembalikan IP itu. (Rekaman untuk `simaset.` dibuat di langkah 6 sesuai petunjuk Vercel.)

## 3. VPS

```sh
# sebagai root, sekali saja
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
apt -y install certbot rclone
adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 5432 && ufw --force enable
mkdir -p /opt/simaset && chown deploy:deploy /opt/simaset
```

Port 80 hanya dipakai certbot untuk memperbarui sertifikat. Setelah kunci SSH berfungsi,
matikan login kata sandi (`PasswordAuthentication no` di `/etc/ssh/sshd_config`).

## 4. Sertifikat TLS database

```sh
# sebagai deploy
cd /opt/simaset
git clone https://github.com/mferdinandr/inventory-management.git .

# sebagai root
certbot certonly --standalone -d db.contoh.sch.id \
  --deploy-hook /opt/simaset/scripts/pg-cert-hook.sh
```

Hook menyalin sertifikat ke `/opt/simaset/certs`, memberi PostgreSQL (uid 999) hak atas
kuncinya, lalu memuat ulang database. Hook yang sama berjalan otomatis tiap pembaruan.
Uji dengan `certbot renew --dry-run`.

## 5. Menyalakan database

```sh
# sebagai deploy, di /opt/simaset
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')" > .env
docker compose up -d
docker compose ps        # tunggu status healthy
```

Catat nilai `DB_PASSWORD` (`cat .env`) untuk Vercel. Uji dari laptop:

```sh
# TLS harus diterima:
psql "postgresql://simaset:<DB_PASSWORD>@db.contoh.sch.id:5432/simaset?sslmode=require" -c "select 1"
# tanpa TLS harus ditolak ("no encryption"):
psql "postgresql://simaset:<DB_PASSWORD>@db.contoh.sch.id:5432/simaset?sslmode=disable" -c "select 1"
```

## 6. Vercel

1. **Add New → Project**, impor repo `mferdinandr/inventory-management`. Framework terdeteksi
   Next.js; build mengikuti `vercel.json` (region `sin1`, `scripts/vercel-build.sh`).
2. **Settings → Environment Variables**, hanya lingkungan **Production**
   ([09 §3](09-deployment-ops.md)):

   | Variabel | Isi |
   |---|---|
   | `DATABASE_URL` | `postgresql://simaset:<DB_PASSWORD>@db.contoh.sch.id:5432/simaset?sslmode=require` |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `APP_URL` | `https://simaset.contoh.sch.id` |
   | `DB_POOL_MAX` | `3` |

   Biarkan Preview dan Development kosong.
3. **Settings → Domains**, tambah `simaset.contoh.sch.id` dan buat rekaman DNS yang diminta Vercel.
4. **Deploy**. Build produksi pertama menjalankan `prisma migrate deploy` lalu `next build`
   (lihat log: "Applying database migrations").
5. Buka `https://simaset.contoh.sch.id/api/health`, harus `{"ok":true}`.

Pesan `SECURITY WARNING: The SSL modes 'prefer', 'require'…` di log hanya peringatan versi;
`require` pada driver `pg` tetap memverifikasi sertifikat.

## 7. Akun pertama dan data awal

Dari laptop (repo sudah ter-clone dan `pnpm install` berjalan), arahkan sementara ke database
produksi untuk satu perintah:

```sh
DATABASE_URL='postgresql://simaset:<DB_PASSWORD>@db.contoh.sch.id:5432/simaset?sslmode=require' \
  pnpm user:create          # SUPERADMIN pertama
```

Login di aplikasi, lalu buat akun OPERASI, STERIL, ALKES dari halaman **Pengguna**. Data awal
lewat [14 — Impor CSV](14-impor-csv.md) dengan cara yang sama (mulai dengan `--dry-run`).

## 8. Cadangan dan pemantauan

```sh
# sebagai deploy: crontab -e
0 2 * * * cd /opt/simaset && RCLONE_REMOTE=gdrive:simaset-backups scripts/backup.sh >> backups/backup.log 2>&1
```

Atur `rclone config` untuk tujuan di luar server, jalankan `scripts/restore-check.sh` sekali
sebelum data sungguhan masuk ([09 §6](09-deployment-ops.md)), dan daftarkan
`https://simaset.contoh.sch.id/api/health` ke uptime-checker gratis.

## 9. Pembaruan dan pemulihan

- Setiap push ke `main` yang lolos CI dibangun Vercel, migrasi diterapkan sebelum versi baru
  aktif. Tidak ada langkah di VPS.
- Kode bermasalah: **Vercel → Deployments → ⋯ → Instant Rollback**. Migrasi kompatibel mundur
  satu versi, jadi rollback satu versi aman. Jangan rollback melewati migrasi yang menghapus
  kolom; pulihkan dari cadangan.
- Ganti kata sandi database: `docker compose exec db psql -U simaset -c "ALTER USER simaset PASSWORD '…'"`,
  ubah `DB_PASSWORD` di `.env` VPS dan `DATABASE_URL` di Vercel, lalu *Redeploy*.
