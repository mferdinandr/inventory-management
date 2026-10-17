import { Badge } from "@/components/ui";
import type { Role } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";

const roleColors: Record<Role, string> = {
  SUPERADMIN: "bg-danger-50 text-danger-700",
  OPERASI: "bg-brand-50 text-brand-700",
  STERIL: "bg-amber-50 text-amber-700",
  ALKES: "bg-sky-50 text-sky-700",
};

/** Badge showing the role label with a distinct color per role. */
export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={cn("border-transparent", roleColors[role])}>{t.roles[role]}</Badge>;
}
