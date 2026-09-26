import { notFound } from "next/navigation"
import { withOrg } from "@/server/db"
import { requireActiveOrg, requireUser } from "@/server/tenant"
import { PrintLabelButton } from "./print-label-button"

// FR-13 (docs/02-prd.md §C). Tata letak cetak murni — tidak memakai app shell
// (docs/04 §3: /print adalah route top-level, bukan di bawah (app)/).
export const dynamic = "force-dynamic"

const SIZES: Record<string, { widthMm: number; heightMm: number }> = {
  "50x30": { widthMm: 50, heightMm: 30 },
  "62x29": { widthMm: 62, heightMm: 29 },
}

export default async function PrintLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ size?: string; reason?: string }>
}) {
  const { id } = await params
  const { size = "50x30", reason = "FIRST_PRINT" } = await searchParams
  await requireUser()
  const organizationId = await requireActiveOrg()

  const asset = await withOrg(organizationId, (tx) =>
    tx.asset.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        publicId: true,
        assetCode: true,
        name: true,
        location: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
  )
  if (!asset) notFound()

  const dims = SIZES[size] ?? SIZES["50x30"]!

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <div className="mb-4 print:hidden">
        <PrintLabelButton assetId={asset.id} reason={reason} labelSize={`${size}mm`} />
      </div>
      <div
        className="flex items-center gap-2 border border-black p-1 font-mono"
        style={{ width: `${dims.widthMm}mm`, height: `${dims.heightMm}mm` }}
      >
        {/* biome-ignore lint/performance/noImgElement: label cetak butuh <img> statis, bukan pipeline optimisasi next/image */}
        <img
          src={`/api/qr/${asset.publicId}`}
          alt=""
          style={{ width: `${dims.heightMm - 4}mm`, height: `${dims.heightMm - 4}mm` }}
        />
        <div className="min-w-0 flex-1 overflow-hidden text-[7px] leading-tight">
          <p className="truncate font-bold">{asset.assetCode}</p>
          <p className="truncate">{asset.name.slice(0, 24)}</p>
          <p className="truncate text-[6px]">{asset.location.name}</p>
          <p className="truncate text-[6px]">{asset.organization?.name}</p>
        </div>
      </div>
    </div>
  )
}
