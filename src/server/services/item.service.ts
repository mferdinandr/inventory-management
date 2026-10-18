import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { can, type ItemState, type Role } from "@/lib/permissions";
import {
  itemRuleError,
  type RegisterItemInput,
  registerItemSchema,
  type UpdateItemInput,
  updateItemSchema,
} from "@/lib/validators/item";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { dueSoonItemIds } from "@/server/services/summary.service";

/** Who is acting. Logs record `name` as the actor, so shared accounts stay traceable. */
export type Actor = { id: string; name: string; role: Role };

export type ItemWarning = { code: "DUPLICATE_SERIAL"; codes: string[] };

/** One entry of `item_logs.changes` (docs/03 "Bentuk changes"). */
export type ItemChange = { name: string; field: string; from: unknown; to: unknown };

type Tx = Prisma.TransactionClient;

export type ItemSort = "code" | "name" | "room" | "note" | "location" | "quantity";
export type ItemSortDir = "asc" | "desc";

export type ItemFilters = {
  q?: string;
  location?: "OPERASI" | "CSSD";
  room?: string;
  damaged?: boolean;
  /** Only items flagged as needing sterilization. */
  needsSterilization?: boolean;
  /** Only items whose next maintenance/calibration is due within 30 days (or overdue). */
  dueSoon?: boolean;
  /** true lists only archived items; the default lists only active ones. */
  archived?: boolean;
  /** Sort column; defaults to `code`. */
  sort?: ItemSort;
  /** Sort direction; defaults to `asc`. */
  dir?: ItemSortDir;
};

const SORT_FIELDS: Record<ItemSort, keyof Prisma.ItemOrderByWithRelationInput> = {
  code: "code",
  name: "name",
  room: "room",
  note: "description",
  location: "location",
  quantity: "quantity",
};

const LIST_LIMIT = 500;
const RECENT_LOGS = 50;

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

const stateOf = (item: ItemState): ItemState => ({
  location: item.location,
  needsSterilization: item.needsSterilization,
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listItems(filters: ItemFilters = {}) {
  const q = filters.q?.trim();
  const where: Prisma.ItemWhereInput = {
    isArchived: filters.archived ?? false,
    ...(filters.location && { location: filters.location }),
    ...(filters.room && { room: filters.room }),
    // Same rule as the Beranda "Ada yang rusak" count: the item itself or any content row.
    ...(filters.damaged && {
      AND: [
        {
          OR: [
            { damagedQuantity: { gt: 0 } },
            { contents: { some: { damagedQuantity: { gt: 0 } } } },
          ],
        },
      ],
    }),
    ...(filters.dueSoon && { id: { in: await dueSoonItemIds() } }),
    ...(filters.needsSterilization && { needsSterilization: true }),
    ...(q && {
      OR: (["code", "name", "brand", "serialNumber", "room"] as const).map((field) => ({
        [field]: { contains: q, mode: "insensitive" as const },
      })),
    }),
  };
  const orderBy: Prisma.ItemOrderByWithRelationInput[] = [
    { [SORT_FIELDS[filters.sort ?? "code"]]: filters.dir === "desc" ? "desc" : "asc" },
    { code: "asc" },
  ];

  return db.item.findMany({
    where,
    orderBy,
    take: LIST_LIMIT,
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      room: true,
      needsSterilization: true,
      location: true,
      locationSince: true,
      quantity: true,
      damagedQuantity: true,
      isArchived: true,
    },
  });
}

/** Distinct rooms already in use, for the filter and as suggestions in the form. */
export async function listRooms(): Promise<string[]> {
  const rows = await db.item.findMany({
    where: { room: { not: null } },
    distinct: ["room"],
    orderBy: { room: "asc" },
    select: { room: true },
  });
  return rows.flatMap((r) => (r.room ? [r.room] : []));
}

/** The item with its contents, recent history, and other items sharing its serial number. */
export async function getItemByCode(code: string) {
  const item = await db.item.findUnique({
    where: { code },
    include: {
      contents: { orderBy: { name: "asc" } },
      logs: { orderBy: { createdAt: "desc" }, take: RECENT_LOGS },
    },
  });
  if (!item) return null;
  return { ...item, duplicateSerialCodes: await findDuplicateSerial(db, item) };
}

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItemByCode>>>;

async function findDuplicateSerial(
  tx: Tx | typeof db,
  item: { id: string; serialNumber: string | null },
): Promise<string[]> {
  if (!item.serialNumber) return [];
  const others = await tx.item.findMany({
    where: { serialNumber: item.serialNumber, id: { not: item.id } },
    orderBy: { code: "asc" },
    select: { code: true },
  });
  return others.map((o) => o.code);
}

async function warningsFor(tx: Tx, item: { id: string; serialNumber: string | null }) {
  const codes = await findDuplicateSerial(tx, item);
  return codes.length > 0 ? [{ code: "DUPLICATE_SERIAL" as const, codes }] : [];
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/** Item, contents and the REGISTER log are written together or not at all. */
export async function registerItem(actor: Actor, input: RegisterItemInput) {
  if (!can(actor.role, "item.create")) {
    throw new AppError("FORBIDDEN", "Peran Anda tidak berwenang mendaftarkan barang");
  }
  const { contents, ...fields } = parse(registerItemSchema, input);

  return db.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        ...fields,
        contents: {
          create: contents.map(({ id: _id, ...row }) => row),
        },
      },
    });
    await tx.itemLog.create({
      data: { itemId: item.id, action: "REGISTER", userId: actor.id, actorName: actor.name },
    });
    return { item, warnings: (await warningsFor(tx, item)) as ItemWarning[] };
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

type ContentRow = {
  name: string;
  brand: string | null;
  quantity: number;
  damagedQuantity: number;
  note: string | null;
};
type StoredContent = ContentRow & { id: string };
type SubmittedContent = ContentRow & { id?: string };

const CONTENT_FIELDS = [
  ["name", "name"],
  ["brand", "brand"],
  ["quantity", "quantity"],
  ["damaged_quantity", "damagedQuantity"],
  ["note", "note"],
] as const;

/**
 * Replace-all semantics turned into row operations plus the log diff. A submitted row is
 * matched to a stored one by `id`, falling back to the same name, so a row that was only
 * renamed is an update rather than a delete plus an insert.
 */
export function planContents(stored: StoredContent[], submitted: SubmittedContent[]) {
  const byId = new Map(stored.map((s) => [s.id, s]));
  const byName = new Map(stored.map((s) => [s.name, s]));
  const used = new Set<string>();
  const creates: ContentRow[] = [];
  const updates: { id: string; data: Partial<ContentRow>; before: StoredContent }[] = [];
  const changes: ItemChange[] = [];

  for (const row of submitted) {
    const candidate = (row.id ? byId.get(row.id) : undefined) ?? byName.get(row.name);
    const before = candidate && !used.has(candidate.id) ? candidate : undefined;

    if (!before) {
      creates.push(row);
      changes.push({ name: row.name, field: "quantity", from: null, to: row.quantity });
      if (row.damagedQuantity > 0) {
        changes.push({
          name: row.name,
          field: "damaged_quantity",
          from: null,
          to: row.damagedQuantity,
        });
      }
      if (row.brand) changes.push({ name: row.name, field: "brand", from: null, to: row.brand });
      if (row.note) changes.push({ name: row.name, field: "note", from: null, to: row.note });
      continue;
    }

    used.add(before.id);
    const data: Partial<ContentRow> = {};
    for (const [field, key] of CONTENT_FIELDS) {
      if (before[key] === row[key]) continue;
      (data as Record<string, unknown>)[key] = row[key];
      changes.push({ name: before.name, field, from: before[key], to: row[key] });
    }
    if (Object.keys(data).length > 0) updates.push({ id: before.id, data, before });
  }

  const deletes = stored.filter((s) => !used.has(s.id));
  for (const row of deletes) {
    changes.push({ name: row.name, field: "quantity", from: row.quantity, to: null });
  }
  return { creates, updates, deletes, changes };
}

type ContentsPlan = ReturnType<typeof planContents>;

/** Steril staff top up counts and add replacement rows; they do not remove or rename. */
export function assertContentsPlanAllowed(actor: { role: Role }, plan: ContentsPlan) {
  if (
    actor.role === "STERIL" &&
    (plan.deletes.length > 0 ||
      plan.updates.some((u) => u.data.name !== undefined || u.data.brand !== undefined))
  ) {
    throw new AppError("FORBIDDEN", "Petugas steril hanya boleh mengubah jumlah dan catatan");
  }
}

/** Write the row operations of a plan inside the caller's transaction. */
export async function applyContentsPlan(tx: Tx, itemId: string, plan: ContentsPlan) {
  try {
    if (plan.deletes.length > 0) {
      await tx.itemContent.deleteMany({ where: { id: { in: plan.deletes.map((d) => d.id) } } });
    }
    for (const u of plan.updates) {
      await tx.itemContent.update({ where: { id: u.id }, data: u.data });
    }
    if (plan.creates.length > 0) {
      await tx.itemContent.createMany({
        data: plan.creates.map((row) => ({ ...row, itemId })),
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("VALIDATION_ERROR", "Nama isi ganda dalam satu barang");
    }
    throw e;
  }
}

type ItemRow = Prisma.ItemGetPayload<object>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Item-level columns that can be edited, with how to compare and log them. */
const ITEM_FIELDS = [
  ["name", "name", (i: ItemRow) => i.name],
  ["needs_sterilization", "needsSterilization", (i: ItemRow) => i.needsSterilization],
  ["room", "room", (i: ItemRow) => i.room],
  ["description", "description", (i: ItemRow) => i.description],
  ["quantity", "quantity", (i: ItemRow) => i.quantity],
  ["damaged_quantity", "damagedQuantity", (i: ItemRow) => i.damagedQuantity],
  ["brand", "brand", (i: ItemRow) => i.brand],
  ["model", "model", (i: ItemRow) => i.model],
  ["serial_number", "serialNumber", (i: ItemRow) => i.serialNumber],
  ["purchase_date", "purchaseDate", (i: ItemRow) => day(i.purchaseDate)],
  [
    "purchase_price",
    "purchasePrice",
    (i: ItemRow) => (i.purchasePrice === null ? null : Number(i.purchasePrice)),
  ],
  ["supplier", "supplier", (i: ItemRow) => i.supplier],
  ["funding_source", "fundingSource", (i: ItemRow) => i.fundingSource],
  ["warranty_until", "warrantyUntil", (i: ItemRow) => day(i.warrantyUntil)],
] as const;

/**
 * Edit an item and/or replace its contents. The submitted `version` must match the stored
 * one (optimistic lock). Which role may change what depends on where the item is, so the
 * permission is decided per part that actually changes: unchanged fields never trip it.
 */
export async function updateItem(actor: Actor, id: string, input: UpdateItemInput) {
  const data = parse(updateItemSchema, input);

  return db.$transaction(async (tx) => {
    const item = await tx.item.findUnique({
      where: { id },
      include: { contents: true },
    });
    if (!item) throw new AppError("NOT_FOUND", "Barang tidak ditemukan");
    if (item.version !== data.version) {
      throw new AppError("VERSION_CONFLICT", "Data sudah berubah, muat ulang halaman");
    }
    if (item.isArchived) {
      throw new AppError("STATE_CONFLICT", "Barang diarsipkan. Pulihkan dulu sebelum mengubah");
    }

    // Fields whose submitted value differs from what is stored.
    const patch: Record<string, unknown> = {};
    const changes: ItemChange[] = [];
    for (const [field, key, read] of ITEM_FIELDS) {
      const next = data[key];
      if (next === undefined) continue;
      const nextValue = next instanceof Date ? day(next) : next;
      const from = read(item);
      if (from === nextValue) continue;
      patch[key] = next;
      changes.push({ name: item.name, field, from, to: nextValue });
    }

    const plan = data.contents
      ? planContents(
          item.contents,
          data.contents.map((r) => ({ ...r, brand: r.brand ?? null, note: r.note ?? null })),
        )
      : undefined;
    const contentsChanged = plan !== undefined && plan.changes.length > 0;

    const state = stateOf(item);
    if (changes.length > 0 && !can(actor.role, "item.editDetails", state)) {
      throw new AppError("FORBIDDEN", "Peran atau lokasi barang tidak mengizinkan perubahan ini");
    }
    if (contentsChanged && !can(actor.role, "item.editContents", state)) {
      throw new AppError("FORBIDDEN", "Peran atau lokasi barang tidak mengizinkan perubahan isi");
    }
    if (contentsChanged) assertContentsPlanAllowed(actor, plan);
    if ("needsSterilization" in patch && item.location !== "OPERASI") {
      throw new AppError(
        "STATE_CONFLICT",
        "Jenis sterilisasi hanya dapat diubah saat barang di Operasi",
      );
    }

    const merged = {
      quantity: (patch.quantity as number | undefined) ?? item.quantity,
      damagedQuantity: (patch.damagedQuantity as number | undefined) ?? item.damagedQuantity,
      serialNumber:
        "serialNumber" in patch ? (patch.serialNumber as string | null) : item.serialNumber,
    };
    const rule = itemRuleError(merged);
    if (rule) throw new AppError("VALIDATION_ERROR", rule);

    if (changes.length === 0 && !contentsChanged) {
      return { item, warnings: (await warningsFor(tx, item)) as ItemWarning[] };
    }

    // The version guard makes a concurrent save lose even if it read the same row.
    const locked = await tx.item.updateMany({
      where: { id, version: item.version },
      data: { ...patch, version: { increment: 1 } },
    });
    if (locked.count === 0) {
      throw new AppError("VERSION_CONFLICT", "Data sudah berubah, muat ulang halaman");
    }

    if (plan && contentsChanged) await applyContentsPlan(tx, id, plan);

    await tx.itemLog.create({
      data: {
        itemId: id,
        action: "EDIT",
        userId: actor.id,
        actorName: actor.name,
        note: data.note ?? null,
        changes: [...changes, ...(plan?.changes ?? [])] as Prisma.InputJsonValue,
      },
    });

    const updated = await tx.item.findUniqueOrThrow({ where: { id } });
    return { item: updated, warnings: (await warningsFor(tx, updated)) as ItemWarning[] };
  });
}

// ---------------------------------------------------------------------------
// Archive / restore
// ---------------------------------------------------------------------------

function setArchived(archived: boolean) {
  return async (actor: Actor, id: string, note?: string) =>
    db.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item) throw new AppError("NOT_FOUND", "Barang tidak ditemukan");
      if (!can(actor.role, "item.archive", stateOf(item))) {
        throw new AppError("FORBIDDEN", "Peran atau lokasi barang tidak mengizinkan tindakan ini");
      }
      if (item.isArchived === archived) {
        throw new AppError(
          "STATE_CONFLICT",
          archived ? "Barang sudah diarsipkan" : "Barang tidak sedang diarsipkan",
        );
      }
      const updated = await tx.item.update({
        where: { id },
        data: { isArchived: archived, version: { increment: 1 } },
      });
      await tx.itemLog.create({
        data: {
          itemId: id,
          action: archived ? "ARCHIVE" : "RESTORE",
          userId: actor.id,
          actorName: actor.name,
          note: note?.trim() || null,
        },
      });
      return updated;
    });
}

export const archiveItem = setArchived(true);
export const restoreItem = setArchived(false);
