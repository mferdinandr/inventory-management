import "server-only"
import { redirect } from "next/navigation"
import { auth } from "../auth"

export type SessionUser = {
  id: string
  organizationId: string | null
  role: "PLATFORM_OWNER" | "SUPERADMIN" | "ADMIN" | "PIC_ROOM" | "TECHNICIAN" | "VIEWER"
  name: string
  email: string
  impersonating: boolean
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

/**
 * Penjaga halaman panel operator. middleware.ts sudah menyaring /operator, tetapi
 * halaman di sana membaca data lintas organisasi (dbPlatform) — setiap halaman
 * memeriksa ulang agar tidak bergantung pada satu lapis saja.
 */
export async function requirePlatformOwner(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== "PLATFORM_OWNER") redirect("/dashboard")
  return user
}
