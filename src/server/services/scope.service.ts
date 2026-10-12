import "server-only"
import { subtreePrefix } from "@/lib/location"
import type { Prisma } from "../../../generated/prisma/client"
import type { UserRole } from "../../../generated/prisma/enums"

type Tx = Prisma.TransactionClient

/**
 * FR-26: "Pengguna PIC_ROOM hanya melihat cakupan ruangannya." Cakupan
 * seorang pengguna adalah gabungan ruangan di bawah setiap lokasi yang
 * ditugaskan padanya (user_locations) — termasuk ruangan itu sendiri bila
 * ditugaskan langsung ke satu ruangan, atau seluruh ruangan di bawah
 * instalasi/lantai/gedung bila ditugaskan di tingkat yang lebih tinggi.
 *
 * Mengembalikan `null` untuk peran selain PIC_ROOM, yang berarti "tidak
 * dibatasi" — pemanggil harus memperlakukan null sebagai tanpa filter
 * ruangan, dan array (termasuk array kosong) sebagai daftar id ruangan yang
 * diizinkan secara eksplisit.
 */
export async function getAccessibleRoomIds(
  tx: Tx,
  organizationId: string,
  userId: string,
  role: UserRole,
): Promise<string[] | null> {
  if (role !== "PIC_ROOM") return null

  const assignments = await tx.userLocation.findMany({
    where: { userId },
    select: { location: { select: { id: true, path: true, type: true, organizationId: true } } },
  })
  const own = assignments
    .filter((a) => a.location.organizationId === organizationId)
    .map((a) => a.location)
  if (own.length === 0) return []

  const roomIdSets = await Promise.all(
    own.map(async (loc) => {
      if (loc.type === "ROOM") return [loc.id]
      const prefix = subtreePrefix(loc.path, loc.id)
      const rooms = await tx.location.findMany({
        where: {
          organizationId,
          type: "ROOM",
          OR: [{ path: prefix }, { path: { startsWith: `${prefix}/` } }],
        },
        select: { id: true },
      })
      return rooms.map((r) => r.id)
    }),
  )

  return Array.from(new Set(roomIdSets.flat()))
}
