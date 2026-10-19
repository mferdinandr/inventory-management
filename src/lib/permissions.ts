export type Role = "OPERASI" | "STERIL" | "ALKES" | "SUPERADMIN";
export type Location = "OPERASI" | "CSSD";

export type Action =
  | "item.create"
  | "item.editDetails"
  | "item.editContents"
  | "item.send"
  | "item.return"
  | "item.archive"
  | "label.print"
  | "maintenance.create"
  | "user.manage";

/** The facts about an item that decide whether an action is allowed. */
export type ItemState = { location: Location; needsSterilization: boolean };

/** Roles that may ever perform an action, regardless of where the item is. */
const ROLES: Record<Action, readonly Role[]> = {
  "item.create": ["OPERASI", "SUPERADMIN"],
  "item.editDetails": ["OPERASI", "SUPERADMIN"],
  "item.editContents": ["OPERASI", "STERIL", "SUPERADMIN"],
  "item.send": ["OPERASI", "SUPERADMIN"],
  "item.return": ["STERIL", "SUPERADMIN"],
  "item.archive": ["OPERASI", "SUPERADMIN"],
  "label.print": ["OPERASI", "SUPERADMIN"],
  "maintenance.create": ["OPERASI", "STERIL", "ALKES", "SUPERADMIN"],
  "user.manage": ["SUPERADMIN"],
};

/** Coarse check used to show or hide controls: does this role ever get this action? */
export function roleAllows(role: Role, action: Action): boolean {
  return ROLES[action].includes(role);
}

/**
 * Full check: role plus where the item currently is. A `false` here means the action is
 * forbidden for this role on this item (HTTP 403). Whether the item is in the right place
 * for send/return (HTTP 409) is the flow service's business.
 */
export function can(role: Role, action: Action, item?: ItemState): boolean {
  if (!roleAllows(role, action)) return false;
  if (role === "SUPERADMIN" || !item) return true;

  switch (action) {
    case "item.editDetails":
    case "item.archive":
      // OPERASI works on items anywhere except while they are at CSSD.
      return item.location !== "CSSD";
    case "item.editContents":
      // OPERASI edits outside CSSD, STERIL edits only inside CSSD.
      return role === "STERIL" ? item.location === "CSSD" : item.location !== "CSSD";
    default:
      return true;
  }
}
