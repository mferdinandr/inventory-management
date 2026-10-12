import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/server/db";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "./login-limiter";
import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: THIRTY_DAYS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const key = `${username}|${ip}`;
        if (isLoginBlocked(key)) return null;

        const user = await db.user.findUnique({ where: { username } });
        const ok = user?.isActive && (await verifyPassword(user.passwordHash, password));
        if (!user || !ok) {
          recordLoginFailure(key);
          return null;
        }
        clearLoginFailures(key);
        return { id: user.id, name: user.name };
      },
    }),
  ],
  callbacks: {
    // The token only carries the user id. Role, active flag and the forced-password-change
    // flag are read from the database on every request (see session.ts), so a demoted or
    // deactivated user loses access immediately instead of when the 30-day token expires.
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
