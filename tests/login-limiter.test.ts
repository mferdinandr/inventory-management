import { describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "@/server/auth/login-limiter";

describe("login limiter", () => {
  it("blocks after 5 failures within 2 minutes", () => {
    const key = "a|1.1.1.1";
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordLoginFailure(key, t0 + i);
    expect(isLoginBlocked(key, t0 + 10)).toBe(false);
    recordLoginFailure(key, t0 + 5);
    expect(isLoginBlocked(key, t0 + 10)).toBe(true);
  });

  it("forgets failures older than 2 minutes", () => {
    const key = "b|2.2.2.2";
    const t0 = 5_000_000;
    for (let i = 0; i < 5; i++) recordLoginFailure(key, t0);
    expect(isLoginBlocked(key, t0 + 1 * 60_000)).toBe(true);
    expect(isLoginBlocked(key, t0 + 2 * 60_000 + 1)).toBe(false);
  });

  it("clears on success", () => {
    const key = "c|3.3.3.3";
    for (let i = 0; i < 5; i++) recordLoginFailure(key);
    clearLoginFailures(key);
    expect(isLoginBlocked(key)).toBe(false);
  });
});
