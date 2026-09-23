import "server-only"
import { auth } from "../auth"

export type SessionUser = {
  id: string
  organizationId: string | null
  role: "PLATFORM_OWNER" | "SUPERADMIN" | "ADMIN" | "PIC_ROOM" | "TECHNICIAN" | "VIEWER"
  name: string
  email: string
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Sesi berakhir. Silakan masuk kembali.")
  }
  return session.user as SessionUser
}

/**
 * Organisasi aktif dari sesi. PLATFORM_OWNER tidak punya organisasi sendiri —
 * ia menentukannya saat "masuk sebagai" organisasi (lihat panel operator).
 */
export async function requireActiveOrg(): Promise<string> {
  const user = await requireUser()
  if (!user.organizationId) {
    throw new Error("Sesi ini belum terikat ke satu organisasi.")
  }
  return user.organizationId
}