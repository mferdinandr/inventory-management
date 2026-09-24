import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe half of the Auth.js config — session/pages/callbacks only, no
 * providers. middleware.ts (Edge Runtime by default) builds its own NextAuth
 * instance from just this file, so it never pulls in @/server/db (Prisma +
 * the "pg" driver use Node built-ins like node:os/node:path that the Edge
 * Runtime can't bundle). The Credentials provider — and the database access
 * it needs — lives in auth.ts, which only Node-runtime code (Server
 * Components, Route Handlers, Server Actions) imports.
 *
 * See https://authjs.dev/guides/edge-compatibility.
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: Number(process.env.SESSION_MAX_AGE_HOURS ?? 12) * 60 * 60,
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
        token.impersonating = (user as { impersonating?: boolean }).impersonating === true
      }
      return token
    },
    session({ session, token }) {
      session.user.id = (token.id as string) ?? ""
      session.user.role = token.role as
        | "PLATFORM_OWNER"
        | "SUPERADMIN"
        | "ADMIN"
        | "PIC_ROOM"
        | "TECHNICIAN"
        | "VIEWER"
      session.user.organizationId = (token.organizationId as string | null) ?? null
      session.user.status = token.status as "ACTIVE" | "INVITED" | "DISABLED"
      session.user.impersonating = token.impersonating === true
      session.user.name = session.user.name ?? (token.name as string)
      return session
    },
  },
  providers: [],
}
