import { hasPermission } from "@/lib/permissions"
import { listLocations, listPicCandidates } from "@/server/services/location.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"
import { LocationsView } from "./locations-view"

export const dynamic = "force-dynamic"

export default async function LocationsPage() {
  const user = await requireUser()
  const organizationId = await requireActiveOrg()

  if (!hasPermission(user.role, "master:manage")) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Halaman ini hanya dapat diakses oleh Admin atau Super Admin organisasi.
        </div>
      </div>
    )
  }

  const [locations, picCandidates] = await Promise.all([
    listLocations(organizationId),
    listPicCandidates(organizationId),
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Lokasi</h1>
          <p className="text-sm text-muted-foreground">
            Gedung → Lantai → Instalasi/Departemen → Ruangan. Aset ditempatkan pada tingkat Ruangan.
          </p>
        </div>
      </header>
      <LocationsView locations={locations} picCandidates={picCandidates} />
    </div>
  )
}
