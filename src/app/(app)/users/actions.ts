"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/lib/strings";
import { assertAction } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { createUser, resetPassword, updateUser } from "@/server/services/user.service";

export type UsersState = { ok?: string; error?: string } | undefined;

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** One entry point for every form on the Users page; `intent` selects the operation. */
export async function userAction(_prev: UsersState, form: FormData): Promise<UsersState> {
  try {
    const actor = await assertAction("user.manage");
    const intent = text(form, "intent");
    const id = text(form, "id");

    switch (intent) {
      case "create":
        await createUser({
          username: text(form, "username"),
          name: text(form, "name"),
          role: text(form, "role") as never,
          password: text(form, "password"),
        });
        revalidatePath("/users");
        return { ok: t.users.created };

      case "update":
        if (id === actor.id)
          throw new AppError("FORBIDDEN", "Anda tidak dapat mengubah akun sendiri");
        await updateUser(
          id,
          {
            role: text(form, "role") as never,
            isActive: text(form, "active") === "active",
          },
          actor.id,
        );
        if (text(form, "password")) await resetPassword(id, text(form, "password"), actor.id);
        break;

      default:
        throw new AppError("VALIDATION_ERROR", t.error);
    }
    revalidatePath("/users");
    return { ok: t.users.updated };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
