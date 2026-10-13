import { execFileSync } from "node:child_process";
import "dotenv/config";
import pg from "pg";

/** Create the test database if needed and bring it to the latest migration. */
export default async function setup() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");

  const url = new URL(base);
  const testDb = "simaset_test";
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDb]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${testDb}`);
  await admin.end();

  url.pathname = `/${testDb}`;
  process.env.DATABASE_URL = url.toString();
  execFileSync("node_modules/.bin/prisma", ["migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
  });
}
