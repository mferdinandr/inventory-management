import { Badge } from "@/components/ui/badge"
import type { OrganizationStatus } from "../../../generated/prisma/enums"
import { ORGANIZATION_STATUS_LABELS } from "./labels"

const VARIANTS = {
  ACTIVE: "default",
  TRIAL: "outline",
  SUSPENDED: "destructive",
} as const

export function OrganizationStatusBadge({ status }: { status: OrganizationStatus }) {
  return <Badge variant={VARIANTS[status]}>{ORGANIZATION_STATUS_LABELS[status]}</Badge>
}
