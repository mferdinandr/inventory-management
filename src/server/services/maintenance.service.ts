import type { Prisma } from "@/generated/prisma/client";
import { can, type Role } from "@/lib/permissions";
import {
  type MaintenanceData,
  type MaintenanceInput,
  maintenanceSchema,
} from "@/lib/validators/maintenance";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user as the auth guard hands it over. */
type Actor = { id: string; role: Role };

/** Dates are plain days (`date` columns), kept at UTC midnight so they never shift. */
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** `details` as stored: snake_case keys, empty optionals left out (docs/03). */
function storedDetails(data: MaintenanceData): Prisma.InputJsonObject {
  switch (data.type) {
    case "PERBAIKAN":
      return {
        complaint: data.details.complaint,
        action: data.details.action ?? null,
        parts: data.details.parts ?? null,
        finished_on: data.details.finishedOn ?? null,
      };
    case "PEMELIHARAAN":
      return { activities: data.details.activities, findings: data.details.findings ?? null };
    case "KALIBRASI":
      return {
        institution: data.details.institution,
        certificate_no: data.details.certificateNo ?? null,
        result: data.details.result,
        valid_until: data.details.validUntil,
      };
  }
}

function nextDueOf(data: MaintenanceData): string | undefined {
  if (data.type === "KALIBRASI") return data.details.validUntil;
  if (data.type === "PEMELIHARAAN") return data.nextDue;
  return undefined;
}

/**
 * Record one maintenance job: the record, the item's new damaged count and the history entry
 * are written in a single transaction. `item` is an item code (BRG-0001) or its id.
 */
export async function createMaintenance(user: Actor, item: string, input: MaintenanceInput) {
  if (!can(user.role, "maintenance.create")) {
    throw new AppError("FORBIDDEN", "Peran Anda tidak berwenang");
  }
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Masukan tidak valid",
    );
  }
  const data = parsed.data;

  return db.$transaction(async (tx) => {
    const found = await tx.item.findUnique({
      where: UUID.test(item) ? { id: item } : { code: item },
      select: { id: true },
    });
    if (!found) throw new AppError("NOT_FOUND", "Barang tidak ditemukan");

    // Lock the row so two people recording at once cannot overwrite each other's count.
    await tx.$queryRaw`SELECT id FROM items WHERE id = ${found.id}::uuid FOR UPDATE`;
    const current = await tx.item.findUniqueOrThrow({ where: { id: found.id } });

    if (current.isArchived) {
      throw new AppError("STATE_CONFLICT", "Barang terarsip tidak dapat dirawat");
    }
    if (data.damagedAfter > current.quantity) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Jumlah rusak tidak boleh melebihi jumlah barang (${current.quantity})`,
      );
    }

    // A failed calibration means the unit is not fit for use, even if nobody counted it as broken.
    const damagedAfter =
      data.type === "KALIBRASI" && data.details.result === "TIDAK_LULUS" && data.damagedAfter === 0
        ? 1
        : data.damagedAfter;
    if (damagedAfter > current.quantity) {
      throw new AppError("VALIDATION_ERROR", "Barang berjumlah 0 tidak dapat dikalibrasi");
    }

    const nextDue = nextDueOf(data);
    const record = await tx.maintenanceRecord.create({
      data: {
        itemId: current.id,
        type: data.type,
        performedOn: toDate(data.performedOn),
        performer: data.performer,
        cost: data.cost,
        note: data.note,
        details: storedDetails(data),
        nextDue: nextDue ? toDate(nextDue) : null,
        damagedAfter,
        userId: user.id,
        actorName: data.actorName,
      },
    });

    const changed = damagedAfter !== current.damagedQuantity;
    if (changed) {
      await tx.item.update({ where: { id: current.id }, data: { damagedQuantity: damagedAfter } });
    }

    await tx.itemLog.create({
      data: {
        itemId: current.id,
        action: "MAINTENANCE",
        userId: user.id,
        actorName: data.actorName,
        note: data.note,
        maintenanceId: record.id,
        changes: changed
          ? [
              {
                name: current.name,
                field: "damaged_quantity",
                from: current.damagedQuantity,
                to: damagedAfter,
              },
            ]
          : undefined,
      },
    });

    return record;
  });
}

/** What the maintenance pages need to know about an item, by its code. */
export function findItemForMaintenance(code: string) {
  return db.item.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      quantity: true,
      damagedQuantity: true,
      isArchived: true,
    },
  });
}

export type MaintenanceEntry = Prisma.MaintenanceRecordGetPayload<Record<string, never>>;

/** Newest first. Pass the previous page's `nextCursor` to continue. */
export async function listMaintenance(
  itemId: string,
  cursor?: string,
): Promise<{ records: MaintenanceEntry[]; nextCursor: string | null }> {
  const rows = await db.maintenanceRecord.findMany({
    where: { itemId },
    orderBy: [{ performedOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 0 } : {}),
  });
  const more = rows.length > PAGE_SIZE;
  const records = more ? rows.slice(0, PAGE_SIZE) : rows;
  return { records, nextCursor: more ? (rows[PAGE_SIZE]?.id ?? null) : null };
}

/**
 * The next date something is due. Only the latest record of each recurring kind counts, so a
 * newer calibration replaces the schedule of an older one. Null when nothing is scheduled.
 */
export async function getNextDue(itemId: string): Promise<Date | null> {
  const latest = await Promise.all(
    (["PEMELIHARAAN", "KALIBRASI"] as const).map((type) =>
      db.maintenanceRecord.findFirst({
        where: { itemId, type },
        orderBy: [{ performedOn: "desc" }, { createdAt: "desc" }],
        select: { nextDue: true },
      }),
    ),
  );
  const dates = latest.flatMap((r) => (r?.nextDue ? [r.nextDue] : []));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}
