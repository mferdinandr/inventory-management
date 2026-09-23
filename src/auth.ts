import NextAuth, { type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/server/db"

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: (Number(process.env.SESSION_MAX_AGE_HOURS ?? 12) * 60 * 60), // 12 jamdefault
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.role = (user as { role: string }).role
        token.organizationId = (user as { organizationId: string | null }).organizationId ?? null
        token.status = (user as { status: string }).status
      }
      return token
    },
    session({ session,token }) {
      session.user.id = (token.id as string) ?? ""
      session.user.role = (token.role as "PLATFORM_OWNER" | "SUPERADMIN" | "ADMIN" | "PIC_ROOM" | "TECHNICIAN" | "VIEWER")
      session.user.organizationId = (token.organizationId as string | null) ?? null
      session.user.status = (token.status as "ACTIVE" | "INVITED" | "DISABLED")
      session.user.name = session.user.name ?? (token.name as string)
      return session
    },
  },
  providers: [
    Credentials({
      name: "Kredensial",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")
        if (!email || !password) return null
        const users = await db.user.findMany({
          where: { email, passwordHash: { not: null } },
          take: 2,
          select: { id: true, email: true, name: true, role: true, status: true, organizationId: true, passwordHash: true },
        })
        if (users.length !== 1) return null // email ambigu atau tidak dikenal
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
      },
    }),
  ],
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)