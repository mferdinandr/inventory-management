import { NextResponse } from "next/server"
import QRCode from "qrcode"

// FR-12 (docs/02-prd.md): QR berisi URL, bukan data aset; dibuat on-demand,
// tidak disimpan sebagai berkas. Tanpa autentikasi — isinya hanya sebuah URL
// yang memang tercetak di label fisik (docs/06-api-spec.md §2).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  if (!/^[A-Za-z0-9]{6,32}$/.test(publicId)) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 })
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000"
  const url = `${appUrl}/a/${publicId}`

  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
  })

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Isinya tidak pernah berubah untuk public_id yang sama (docs/04 §6).
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
