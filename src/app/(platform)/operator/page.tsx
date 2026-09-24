import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { QuotaMeter } from "@/components/operator/quota-meter"
import { OrganizationStatusBadge } from "@/components/operator/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBytes } from "@/lib/format"
import { listOrganizations } from "@/server/services/operator.service"
import { requirePlatformOwner } from "@/server/tenant"

export const dynamic = "force-dynamic"

export default async function OperatorPage() {
  await requirePlatformOwner()
  const organizations = await listOrganizations()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Organisasi Pelanggan</h1>
          <p className="text-sm text-muted-foreground">
            Pemakaian kuota aset, penyimpanan, dan pengguna tiap rumah sakit.
          </p>
        </div>
        <Link href="/operator/new" className={buttonVariants({ size: "sm" })}>
          <PlusIcon />
          Buat Organisasi
        </Link>
      </header>

      {organizations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Belum ada organisasi pelanggan.</p>
          <p className="text-sm text-muted-foreground">
            Buat organisasi pertama; undangan Super Admin-nya dikirim lewat email.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aset</TableHead>
                <TableHead>Penyimpanan</TableHead>
                <TableHead>Pengguna</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <Link href={`/operator/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {org.code} · {org.timezone}
                    </p>
                  </TableCell>
                  <TableCell>
                    <OrganizationStatusBadge status={org.status} />
                  </TableCell>
                  <TableCell>
                    <QuotaMeter
                      used={org.usage.assets}
                      quota={org.quota.assets}
                      label={`${org.usage.assets.toLocaleString("id-ID")} / ${org.quota.assets.toLocaleString("id-ID")}`}
                    />
                  </TableCell>
                  <TableCell>
                    <QuotaMeter
                      used={Number(org.usage.storageBytes)}
                      quota={Number(org.quota.storageBytes)}
                      label={`${formatBytes(org.usage.storageBytes)} / ${formatBytes(org.quota.storageBytes)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <QuotaMeter
                      used={org.usage.users}
                      quota={org.quota.users}
                      label={`${org.usage.users} / ${org.quota.users}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
