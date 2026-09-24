import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { storageHealth } from "@/server/storage"

export const dynamic = "force-dynamic"

const VERSION = process.env.npm_package_version ?? "0.1.0"

export async function GET() {
  let dbStatus = "ok"
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    dbStatus = "error"
  }

  const storage = await storageHealth()

  const ok = dbStatus === "ok" && storage

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      db: dbStatus,
      storage: storage ? "ok" : "error",
      version: VERSION,
    },
    { status: ok ? 200 : 503 },
  )
}
