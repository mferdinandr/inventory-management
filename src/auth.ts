import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { verifyCredentials } from "@/server/services/credentials.service"

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
  ],
})
