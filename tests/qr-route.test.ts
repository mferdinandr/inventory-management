import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/services/item-lookup", () => ({
  findItemByCode: async (code: string) => (code === "BRG-0001" ? { code } : null),
}));
vi.mock("@/server/services/item.service", () => ({
  getItemByCode: async (code: string) => (code === "BRG-0001" ? item : null),
}));
vi.mock("@/server/services/maintenance.service", () => ({
  listMaintenance: async () => ({ records: [], nextCursor: null }),
  getNextDue: async () => null,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const item = {
  id: "i1",
  code: "BRG-0001",
  name: "Meja Operasi",
  needsSterilization: true,
  location: "OPERASI",
  locationSince: new Date("2026-01-01"),
  room: "OK 1",
  quantity: 2,
  damagedQuantity: 1,
  brand: "Skytron",
  model: "X2",
  serialNumber: "SN-1",
  createdAt: new Date("2025-01-01"),
  description: "Meja bedah",
  purchaseDate: new Date("2025-01-01"),
  purchasePrice: BigInt("10000000"),
  supplier: "PT Alkes",
  fundingSource: "APBD",
  warrantyUntil: new Date("2027-01-01"),
  contents: [],
  logs: [],
  duplicateSerialCodes: [],
};

const { GET: qr } = await import("@/app/api/qr/[code]/route");
const PublicItemPage = (await import("@/app/i/[code]/page")).default;

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const user = { id: "u", role: "ALKES", mustChangePassword: false };

beforeEach(() => getCurrentUser.mockReset());

describe("GET /api/qr/[code]", () => {
  it("returns 401 when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await qr(new Request("http://x/api/qr/BRG-0001"), ctx("BRG-0001"));
    expect(res.status).toBe(401);
  });

  it("returns an SVG for any signed-in role", async () => {
    getCurrentUser.mockResolvedValue(user);
    const res = await qr(new Request("http://x/api/qr/brg-0001?size=128"), ctx("brg-0001"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(await res.text()).toContain('width="128"');
  });

  it("returns 404 for an unknown code and 422 for a bad size", async () => {
    getCurrentUser.mockResolvedValue(user);
    expect((await qr(new Request("http://x/a"), ctx("BRG-9999"))).status).toBe(404);
    expect((await qr(new Request("http://x/a?size=5"), ctx("BRG-0001"))).status).toBe(422);
  });
});

describe("GET /i/[code] (public page)", () => {
  it("redirects signed-in users to the item", async () => {
    getCurrentUser.mockResolvedValue(user);
    await expect(PublicItemPage(ctx("BRG-0001"))).rejects.toThrow("REDIRECT:/items/BRG-0001");
  });

  it("shows the full item info to signed-out visitors", async () => {
    getCurrentUser.mockResolvedValue(null);
    const html = renderToStaticMarkup(await PublicItemPage(ctx("BRG-0001")));
    expect(html).toContain("Meja Operasi");
    expect(html).toContain("SN-1");
    expect(html).toContain("10.000.000");
    expect(html).toContain("Meja bedah");
    expect(html).toContain("Halaman publik");
  });

  it("404s for an unknown code", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(PublicItemPage(ctx("BRG-9999"))).rejects.toThrow("NOT_FOUND");
  });
});
