import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ImpersonateDialog, ResendInviteButton } from "@/components/operator/organization-actions"
import { UpdateOrganizationForm } from "@/components/operator/organization-form"
import { OrganizationStatusBadge } from "@/components/operator/status-badge"
import { QuotaMeter } from "@/components/quota-meter"
import { Badge } from "@/components/ui/badge"
import { formatBytes } from "@/lib/format"
import { GB, organizationIdSchema } from "@/lib/validators/organization"
import { getOrganization } from "@/server/services/operator.service"
import { requirePlatformOwner } from "@/server/tenant"

export const dynamic = "force-dynamic"

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ invite?: string }>
}) {
  await requirePlatformOwner()
  const { orgId } = await params
  const { invite } = await searchParams
  const parsed = organizationIdSchema.safeParse({ id: orgId })
  if (!parsed.success) notFound()
  const org = await getOrganization(parsed.data.id)
  if (!org) notFound()

  const created = org.createdAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: org.timezone,
  })

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/operator"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Organisasi
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{org.name}</h1>
              <OrganizationStatusBadge status={org.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {org.code} · {org.timezone} · dibuat {created}
              {org.showGovernmentFields ? "" : " · RS swasta"}
            </p>
          </div>
          <ImpersonateDialog organizationId={org.id} organizationName={org.name} />
        </div>
      </header>

      {invite === "sent" ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          Organisasi dibuat dan undangan Super Admin terkirim.
        </p>
      ) : null}
      {invite === "failed" ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Organisasi dibuat, tetapi email undangan gagal terkirim. Periksa konfigurasi SMTP, lalu
          kirim ulang undangan di bawah.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-medium">Pemakaian</h2>
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
          <QuotaMeter
            used={org.usage.assets}
            quota={org.quota.assets}
            label={`Aset: ${org.usage.assets.toLocaleString("id-ID")} / ${org.quota.assets.toLocaleString("id-ID")}`}
          />
          <QuotaMeter
            used={Number(org.usage.storageBytes)}
            quota={Number(org.quota.storageBytes)}
            label={`Penyimpanan: ${formatBytes(org.usage.storageBytes)} / ${formatBytes(org.quota.storageBytes)}`}
          />
          <QuotaMeter
            used={org.usage.users}
            quota={org.quota.users}
            label={`Pengguna: ${org.usage.users} / ${org.quota.users}`}
          />
        </div>
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="font-medium">Status, kuota, dan narahubung</h2>
        <UpdateOrganizationForm
          organizationId={org.id}
          values={{
            status: org.status,
            quotaAssets: org.quota.assets,
            quotaStorageGb: Number(org.quota.storageBytes / BigInt(GB)),
            quotaUsers: org.quota.users,
            contactName: org.contact.name,
            contactEmail: org.contact.email,
            contactPhone: org.contact.phone,
          }}
        />
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="font-medium">Super Admin</h2>
        {org.admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada Super Admin.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {org.admins.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{admin.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                </div>
                {admin.status === "INVITED" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Belum menerima undangan</Badge>
                    <ResendInviteButton organizationId={org.id} userId={admin.id} />
                  </div>
                ) : (
                  <Badge variant={admin.status === "ACTIVE" ? "secondary" : "destructive"}>
                    {admin.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
