import { ReturnDialog } from "@/components/loans/return-dialog"
import { hasPermission } from "@/lib/permissions"
import { listActiveLoans } from "@/server/services/loan.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

export const dynamic = "force-dynamic"

/** FR-20: seluruh peminjaman aktif, dengan penanda lewat jatuh tempo / ambang tanpa jatuh tempo. */
export default async function LoansPage() {
  const user = await requireUser()
  const organizationId = await requireActiveOrg()
  const canManage = hasPermission(user.role, "loan:manage")
  const canViewContact = hasPermission(user.role, "loan:viewContact")

  const loans = await listActiveLoans(organizationId)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Peminjaman</h1>
        <p className="text-sm text-muted-foreground">Seluruh peminjaman aset yang masih aktif.</p>
      </header>

      {loans.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Tidak ada peminjaman aktif saat ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Aset</th>
                <th className="px-3 py-2">Peminjam</th>
                <th className="px-3 py-2">Keperluan</th>
                <th className="px-3 py-2">Lama pinjam</th>
                <th className="px-3 py-2">Jatuh tempo</th>
                {canManage ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{l.assetCode}</span>
                    <p className="text-xs text-muted-foreground">{l.assetName}</p>
                  </td>
                  <td className="px-3 py-2">
                    {l.borrowerLabel}
                    {canViewContact && l.borrowerPhone ? (
                      <p className="text-xs text-muted-foreground">{l.borrowerPhone}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{l.purpose}</td>
                  <td className="px-3 py-2">
                    {l.daysOnLoan} hari
                    {l.isOverdue ? (
                      <span className="ml-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Terlambat
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {l.dueAt ? new Date(l.dueAt).toLocaleString("id-ID") : "—"}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      <ReturnDialog loanId={l.id} assetId={l.assetId} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
