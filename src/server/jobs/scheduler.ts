import "server-only"
import { PgBoss } from "pg-boss"
import { runHourlyDigestCheck } from "@/server/jobs/daily-digest"

// FR-28 (v1.1): "pg-boss dan seluruh tugas terjadwal." Modul ini hanya boleh
// dipakai dari src/server/jobs/start.ts (proses worker terpisah, lihat
// docs/09-deployment-ops.md) — TIDAK dari route/Server Action Next.js, yang
// berjalan sebagai proses request-response pendek dan tidak cocok menampung
// scheduler pg-boss yang hidup terus-menerus.

const DIGEST_QUEUE = "daily-digest-check"

function connectionString(): string {
  const url = process.env.DATABASE_URL_MIGRATION ?? process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL belum disetel.")
  return url
}

export async function startScheduler(): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: connectionString() })
  boss.on("error", (err: Error) => console.error("[pg-boss]", err))
  await boss.start()

  await boss.createQueue(DIGEST_QUEUE)
  await boss.work(DIGEST_QUEUE, async () => {
    await runHourlyDigestCheck()
  })

  // Jam lokal tiap organisasi diperiksa di dalam runHourlyDigestCheck() itu
  // sendiri (docs FR-28: 07:00 MASING-MASING zona waktu, bukan satu jam UTC
  // tetap) — job ini hanya perlu berjalan setiap jam, genap.
  await boss.schedule(DIGEST_QUEUE, "0 * * * *")

  return boss
}
