import { VendorFormDialog } from "@/components/vendors/vendor-form"
import { VendorTable } from "@/components/vendors/vendor-table"
import { hasPermission } from "@/lib/permissions"
import { listVendors } from "@/server/services/vendor.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

/** FR-04 (v1.1): vendor penyedia barang, servis, dan kalibrasi. */
export default async function VendorsPage() {
  const user = await requireUser()
  const organizationId = await requireActiveOrg()
  const canManage = hasPermission(user.role, "master:manage")

  const vendors = await listVendors(organizationId)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Vendor</h1>
          <p className="text-sm text-muted-foreground">
            Penyedia barang, servis/perbaikan, dan kalibrasi.
          </p>
        </div>
        {canManage ? <VendorFormDialog mode="create" /> : null}
      </header>

      {vendors.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Belum ada vendor terdaftar.
        </p>
      ) : (
        <VendorTable vendors={vendors} canManage={canManage} />
      )}
    </div>
  )
}
