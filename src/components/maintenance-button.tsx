import Link from "next/link";
import { t } from "@/lib/strings";

/** Link to the new-maintenance form; for the item detail page, shown to every role. */
export function MaintenanceButton({ code }: { code: string }) {
  return (
    <Link
      href={`/items/${encodeURIComponent(code)}/maintenance/new`}
      className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 py-2 text-base font-medium text-white hover:bg-teal-800"
    >
      {t.maintenance.add}
    </Link>
  );
}
