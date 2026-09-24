import "server-only"
import bcrypt from "bcryptjs"
import { dbPlatform } from "@/server/db-platform"

export type AuthorizedUser = {
  id: string
  email: string
  name: string
  role: "PLATFORM_OWNER" | "SUPERADMIN" | "ADMIN" | "PIC_ROOM" | "TECHNICIAN" | "VIEWER"
  status: "ACTIVE" | "INVITED" | "DISABLED"
  organizationId: string | null
}

/**
 * Extracted from auth.ts's Credentials authorize() so it's directly testable
 * (see tests/login.test.ts) without going through NextAuth's provider
 * plumbing. Deliberately uses dbPlatform (BYPASSRLS) — see db-platform.ts's
 * doc comment: the organization isn't known yet at this point, so an
 * RLS-bound query would always return zero rows.
 */
export async function verifyCredentials(
  rawEmail: string,
  password: string,
): Promise<AuthorizedUser | null> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !password) return null

  const users = await dbPlatform.user.findMany({
    where: { email, passwordHash: { not: null } },
    take: 2,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      organizationId: true,
      passwordHash: true,
    },
  })
  if (users.length !== 1) return null // email ambigu (lintas organisasi) atau tidak dikenal
  const user = users[0]!
  if (user.status !== "ACTIVE") return null

  const ok = await bcrypt.compare(password, user.passwordHash!)
  if (!ok) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    organizationId: user.organizationId,
  }
}
