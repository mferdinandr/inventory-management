"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAction } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { returnItem, sendItem } from "@/server/services/flow.service";

export type FlowFormState = { error?: string } | undefined;

const text = (form: FormData, key: string) => (form.has(key) ? String(form.get(key)) : "");

export async function sendItemAction(_prev: FlowFormState, form: FormData): Promise<FlowFormState> {
  let code: string;
  try {
    const actor = await assertAction("item.send");
    const item = await sendItem(actor, text(form, "id"), {
      actorName: text(form, "actorName"),
      note: text(form, "note"),
    });
    code = item.code;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/items");
  revalidatePath(`/items/${code}`);
  redirect(`/items/${code}`);
}

export async function returnItemAction(
  _prev: FlowFormState,
  form: FormData,
): Promise<FlowFormState> {
  let code: string;
  try {
    const actor = await assertAction("item.return");
    let contents: unknown[] | undefined;
    try {
      const rows = JSON.parse(text(form, "contents") || "[]");
      if (Array.isArray(rows)) contents = rows;
    } catch {}
    if (!contents) throw new AppError("VALIDATION_ERROR", "Isi barang tidak valid");
    const item = await returnItem(actor, text(form, "id"), {
      version: Number(text(form, "version")),
      actorName: text(form, "actorName"),
      note: text(form, "note"),
      contents,
    } as never);
    code = item.code;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/items");
  revalidatePath(`/items/${code}`);
  redirect(`/items/${code}`);
}
