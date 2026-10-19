import { db } from "@/server/db";

/**
 * History tables refuse UPDATE, DELETE and TRUNCATE (that is the point), so the test
 * database is emptied with their triggers switched off for the duration of the reset only.
 * Only ever call this against the test database.
 */
export async function resetDatabase() {
  await db.$transaction([
    db.$executeRawUnsafe("ALTER TABLE item_logs DISABLE TRIGGER USER"),
    db.$executeRawUnsafe("ALTER TABLE maintenance_records DISABLE TRIGGER USER"),
    db.$executeRawUnsafe(
      "TRUNCATE item_logs, maintenance_records, item_contents, items, users, login_failures CASCADE",
    ),
    db.$executeRawUnsafe("ALTER TABLE item_logs ENABLE TRIGGER USER"),
    db.$executeRawUnsafe("ALTER TABLE maintenance_records ENABLE TRIGGER USER"),
  ]);
}
