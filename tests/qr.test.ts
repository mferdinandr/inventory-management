import { afterEach, describe, expect, it } from "vitest";
import { qrSvg, qrTarget } from "@/server/qr";

const original = process.env.APP_URL;
afterEach(() => {
  process.env.APP_URL = original;
});

describe("qr", () => {
  it("encodes only the item URL built from APP_URL", () => {
    process.env.APP_URL = "https://simaset.example.com/";
    expect(qrTarget("BRG-0001")).toBe("https://simaset.example.com/i/BRG-0001");
  });

  it("renders an SVG of the requested size", async () => {
    process.env.APP_URL = "https://simaset.example.com";
    const svg = await qrSvg("BRG-0001", 256);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="256"');
  });

  it("produces the same QR on every print", async () => {
    expect(await qrSvg("BRG-0001")).toBe(await qrSvg("BRG-0001"));
  });
});
