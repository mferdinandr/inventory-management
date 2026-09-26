import Link from "next/link"
import { redirect } from "next/navigation"
import { RevertDisposalButton } from "@/components/assets/revert-disposal-button"
import { hasPermission } from "@/lib/permissions"
import { listDisposedAssets } from "@/server/services/event.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

/** FR-11: daftar aset yang masih dalam masa pembatalan 30 hari sejak dihapuskan. */
export default async function DisposedAssetsPage() {
  const user = await requireUser()
  if (!hasPermission(user.role, "asset:dispose")) redirect("/assets")
  const organizationId = await requireActiveOrg()

  const assets = await listDisposedAssets(organizationId)
  const canRevert = hasPermission(user.role, "asset:revertDisposal")

  return (
    <div className="max-w-2xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Aset Dihapuskan</h1>
        <p className="text-sm text-muted-foreground">
          Aset di bawah masih dalam masa pembatalan 30 hari dan dapat dipulihkan.
        </p>
      </header>

      {assets.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Tidak ada aset dalam masa pembatalan saat ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {assets.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm"
            >
              <div>
                <Link href={`/assets/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{a.assetCode}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{a.remainingDays} hari lagi</span>
                {canRevert ? <RevertDisposalButton assetId={a.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
