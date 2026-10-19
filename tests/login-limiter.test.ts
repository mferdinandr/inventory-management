import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "@/server/auth/login-limiter";
import { db } from "@/server/db";

beforeEach(async () => {
  await db.loginFailure.deleteMany();
});

describe("login limiter", () => {
  it("blocks after 5 failures within 2 minutes", async () => {
    const key = "a|1.1.1.1";
    const t0 = Date.now();
    for (let i = 0; i < 4; i++) await recordLoginFailure(key, t0 + i);
    expect(await isLoginBlocked(key, t0 + 10)).toBe(false);
    await recordLoginFailure(key, t0 + 5);
    expect(await isLoginBlocked(key, t0 + 10)).toBe(true);
  });

  it("forgets failures older than 2 minutes", async () => {
    const key = "b|2.2.2.2";
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await recordLoginFailure(key, t0);
    expect(await isLoginBlocked(key, t0 + 1 * 60_000)).toBe(true);
    expect(await isLoginBlocked(key, t0 + 2 * 60_000 + 1)).toBe(false);
  });

  it("keeps separate counts per key and clears on success", async () => {
    const key = "c|3.3.3.3";
    for (let i = 0; i < 5; i++) await recordLoginFailure(key);
    expect(await isLoginBlocked("other|3.3.3.3")).toBe(false);
    await clearLoginFailures(key);
    expect(await isLoginBlocked(key)).toBe(false);
  });

  it("prunes failures older than a day when a new one is recorded", async () => {
    const t0 = Date.now();
    await recordLoginFailure("old|4.4.4.4", t0 - 2 * 24 * 60 * 60 * 1000);
    await recordLoginFailure("new|4.4.4.4", t0);
    expect(await db.loginFailure.count({ where: { key: "old|4.4.4.4" } })).toBe(0);
  });
});
