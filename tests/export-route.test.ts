import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("@/server/auth/session", () => ({ getCurrentUser }));
const exportItemsCsv = vi.fn(async () => "items-csv");
const exportContentsCsv = vi.fn(async () => "contents-csv");
vi.mock("@/server/services/export.service", () => ({ exportItemsCsv, exportContentsCsv }));

const { GET } = await import("@/app/api/items/export/route");

const call = (query = "") => GET(new Request(`http://localhost/api/items/export${query}`));

beforeEach(() => {
  getCurrentUser.mockReset();
  exportItemsCsv.mockClear();
  exportContentsCsv.mockClear();
});

describe("GET /api/items/export", () => {
  it("returns 401 when signed out or while a password change is pending", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    getCurrentUser.mockResolvedValue({ id: "u", role: "ALKES", mustChangePassword: true });
    expect((await call()).status).toBe(401);
    expect(exportItemsCsv).not.toHaveBeenCalled();
  });

  it.each(["OPERASI", "STERIL", "ALKES", "SUPERADMIN"])("lets %s download", async (role) => {
    getCurrentUser.mockResolvedValue({ id: "u", role, mustChangePassword: false });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="simaset-barang-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(await res.text()).toBe("items-csv");
  });

  it("serves the contents file for type=contents and passes the filters through", async () => {
    getCurrentUser.mockResolvedValue({ id: "u", role: "ALKES", mustChangePassword: false });
    const res = await call("?type=contents&room=A&damaged=1&location=CSSD");
    expect(res.headers.get("content-disposition")).toContain("simaset-isi-wadah-");
    expect(await res.text()).toBe("contents-csv");
    expect(exportContentsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ room: "A", damaged: true, location: "CSSD" }),
    );
  });
});
