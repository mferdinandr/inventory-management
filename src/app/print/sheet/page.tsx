import { withOrg } from "@/server/db"
import { requireActiveOrg, requireUser } from "@/server/tenant"
import { PrintSheetButton } from "./print-sheet-button"

// FR-13: lembar A4, 3 kolom x 8 baris (24 label per lembar).
export const dynamic = "force-dynamic"

export default async function PrintSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  await requireUser()
  const organizationId = await requireActiveOrg()
  const idList = (ids ?? "").split(",").filter(Boolean)

  const assets =
    idList.length === 0
      ? []
      : await withOrg(organizationId, (tx) =>
          tx.asset.findMany({
            where: { id: { in: idList }, organizationId },
            select: {
              id: true,
              publicId: true,
              assetCode: true,
              name: true,
              location: { select: { name: true } },
            },
          }),
        )

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="mb-4 print:hidden">
        <PrintSheetButton assetIds={assets.map((a) => a.id)} />
        {assets.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Tidak ada aset dipilih. Tambahkan <code>?ids=id1,id2,…</code> pada URL.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-[2mm]">
        {assets.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-1 overflow-hidden border border-black p-1 font-mono"
            style={{ width: "62mm", height: "29mm" }}
          >
            {/* biome-ignore lint/performance/noImgElement: label cetak butuh <img> statis */}
            <img src={`/api/qr/${a.publicId}`} alt="" style={{ width: "25mm", height: "25mm" }} />
            <div className="min-w-0 flex-1 text-[7px] leading-tight">
              <p className="truncate font-bold">{a.assetCode}</p>
              <p className="truncate">{a.name.slice(0, 24)}</p>
              <p className="truncate text-[6px]">{a.location.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
