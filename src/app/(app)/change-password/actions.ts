"use server";

import { redirect } from "next/navigation";
import { t } from "@/lib/strings";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { changeOwnPassword } from "@/server/services/user.service";

export type FormState = { error?: string } | { ok: true } | undefined;

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next !== confirm) return { error: t.changePassword.notMatch };
  try {
    await changeOwnPassword(user.id, current, next);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  return { ok: true };
}
