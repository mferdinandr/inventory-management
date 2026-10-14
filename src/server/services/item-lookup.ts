import { db } from "@/server/db";

/** Read-only lookup for QR and labels; item writes belong to item.service. */
export async function findItemByCode(code: string) {
  return db.item.findUnique({
    where: { code },
    select: { code: true, name: true, needsSterilization: true, isArchived: true },
  });
}
