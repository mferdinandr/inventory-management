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
      <div className="mx-auto max-w-5xl space-y-6 p-6">
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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lokasi</h1>
          <p className="text-sm text-muted-foreground">
            Gedung → Lantai → Instalasi/Departemen → Ruangan, Aset ditempatkan pada tingkat Ruangan.
          </p>
        </div>
      </header>
      <LocationsView locations={locations} picCandidates={picCandidates} />
    </div>
  )
}
