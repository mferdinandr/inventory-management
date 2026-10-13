import { describe, expect, it } from "vitest";
import { type Action, can, type ItemState, type Role, roleAllows } from "@/lib/permissions";

const atOperasi: ItemState = { location: "OPERASI", needsSterilization: true };
const atCssd: ItemState = { location: "CSSD", needsSterilization: true };
const bigEquipment: ItemState = { location: "OPERASI", needsSterilization: false };

describe("permissions matrix (docs/07)", () => {
  it("only OPERASI and SUPERADMIN register items", () => {
    expect(roleAllows("OPERASI", "item.create")).toBe(true);
    expect(roleAllows("SUPERADMIN", "item.create")).toBe(true);
    expect(roleAllows("STERIL", "item.create")).toBe(false);
    expect(roleAllows("ALKES", "item.create")).toBe(false);
  });

  it("every role may record maintenance", () => {
    for (const role of ["OPERASI", "STERIL", "ALKES", "SUPERADMIN"] as Role[]) {
      expect(can(role, "maintenance.create", atCssd)).toBe(true);
      expect(can(role, "maintenance.create", bigEquipment)).toBe(true);
    }
  });

  it("only SUPERADMIN manages users", () => {
    expect(can("SUPERADMIN", "user.manage")).toBe(true);
    for (const role of ["OPERASI", "STERIL", "ALKES"] as Role[]) {
      expect(can(role, "user.manage")).toBe(false);
    }
  });

  it("ALKES can only maintain: every other action is denied", () => {
    const others: Action[] = [
      "item.create",
      "item.editDetails",
      "item.editContents",
      "item.send",
      "item.return",
      "item.archive",
      "label.print",
      "user.manage",
    ];
    for (const action of others) expect(can("ALKES", action, atOperasi)).toBe(false);
  });

  it("OPERASI edits items outside CSSD, including big equipment", () => {
    expect(can("OPERASI", "item.editDetails", atOperasi)).toBe(true);
    expect(can("OPERASI", "item.editContents", bigEquipment)).toBe(true);
    expect(can("OPERASI", "item.editDetails", atCssd)).toBe(false);
    expect(can("OPERASI", "item.editContents", atCssd)).toBe(false);
  });

  it("STERIL edits contents only while the item is at CSSD, never its details", () => {
    expect(can("STERIL", "item.editContents", atCssd)).toBe(true);
    expect(can("STERIL", "item.editContents", atOperasi)).toBe(false);
    expect(can("STERIL", "item.editDetails", atCssd)).toBe(false);
  });

  it("send belongs to OPERASI, return to STERIL", () => {
    expect(can("OPERASI", "item.send", atOperasi)).toBe(true);
    expect(can("STERIL", "item.send", atOperasi)).toBe(false);
    expect(can("STERIL", "item.return", atCssd)).toBe(true);
    expect(can("OPERASI", "item.return", atCssd)).toBe(false);
  });

  it("SUPERADMIN may do everything anywhere", () => {
    for (const state of [atOperasi, atCssd, bigEquipment]) {
      expect(can("SUPERADMIN", "item.editContents", state)).toBe(true);
      expect(can("SUPERADMIN", "item.editDetails", state)).toBe(true);
    }
  });
});
