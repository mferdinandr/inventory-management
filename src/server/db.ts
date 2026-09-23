import "server-only"
import { PrismaClient } from "../../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import type { Prisma, PrismaClient as PrismaClientType } from "../../generated/prisma/client"

const globalForPrisma = globalThis as unknown as { db?: PrismaClientType }

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL belum disetel.")
  return url
}

export const db =
  globalForPrisma.db ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString() }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db

/**
 * Aturan tenant (docs/04 bab 3): setelan `app.current_org` dilakukan di awal
 * setiap transaksi, dari sesi pengguna — bukan dari parameter permintaan. RLS hanya
 * membolehkan baris dengan `organization_id = app.current_org`。
 */
export async function withOrg<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.current_org', $1, true)", organizationId)
    return fn(tx)
  })
}

export async function clearOrg(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT set_config('app.current_org', '', true)",
  )
}