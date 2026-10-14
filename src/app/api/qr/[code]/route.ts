import { NextResponse } from "next/server";
import { normalizeItemCode } from "@/lib/item-code";
import { getCurrentUser } from "@/server/auth/session";
import { qrSvg } from "@/server/qr";
import { findItemByCode } from "@/server/services/item-lookup";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

/** SVG QR for an item (docs/06 §6). Any signed-in role. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return fail(401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu");
  }

  const { searchParams } = new URL(request.url);
  if ((searchParams.get("format") ?? "svg") !== "svg") {
    return fail(422, "VALIDATION_ERROR", "Hanya format svg yang tersedia");
  }
  const size = Number(searchParams.get("size") ?? 512);
  if (!Number.isInteger(size) || size < 64 || size > 2048) {
    return fail(422, "VALIDATION_ERROR", "Ukuran harus 64 sampai 2048");
  }

  const code = normalizeItemCode((await params).code);
  const item = code ? await findItemByCode(code) : null;
  if (!item) return fail(404, "NOT_FOUND", "Barang tidak ditemukan");

  return new Response(await qrSvg(item.code, size), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" },
  });
}
