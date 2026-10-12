import "dotenv/config"
import { startScheduler } from "@/server/jobs/scheduler"

// Proses worker terpisah dari server Next.js — dijalankan lewat `pnpm worker`
// (lihat package.json) sebagai layanan docker-compose sendiri di produksi
// (docs/09-deployment-ops.md). TIDAK diimpor oleh next build/aplikasi.
startScheduler()
  .then(() => console.log("[worker] pg-boss berjalan, memeriksa ringkasan harian tiap jam."))
  .catch((err) => {
    console.error("[worker] gagal memulai:", err)
    process.exit(1)
  })
