"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/server/auth/config";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "failed" };
    throw e; // the redirect after a successful sign-in is thrown by Next.js
  }
}
