import { db } from "@/server/db";

/**
 * Failed-login limiter: 5 failures per 2 minutes per username + IP. Stored in the database
 * (not in memory) so it still holds when requests are served by different serverless instances.
 */
const WINDOW_MS = 2 * 60 * 1000;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;

export function loginKey(username: string, ip: string): string {
  return `${username}|${ip}`;
}

export async function isLoginBlocked(key: string, now = Date.now()): Promise<boolean> {
  const failures = await db.loginFailure.count({
    where: { key, createdAt: { gt: new Date(now - WINDOW_MS) } },
  });
  return failures >= MAX_FAILURES;
}

export async function recordLoginFailure(key: string, now = Date.now()): Promise<void> {
  await db.loginFailure.create({ data: { key, createdAt: new Date(now) } });
  await db.loginFailure.deleteMany({
    where: { createdAt: { lt: new Date(now - PRUNE_AFTER_MS) } },
  });
}

export async function clearLoginFailures(key: string): Promise<void> {
  await db.loginFailure.deleteMany({ where: { key } });
}
