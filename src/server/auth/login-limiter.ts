/**
 * Failed-login limiter: 5 failures per 10 minutes per username + IP.
 * In memory is enough for a single app instance; a restart simply clears it.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length > 0) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function loginKey(username: string, ip: string): string {
  return `${username}|${ip}`;
}

export function isLoginBlocked(key: string, now = Date.now()): boolean {
  return recent(key, now).length >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  failures.set(key, [...recent(key, now), now]);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
