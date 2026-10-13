// `pnpm dev`: start Next.js on the PORT from .env, so each worktree has its own port.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const port = process.env.PORT ?? "3000";
const child = spawn("node_modules/.bin/next", ["dev", "-p", port], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
