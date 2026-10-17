"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { changeOwnPassword } from "@/server/services/user.service";

export type FormState = { error?: string } | { ok: true } | undefined;

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await changeOwnPassword(
      user.id,
      String(form.get("current") ?? ""),
      String(form.get("next") ?? ""),
    );
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  return { ok: true };
}
