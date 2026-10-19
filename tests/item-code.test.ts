import { describe, expect, it } from "vitest";
import { codeFromScan, normalizeItemCode } from "@/lib/item-code";

describe("normalizeItemCode", () => {
  it("is case-insensitive and pads the number", () => {
    expect(normalizeItemCode("brg-0001")).toBe("BRG-0001");
    expect(normalizeItemCode(" Brg0012 ")).toBe("BRG-0012");
    expect(normalizeItemCode("BRG-7")).toBe("BRG-0007");
    expect(normalizeItemCode("BRG-12345")).toBe("BRG-12345");
  });

  it("rejects other input", () => {
    for (const bad of ["", "ABC-0001", "BRG-", "BRG-00x1", "0001"]) {
      expect(normalizeItemCode(bad)).toBeNull();
    }
  });
});

describe("codeFromScan", () => {
  it("reads the code from our QR URL or a bare code", () => {
    expect(codeFromScan("https://simaset.example.com/i/BRG-0001")).toBe("BRG-0001");
    expect(codeFromScan("http://localhost:3000/i/brg-0002/")).toBe("BRG-0002");
    expect(codeFromScan("BRG-0003")).toBe("BRG-0003");
  });

  it("ignores unrelated QR codes", () => {
    expect(codeFromScan("https://example.com/other")).toBeNull();
    expect(codeFromScan("hello")).toBeNull();
  });
});
