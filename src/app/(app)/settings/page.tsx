import Link from "next/link"

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
    description: "Struktur gedung,, lantai,, instalasi,, ruangan",
    enabled: false,
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
    description: "Undangan,, peran,, dan penugasan cakupan lokasi",
    enabled: false,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Kelola master data organisasi Anda.</p>
      </header>
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
