import type { OrganizationStatus } from "../../../generated/prisma/enums"

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  TRIAL: "Uji coba",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
}
