import Link from "next/link"
import { QuotaMeter } from "@/components/quota-meter"
import { formatBytes } from "@/lib/format"
import { hasPermission } from "@/lib/permissions"
import { getQuotaUsage } from "@/server/quota"
import { requireActiveOrg, requireUser } from "@/server/tenant"

const LINKS = [
  {
    href: "/settings/categories",
    label: "Kategori",
    description: "Pengelompokan aset, penanda alat medis dan interval kalibrasi",
    enabled: true,
  },
  {
    href: "/settings/locations",
    label: "Lokasi",
    description: "Struktur gedung, lantai, instalasi, ruangan",
    enabled: true,
  },
  {
    href: "/settings/vendors",
    label: "Vendor",
    description: "Penyedia barang dan jasa servis/kalibrasi",
    enabled: false,
  },
  {
    href: "/settings/users",
    label: "Pengguna",
    description: "Undangan, peran, dan penugasan cakupan lokasi",
    enabled: false,
  },
]

export default async function SettingsPage() {
  const user = await requireUser()
  // FR-01c: admin organisasi melihat pemakaian kuotanya sendiri.
  const quota = hasPermission(user.role, "user:manage")
    ? await getQuotaUsage(await requireActiveOrg())
    : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola master data organisasi Anda.</p>
      </header>
      {quota ? (
        <section className="space-y-2" aria-labelledby="quota-heading">
          <h2 id="quota-heading" className="font-medium">
            Pemakaian kuota
          </h2>
          <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
            <QuotaMeter
              used={quota.usage.assets}
              quota={quota.quota.assets}
              label={`Aset: ${quota.usage.assets.toLocaleString("id-ID")} / ${quota.quota.assets.toLocaleString("id-ID")}`}
            />
            <QuotaMeter
              used={Number(quota.usage.storageBytes)}
              quota={Number(quota.quota.storageBytes)}
              label={`Penyimpanan: ${formatBytes(quota.usage.storageBytes)} / ${formatBytes(quota.quota.storageBytes)}`}
            />
            <QuotaMeter
              used={quota.usage.users}
              quota={quota.quota.users}
              label={`Pengguna: ${quota.usage.users} / ${quota.quota.users}`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Butuh batas lebih besar? Hubungi pengelola SIMASET.
          </p>
        </section>
      ) : null}
      <nav className="space-y-2" aria-label="Master data">
        {LINKS.map((link) => (
          <div key={link.href}>
            {link.enabled ? (
              <Link
                href={link.href}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/60"
              >
                <div>
                  <p className="font-medium">{link.label}</p>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </div>
              </Link>
            ) : (
              <div className="flex cursor-not-allowed items-center justify-between gap-4 rounded-lg border border-border bg-card/50 p-4 opacity-60">
                <div>
                  <p className="font-medium">{link.label}</p>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  Segera
                </span>
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}
