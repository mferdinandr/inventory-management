import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { db } from "../src/server/db";
import { createUser } from "../src/server/services/user.service";

/**
 * Creates the first SUPERADMIN (or any user). Usage:
 *   pnpm user:create --username admin --name "Admin RS" --role SUPERADMIN --password '...'
 * Missing values are asked for interactively.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label: string, given?: string, fallback?: string) =>
    given ??
    ((await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)) || fallback || "");

  const username = await ask("Username", flag("username"));
  const name = await ask("Nama", flag("name"), username);
  const role = await ask("Peran (OPERASI/STERIL/ALKES/SUPERADMIN)", flag("role"), "SUPERADMIN");
  const password = await ask("Kata sandi (min. 8 karakter)", flag("password"));
  rl.close();

  const user = await createUser({ username, name, role: role as never, password });
  console.log(
    `Dibuat: ${user.username} (${user.role}). Wajib ganti kata sandi saat masuk pertama.`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
