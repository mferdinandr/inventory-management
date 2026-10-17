import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
vi.mock("@/server/services/summary.service", () => ({
  getSummary: async () => ({
    operasi: 3,
    cssd: 1,
    damaged: 2,
    dueSoon: 0,
    needsSterilization: 1,
  }),
}));

const { GET } = await import("@/app/api/summary/route");

beforeEach(() => getCurrentUser.mockReset());

describe("GET /api/summary", () => {
  it("returns 401 with the error shape when signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
  });

  it("returns 401 while a password change is pending", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", role: "ALKES", mustChangePassword: true });
    expect((await GET()).status).toBe(401);
  });

  it.each(["OPERASI", "STERIL", "ALKES", "SUPERADMIN"])(
    "returns the counts for %s",
    async (role) => {
      getCurrentUser.mockResolvedValue({ id: "u", role, mustChangePassword: false });
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        operasi: 3,
        cssd: 1,
        damaged: 2,
        dueSoon: 0,
        needsSterilization: 1,
      });
    },
  );
});
