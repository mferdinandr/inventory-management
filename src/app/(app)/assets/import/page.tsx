import { redirect } from "next/navigation"
import { hasPermission } from "@/lib/permissions"
import { requireUser } from "@/server/tenant"
import { ImportWizard } from "./import-wizard"

export const dynamic = "force-dynamic"

/** FR-29: impor massal aset dari Excel/CSV. */
export default async function ImportAssetsPage() {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:import")) redirect("/assets")

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Impor Aset</h1>
        <p className="text-sm text-muted-foreground">
          Daftarkan banyak aset sekaligus dari berkas Excel atau CSV.
        </p>
      </header>
      <ImportWizard />
    </div>
  )
}
