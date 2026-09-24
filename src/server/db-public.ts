import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import type { PrismaClient as PrismaClientType } from "../../generated/prisma/client"
import { PrismaClient } from "../../generated/prisma/client"

const globalForPublic = globalThis as unknown as { dbPublic?: PrismaClientType }

/**
 * Koneksi halaman publik (/a/{publicId}) — role `simaset_public` yang izinnya
 * terbatapada kolom aman (lihat migrasi: GRANT SELECT ...). Kolom sensitif
 * tidak pernah keluar dari basis data.
.Ini HANYA untuk kueri baca.
.
 */
export const dbPublic =
  globalForPublic.dbPublic ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL_PUBLIC ?? process.env.DATABASE_URL,
    }),
  })

if (process.env.NODE_ENV !== "production") globalForPublic.dbPublic = dbPublic
