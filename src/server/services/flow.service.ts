import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { can, type Location } from "@/lib/permissions";
import {
  contentRowSchema,
  type ReturnItemInput,
  returnItemSchema,
  type SendItemInput,
  sendItemSchema,
} from "@/lib/validators/flow";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  type Actor,
  applyContentsPlan,
  assertContentsPlanAllowed,
  planContents,
} from "./item.service";

const PLACE: Record<Location, string> = { OPERASI: "Operasi", CSSD: "CSSD" };

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Masukan tidak valid",
    );
  }
  return result.data;
}

type ItemRow = Prisma.ItemGetPayload<object>;

const stateOf = (item: ItemRow) => ({
  location: item.location,
  needsSterilization: item.needsSterilization,
});

/** Why a send/return found nothing to update: the item is not where the action needs it. */
function stateProblem(item: ItemRow, from: Location): AppError | null {
  if (item.isArchived) {
    return new AppError("STATE_CONFLICT", "Barang diarsipkan. Pulihkan dulu sebelum dipindahkan");
  }
  if (item.location !== from) {
    return new AppError(
      "STATE_CONFLICT",
      from === "OPERASI"
        ? `Barang sudah berada di ${PLACE[item.location]}, tidak dapat dikirim ke CSSD`
        : `Barang berada di ${PLACE[item.location]}, bukan di CSSD`,
    );
  }
  return null;
}

/** OPERASI sends a sterilizable item from Operasi to CSSD (docs/02 F4). */
export async function sendItem(actor: Actor, itemId: string, input: SendItemInput) {
  const data = parse(sendItemSchema, input);

  return db.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError("NOT_FOUND", "Barang tidak ditemukan");
    if (!can(actor.role, "item.send", stateOf(item))) {
      throw new AppError("FORBIDDEN", "Peran Anda tidak berwenang mengirim barang ke CSSD");
    }
    if (!item.needsSterilization) {
      throw new AppError("STATE_CONFLICT", "Barang ini tidak perlu sterilisasi");
    }
    const problem = stateProblem(item, "OPERASI");
    if (problem) throw problem;

    // The condition lives in the UPDATE, so of two concurrent sends only one matches.
    const moved = await tx.item.updateMany({
      where: { id: itemId, location: "OPERASI", needsSterilization: true, isArchived: false },
      data: { location: "CSSD", locationSince: new Date(), version: { increment: 1 } },
    });
    if (moved.count === 0) {
      const now = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
      throw (
        stateProblem(now, "OPERASI") ?? new AppError("STATE_CONFLICT", "Barang tidak dapat dikirim")
      );
    }

    await tx.itemLog.create({
      data: {
        itemId,
        action: "SEND",
        userId: actor.id,
        actorName: data.actorName,
        note: data.note ?? null,
      },
    });
    return tx.item.findUniqueOrThrow({ where: { id: itemId } });
  });
}

/**
 * STERIL returns an item from CSSD to Operasi. Optional content changes are applied in the
 * same transaction and land in the RETURN log as the same per-field diff an edit would write.
 * Rows with an `id` are patched with the given fields; rows without one are added.
 */
export async function returnItem(actor: Actor, itemId: string, input: ReturnItemInput) {
  const data = parse(returnItemSchema, input);

  return db.$transaction(async (tx) => {
    const item = await tx.item.findUnique({
      where: { id: itemId },
      include: { contents: true },
    });
    if (!item) throw new AppError("NOT_FOUND", "Barang tidak ditemukan");
    if (!can(actor.role, "item.return", stateOf(item))) {
      throw new AppError("FORBIDDEN", "Peran Anda tidak berwenang mengembalikan barang");
    }
    const problem = stateProblem(item, "CSSD");
    if (problem) throw problem;
    if (item.version !== data.version) {
      throw new AppError("VERSION_CONFLICT", "Data sudah berubah, muat ulang halaman");
    }

    // Build the full submitted list: stored rows patched by id, plus any new rows.
    const stored = new Map(item.contents.map((c) => [c.id, c]));
    const patches = new Map<string, NonNullable<typeof data.contents>[number]>();
    const additions: NonNullable<typeof data.contents> = [];
    for (const row of data.contents ?? []) {
      if (!row.id) additions.push(row);
      else if (stored.has(row.id)) patches.set(row.id, row);
      else throw new AppError("VALIDATION_ERROR", "Baris isi tidak ditemukan pada barang ini");
    }
    const merged = [
      ...item.contents.map((c) => ({ ...c, ...stripUndefined(patches.get(c.id) ?? {}) })),
      ...additions,
    ];
    const rows = parse(z.array(contentRowSchema), merged).map((r) => ({
      ...r,
      brand: r.brand ?? null,
      note: r.note ?? null,
    }));
    const plan = planContents(item.contents, rows);
    const contentsChanged = plan.changes.length > 0;

    if (contentsChanged) {
      if (!can(actor.role, "item.editContents", stateOf(item))) {
        throw new AppError("FORBIDDEN", "Peran atau lokasi barang tidak mengizinkan perubahan isi");
      }
      assertContentsPlanAllowed(actor, plan);
    }

    const moved = await tx.item.updateMany({
      where: { id: itemId, location: "CSSD", isArchived: false, version: item.version },
      data: { location: "OPERASI", locationSince: new Date(), version: { increment: 1 } },
    });
    if (moved.count === 0) {
      const now = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
      throw (
        stateProblem(now, "CSSD") ??
        new AppError("VERSION_CONFLICT", "Data sudah berubah, muat ulang halaman")
      );
    }

    if (contentsChanged) await applyContentsPlan(tx, itemId, plan);

    await tx.itemLog.create({
      data: {
        itemId,
        action: "RETURN",
        userId: actor.id,
        actorName: data.actorName,
        note: data.note ?? null,
        ...(contentsChanged && { changes: plan.changes as Prisma.InputJsonValue }),
      },
    });
    return tx.item.findUniqueOrThrow({ where: { id: itemId } });
  });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
