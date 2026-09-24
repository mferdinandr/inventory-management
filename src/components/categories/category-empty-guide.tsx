import { InfoIcon } from "lucide-react"

const MEDIS_EXAMPLES = [
  { name: "Elektromedik", interval: 12 },
  { name: "Alat Penunjang Medis", interval: 12 },
]

const NON_MEDIS_EXAMPLES = ["Furnitur", "Perangkat IT", "Kendaraan"]

/**
 * FR-03 (docs/02-prd.md): halaman kategori kosong menampilkan panduan singkat
 * beserta contoh pengelompokan yang lazim di rumah sakit — sebagai penjelasan di
 * layar,, **bukan** tombol yang mengisinya. Pelanggan baru tidak dapat mendaftarkan
 * aset sebelum membuat kategori pertamanya,, jadi panduan ini penahan onboarding.

 */
export function CategoryEmptyGuide({ canManage }: { canManage: boolean }) {
  const nonMedisLabel = `${NON_MEDIS_EXAMPLES.slice(0, -1).join(", ")} dan ${NON_MEDIS_EXAMPLES[NON_MEDIS_EXAMPLES.length - 1]}`

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-6">
      <div className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <InfoIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          <div>
            <h2 className="font-medium">Belum ada kategori</h2>
            <p className="text-sm text-muted-foreground">
              Setiap rumah sakit menyusun pengelompokan asetnya sendiri. Buat kategori pertama
              sebelum mendaftarkan aset — aset wajib memilih satu kategori.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-sm">
            <p className="font-medium">Contoh pengelompokan yang lazim di rumah sakit:</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              {MEDIS_EXAMPLES.map((ex) => (
                <li key={ex.name}>
                  <span className="font-medium text-foreground">{ex.name}</span> — alat medis,
                  kalibrasi tiap {ex.interval} bulan
                </li>
              ))}
              <li>
                <span className="font-medium text-foreground">{nonMedisLabel}</span> — non-medis,
                tanpa kalibrasi
              </li>
            </ul>
          </div>
          {canManage ? (
            <p className="text-sm text-muted-foreground">
              Mulai dengan menekan tombol{" "}
              <span className="font-medium text-foreground">Tambah Kategori</span> di kanan atas.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
