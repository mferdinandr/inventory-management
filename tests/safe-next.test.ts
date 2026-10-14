import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("accepts same-origin paths", () => {
    expect(safeNext("/items/BRG-0001")).toBe("/items/BRG-0001");
    expect(safeNext("/items?x=1#a")).toBe("/items?x=1#a");
  });

  it("rejects open-redirect shapes", () => {
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "items/BRG-0001",
      "/a\\b",
      "/a\nb",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});
