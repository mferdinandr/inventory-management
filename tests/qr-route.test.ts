import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/services/item-lookup", () => ({
  findItemByCode: async (code: string) => (code === "BRG-0001" ? { code } : null),
}));

const { GET: qr } = await import("@/app/api/qr/[code]/route");
const { GET: scanTarget } = await import("@/app/i/[code]/route");

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

describe("GET /i/[code]", () => {
  it("sends signed-in users to the item", async () => {
    getCurrentUser.mockResolvedValue(user);
    const res = await scanTarget(new Request("http://x/i/BRG-0001"), ctx("BRG-0001"));
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/items/BRG-0001");
  });

  it("sends signed-out users to login with next", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await scanTarget(new Request("http://x/i/BRG-0001"), ctx("BRG-0001"));
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/items/BRG-0001");
  });
});
