"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { safeNext } from "@/lib/safe-next";
import { signIn } from "@/server/auth/config";
import { isLoginBlocked, loginKey } from "@/server/auth/login-limiter";

export type LoginState = { error: "failed" | "blocked" } | { ok: true; next: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "")) ?? "/";

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isLoginBlocked(loginKey(username, ip))) return { error: "blocked" };

  try {
    const url = await signIn("credentials", {
      username: String(form.get("username") ?? ""),
      password,
      redirectTo: next,
      redirect: false,
    });
    return { ok: true, next: typeof url === "string" && url.startsWith("/") ? url : next };
  } catch (e) {
    if (e instanceof AuthError) return { error: "failed" };
    throw e;
  }
}
