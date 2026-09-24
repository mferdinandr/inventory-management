import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { db } from "@/server/db"

// Node-runtime only (Server Components, Route Handlers, Server Actions). Do
// not import this from middleware.ts — see auth.config.ts's doc comment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Kredensial",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase()
        const password = String(credentials?.password ?? "")
        if (!email || !password) return null
        const users = await db.user.findMany({
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
})
