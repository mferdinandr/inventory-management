import { beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import {
  changeOwnPassword,
  createUser,
  resetPassword,
  updateUser,
} from "@/server/services/user.service";

const base = { name: "Tester", password: "password-123" };

beforeEach(async () => {
  await db.user.deleteMany();
});

describe("createUser", () => {
  it("hashes the password and forces a change at first login", async () => {
    const user = await createUser({ ...base, username: "Op.Satu", role: "OPERASI" });
    expect(user.username).toBe("op.satu");
    expect(user.mustChangePassword).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toBe(base.password);
    expect(await verifyPassword(row.passwordHash, base.password)).toBe(true);
  });

  it("rejects duplicate usernames and short passwords", async () => {
    await createUser({ ...base, username: "dupe", role: "ALKES" });
    await expect(createUser({ ...base, username: "dupe", role: "ALKES" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      createUser({ ...base, username: "short", role: "ALKES", password: "1234567" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("updateUser", () => {
  it("keeps at least one active SUPERADMIN", async () => {
    const only = await createUser({ ...base, username: "root", role: "SUPERADMIN" });
    await expect(updateUser(only.id, { isActive: false }, only.id)).rejects.toMatchObject({
      code: "LAST_SUPERADMIN",
    });
    await expect(updateUser(only.id, { role: "OPERASI" }, only.id)).rejects.toMatchObject({
      code: "LAST_SUPERADMIN",
    });

    const second = await createUser({ ...base, username: "root2", role: "SUPERADMIN" });
    expect((await updateUser(only.id, { role: "OPERASI" }, only.id)).role).toBe("OPERASI");
    await expect(updateUser(second.id, { isActive: false }, second.id)).rejects.toMatchObject({
      code: "LAST_SUPERADMIN",
    });
  });

  it("allows deactivating other users and reports unknown ids", async () => {
    const user = await createUser({ ...base, username: "alkes1", role: "ALKES" });
    const admin = await createUser({ ...base, username: "root9", role: "SUPERADMIN" });
    expect((await updateUser(user.id, { isActive: false }, admin.id)).isActive).toBe(false);
    await expect(
      updateUser("00000000-0000-0000-0000-00000000dead", { name: "x" }, admin.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("protecting other superadmins", () => {
  it("refuses role, active and password changes on another SUPERADMIN", async () => {
    const a = await createUser({ ...base, username: "root-a", role: "SUPERADMIN" });
    const b = await createUser({ ...base, username: "root-b", role: "SUPERADMIN" });
    await expect(updateUser(b.id, { role: "OPERASI" }, a.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(updateUser(b.id, { isActive: false }, a.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(updateUser(b.id, { name: "Renamed" }, a.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(resetPassword(b.id, "attacker-pass-1", a.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const row = await db.user.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.role).toBe("SUPERADMIN");
    expect(row.isActive).toBe(true);
    expect(await verifyPassword(row.passwordHash, base.password)).toBe(true);
  });

  it("lets a SUPERADMIN still manage non-admin users and reset their own password", async () => {
    const a = await createUser({ ...base, username: "root-c", role: "SUPERADMIN" });
    const op = await createUser({ ...base, username: "op-c", role: "OPERASI" });
    expect((await updateUser(op.id, { role: "STERIL" }, a.id)).role).toBe("STERIL");
    await resetPassword(a.id, "my-new-pass-1", a.id);
  });
});

describe("passwords", () => {
  it("own change clears the forced-change flag; reset sets it again", async () => {
    const user = await createUser({ ...base, username: "steril1", role: "STERIL" });
    await changeOwnPassword(user.id, base.password, "new-password-1");
    const changed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(changed.mustChangePassword).toBe(false);

    const admin = await createUser({ ...base, username: "root8", role: "SUPERADMIN" });
    await resetPassword(user.id, "admin-set-pass", admin.id);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.mustChangePassword).toBe(true);
    expect(await verifyPassword(row.passwordHash, "admin-set-pass")).toBe(true);
  });

  it("refuses a wrong current password or an unchanged one", async () => {
    const user = await createUser({ ...base, username: "op2", role: "OPERASI" });
    await expect(
      changeOwnPassword(user.id, "wrong-pass-1", "another-pass-1"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(changeOwnPassword(user.id, base.password, base.password)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
