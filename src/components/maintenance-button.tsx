import { Wrench } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/strings";

/** Link to the new-maintenance form; for the item detail page, shown to every role. */
export function MaintenanceButton({ code }: { code: string }) {
  return (
    <Link
      href={`/items/${encodeURIComponent(code)}/maintenance/new`}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/80"
    >
      <Wrench className="size-4" />
      {t.maintenance.add}
    </Link>
  );
}
