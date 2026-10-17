import "dotenv/config";
import { db } from "../src/server/db";
import { returnItem, sendItem } from "../src/server/services/flow.service";
import type { Actor } from "../src/server/services/item.service";
import { registerItem, updateItem } from "../src/server/services/item.service";
import { createMaintenance } from "../src/server/services/maintenance.service";

/**
 * Seed the dev database with hospital-style sample data so the Beranda has
 * real numbers (counts, sterilization, due-soon, activity log cards).
 * Idempotent: items already present by name are skipped, so re-running is safe.
 * Usage: pnpm seed
 */
function dateDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const admin = await db.user.findFirstOrThrow({
    where: { role: "SUPERADMIN", isActive: true },
    select: { id: true, name: true },
  });
  const actor: Actor = { id: admin.id, name: admin.name, role: "SUPERADMIN" };
  const exists = async (name: string) => (await db.item.count({ where: { name } })) > 0;
  const done: string[] = [];

  // A sterilization set that flows to CSSD and back: REGISTER, SEND, RETURN logs.
  if (!(await exists("Set laringoskop"))) {
    const { item } = await registerItem(actor, {
      name: "Set laringoskop",
      needsSterilization: true,
      room: "OK 101",
      contents: [
        { name: "Blade MAC 3", brand: "Welch Allyn", quantity: 4, damagedQuantity: 0, note: null },
        { name: "Face mask no. 4", brand: null, quantity: 2, damagedQuantity: 0, note: null },
      ],
    });
    await sendItem(actor, item.id, { actorName: "Ningsih", note: "Kirim sterilisasi" });
    const moved = await db.item.findUniqueOrThrow({
      where: { id: item.id },
      select: { version: true },
    });
    await returnItem(actor, item.id, {
      version: moved.version,
      actorName: "Ningsih",
      note: "Steril, siap pakai",
    });
    done.push(`${item.code} Set laringoskop (kirim + kembali)`);
  }

  // A set waiting in OPERASI with one damaged content row: steril + rusak counts.
  if (!(await exists("Set mayor 1"))) {
    const { item } = await registerItem(actor, {
      name: "Set mayor 1",
      needsSterilization: true,
      room: "OK 102",
      contents: [
        { name: "Doek klem", brand: "AESCULAP", quantity: 4, damagedQuantity: 0, note: null },
        {
          name: "Arteri besar",
          brand: "AESCULAP",
          quantity: 6,
          damagedQuantity: 1,
          note: "patah rahang",
        },
        { name: "Pean", brand: "SMIC", quantity: 2, damagedQuantity: 0, note: null },
      ],
    });
    done.push(`${item.code} Set mayor 1 (isi rusak 1)`);
  }

  // A small set sent to CSSD and left there: cssd count + SEND log.
  if (!(await exists("Gunting Mayo"))) {
    const { item } = await registerItem(actor, {
      name: "Gunting Mayo",
      needsSterilization: true,
      quantity: 3,
    });
    await sendItem(actor, item.id, { actorName: "Ningsih", note: "Kirim sterilisasi" });
    done.push(`${item.code} Gunting Mayo (di CSSD)`);
  }

  // Large equipment with a calibration due in 12 days, then an edit of its room.
  if (!(await exists("Mesin Anestesi Drager"))) {
    const { item } = await registerItem(actor, {
      name: "Mesin Anestesi Drager",
      needsSterilization: false,
      room: "OK 101",
      brand: "Drager",
      model: "Fabius Tiro",
      serialNumber: "SN-2024-0117",
      purchaseDate: dateDaysFromNow(-400),
      purchasePrice: 350_000_000,
      supplier: "PT Medika Jaya",
    });
    await createMaintenance(actor, item.code, {
      type: "KALIBRASI",
      performedOn: dateDaysFromNow(-30),
      performer: "Teknisi LabMed",
      actorName: "Ningsih",
      damagedAfter: 0,
      details: { institution: "Lab Medika", result: "LULUS", validUntil: dateDaysFromNow(12) },
    });
    const current = await db.item.findUniqueOrThrow({
      where: { id: item.id },
      select: { version: true },
    });
    await updateItem(actor, item.id, { version: current.version, room: "OK 102" });
    done.push(`${item.code} Mesin Anestesi Drager (kalibrasi 12 hari, ruang diubah)`);
  }

  // Damaged operating table with a repair record: rusak count + MAINTENANCE log.
  if (!(await exists("Meja Operasi Skytron"))) {
    const { item } = await registerItem(actor, {
      name: "Meja Operasi Skytron",
      needsSterilization: false,
      room: "OK 103",
      quantity: 2,
      damagedQuantity: 1,
    });
    await createMaintenance(actor, item.code, {
      type: "PERBAIKAN",
      performedOn: dateDaysFromNow(-45),
      performer: "Teknisi PT Alkes",
      actorName: "Ningsih",
      cost: 1_250_000,
      damagedAfter: 1,
      details: {
        complaint: "Oli bocor di tuas punggung",
        action: "Ganti seal hidrolik",
        parts: "Seal kit Skytron",
        finishedOn: dateDaysFromNow(-40),
      },
    });
    done.push(`${item.code} Meja Operasi Skytron (rusak 1, perbaikan)`);
  }

  // An autoclave in CSSD whose calibration is 45 days overdue: due-soon count.
  if (!(await exists("Autoclave"))) {
    const { item } = await registerItem(actor, {
      name: "Autoclave",
      needsSterilization: true,
      brand: "Tuttnauer",
    });
    await sendItem(actor, item.id, { actorName: "Ningsih", note: "Kirim sterilisasi" });
    await createMaintenance(actor, item.code, {
      type: "KALIBRASI",
      performedOn: dateDaysFromNow(-100),
      performer: "Teknisi LabMed",
      actorName: "Ningsih",
      damagedAfter: 0,
      details: {
        institution: "Lab Medika",
        result: "LULUS",
        validUntil: dateDaysFromNow(-45),
      },
    });
    done.push(`${item.code} Autoclave (kalibrasi terlambat)`);
  }

  console.log(
    done.length > 0
      ? `Seeded:\n${done.map((line) => `- ${line}`).join("\n")}`
      : "Semua data contoh sudah ada.",
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
