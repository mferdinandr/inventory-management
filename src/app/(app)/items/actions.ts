"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { t } from "@/lib/strings";
import { assertAction } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { archiveItem, registerItem, restoreItem, updateItem } from "@/server/services/item.service";

export type ItemFormState = { error?: string; ok?: string } | undefined;

/** A text field as the service expects it; absent stays undefined (= unchanged on update). */
const text = (form: FormData, key: string) => (form.has(key) ? String(form.get(key)) : undefined);

/** A whole number; blank means "not given" (the default on create, unchanged on update). */
function whole(form: FormData, key: string): number | undefined {
  const v = text(form, key)?.trim();
  return v ? Number(v) : undefined;
}

/** Form fields shared by registering and editing; the service validates every value. */
function itemFields(form: FormData) {
  const sterilization = text(form, "needsSterilization");
  const price = text(form, "purchasePrice")?.trim();
  return {
    name: text(form, "name"),
    needsSterilization: sterilization === undefined ? undefined : sterilization === "true",
    room: text(form, "room"),
    description: text(form, "description"),
    quantity: whole(form, "quantity"),
    damagedQuantity: whole(form, "damagedQuantity"),
    brand: text(form, "brand"),
    model: text(form, "model"),
    serialNumber: text(form, "serialNumber"),
    purchaseDate: text(form, "purchaseDate"),
    purchasePrice: price === undefined ? undefined : price === "" ? null : Number(price),
    supplier: text(form, "supplier"),
    fundingSource: text(form, "fundingSource"),
    warrantyUntil: text(form, "warrantyUntil"),
  };
}

/** The contents editor posts its rows as one JSON field. */
function contentsField(form: FormData): unknown[] | undefined {
  const raw = text(form, "contents");
  if (raw === undefined) return undefined;
  try {
    const rows = JSON.parse(raw);
    if (Array.isArray(rows)) return rows;
  } catch {}
  throw new AppError("VALIDATION_ERROR", t.error);
}

export async function createItemAction(
  _prev: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  let code: string;
  try {
    const actor = await assertAction("item.create");
    const { item } = await registerItem(actor, {
      ...itemFields(form),
      contents: contentsField(form),
    } as never);
    code = item.code;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/items");
  redirect(`/items/${code}`);
}

export async function updateItemAction(
  _prev: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  let code: string;
  try {
    // Role is only coarse-checked here; the service decides per changed part and location.
    const actor = await assertAction("item.editContents");
    const { item } = await updateItem(actor, text(form, "id") ?? "", {
      ...itemFields(form),
      version: Number(text(form, "version")),
      contents: contentsField(form),
      note: text(form, "note"),
    } as never);
    code = item.code;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath("/items");
  redirect(`/items/${code}`);
}

/** Archive or restore, chosen by `intent`; the detail page re-renders with the new state. */
export async function archiveItemAction(
  _prev: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  try {
    const actor = await assertAction("item.archive");
    const id = text(form, "id") ?? "";
    const restoring = text(form, "intent") === "restore";
    const item = await (restoring ? restoreItem : archiveItem)(actor, id);
    revalidatePath("/items");
    revalidatePath(`/items/${item.code}`);
    return { ok: restoring ? t.items.detail.restored : t.items.detail.archived };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
