import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import type { PrismaClient as PrismaClientType } from "../../generated/prisma/client"
import { PrismaClient } from "../../generated/prisma/client"

const globalForPlatform = globalThis as unknown as { dbPlatform?: PrismaClientType }

function platformConnectionString(): string {
  const url = process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL_PLATFORM belum disetel.")
  return url
}

/**
 * Koneksi khusus panel operator — memakai role `simaset_platform` (BYPASSRLS)
 * sehingga melewati Row Level Security. Dok/04 bab 3: berkas ini hanya boleh
 * diimpor oleh kode di bawah `app/(platform)/`, dengan satu pengecualian:
 * `server/services/credentials.service.ts`. Login mencari pengguna
 * berdasarkan email sebelum organisasi mana pun diketahui — `app.current_org`
 * belum bisa disetel karena itulah yang justru sedang dicari, sehingga `db`
 * (terikat RLS) selalu mengembalikan nol baris pada langkah ini. Ditegakkan
 * lewat `linter.rules.style.noRestrictedImports` di biome.json.
 */
export const dbPlatform =
  globalForPlatform.dbPlatform ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: platformConnectionString() }),
  })

if (process.env.NODE_ENV !== "production") globalForPlatform.dbPlatform = dbPlatform
