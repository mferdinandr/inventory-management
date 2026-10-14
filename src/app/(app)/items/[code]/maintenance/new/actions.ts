"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAction } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { createMaintenance } from "@/server/services/maintenance.service";

/** Echoed back on error so the form keeps what the person typed. */
export type MaintenanceFormState = { error?: string; values?: Record<string, string> } | undefined;

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Empty number fields become undefined so the validator can say which one is missing. */
const num = (form: FormData, key: string) => {
  const raw = text(form, key).trim();
  return raw === "" ? undefined : Number(raw);
};

export async function saveMaintenance(
  code: string,
  _prev: MaintenanceFormState,
  form: FormData,
): Promise<MaintenanceFormState> {
  const values = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]),
  );
  try {
    const user = await assertAction("maintenance.create");
    const type = text(form, "type");
    const common = {
      actorName: text(form, "actorName"),
      performedOn: text(form, "performedOn"),
      performer: text(form, "performer"),
      cost: num(form, "cost"),
      note: text(form, "note"),
      damagedAfter: num(form, "damagedAfter"),
    };

    const input =
      type === "PERBAIKAN"
        ? {
            ...common,
            type,
            details: {
              complaint: text(form, "complaint"),
              action: text(form, "action"),
              parts: text(form, "parts"),
              finishedOn: text(form, "finishedOn"),
            },
          }
        : type === "PEMELIHARAAN"
          ? {
              ...common,
              type,
              nextDue: text(form, "nextDue"),
              details: { activities: text(form, "activities"), findings: text(form, "findings") },
            }
          : {
              ...common,
              type,
              details: {
                institution: text(form, "institution"),
                certificateNo: text(form, "certificateNo"),
                result: text(form, "result"),
                validUntil: text(form, "validUntil"),
              },
            };

    await createMaintenance(user, code, input as never);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, values };
    throw e;
  }
  revalidatePath(`/items/${code}`);
  revalidatePath(`/items/${code}/maintenance`);
  redirect(`/items/${encodeURIComponent(code)}/maintenance`);
}
