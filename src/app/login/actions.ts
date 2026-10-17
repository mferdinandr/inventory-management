"use server";

import { AuthError } from "next-auth";
import { safeNext } from "@/lib/safe-next";
import { signIn } from "@/server/auth/config";

export type LoginState = { error?: string; ok?: boolean; to?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const to = safeNext(String(form.get("next") ?? "")) ?? "/";
  try {
    // No server redirect: the client shows a success toast first, then navigates.
    await signIn("credentials", {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "failed" };
    throw e;
  }
  return { ok: true, to };
}
