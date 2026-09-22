#!/bin/sh
# Cadangan harian — dijalankan kontainer backup (crond).
# Docs: 09-deployment-ops.md bab 5.
set -eu

STAMP=$(date +%Y%m%d-%H%M)

# Basis data
pg_dump -h postgres -U simaset simaset | gzip > "/backups/db-$STAMP.sql.gz"

# Foto tidak perlu dicadangkan di sini: R2 sudah tereplikasi oleh Cloudflare.
# Yang tidak tergantikan adalah basis data — di situlah kunci objek tersimpan。



# Kirim ke penyimpanan luar server
rclone sync /backups remote:simaset-backup --transfers 4

# Simpan 30 hari terakhir secara lokal
find /backups -name 'db-*.sql.gz' -mtime +30 -delete