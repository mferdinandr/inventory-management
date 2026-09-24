import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { verifyCredentials } from "@/server/services/credentials.service"
import { redeemTicket } from "@/server/services/operator.service"

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
      authorize: async (credentials) =>
        verifyCredentials(String(credentials?.email ?? ""), String(credentials?.password ?? "")),
    }),
    // Panel operator: "masuk sebagai" organisasi dan kembali ke panel. Hanya
    // menerima tiket berumur pendek yang diterbitkan operator.service.ts
    // setelah baris audit `platform.impersonate` tertulis.
    Credentials({
      id: "platform-session",
      name: "Sesi platform",
      credentials: { actorUserId: {}, organizationId: {}, exp: {}, sig: {} },
      authorize: async (credentials) => redeemTicket(credentials ?? {}),
    }),
  ],
})
