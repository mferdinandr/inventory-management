import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "../src/server/db";
import { formatMapCsv, formatReport, hasErrors, runImport } from "../src/server/import/run";

/**
 * One-off loader for the initial inventory (docs/14-impor-csv.md). Usage:
 *   pnpm import:csv --items items.csv --contents contents.csv --as admin [--dry-run]
 *     [--skip-invalid] [--map-out import-map.csv]
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(`Berkas tidak dapat dibaca: ${path}`);
  }
}

async function main() {
  const items = flag("items");
  const contents = flag("contents");
  const username = flag("as");
  if (!items || !contents || !username) {
    throw new Error(
      "Pemakaian: pnpm import:csv --items items.csv --contents contents.csv --as <username> [--dry-run] [--skip-invalid] [--map-out import-map.csv]",
    );
  }

  const report = await runImport({
    itemsText: read(items),
    contentsText: read(contents),
    username,
    dryRun: has("dry-run"),
    skipInvalid: has("skip-invalid"),
  });
  console.log(formatReport(report));

  if (!report.dryRun && report.map.length > 0) {
    const out = flag("map-out") ?? "import-map.csv";
    writeFileSync(out, formatMapCsv(report.map));
    console.log(`Pemetaan ref -> kode ditulis ke ${out}`);
  }
  if (report.blocked || hasErrors(report)) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
