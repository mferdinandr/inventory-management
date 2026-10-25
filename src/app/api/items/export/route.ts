import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { parseItemFilters } from "@/server/item-filters";
import { exportContentsCsv, exportItemsCsv } from "@/server/services/export.service";

/**
 * CSV download of the item list (`type=items`, default) or of the content lines of those items
 * (`type=contents`). Takes the same filters as the items screen. Any signed-in role.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Silakan masuk terlebih dahulu" } },
      { status: 401 },
    );
  }

  const params = new URL(request.url).searchParams;
  const contents = params.get("type") === "contents";
  const filters = parseItemFilters((key) => params.get(key) ?? undefined);
  const csv = contents ? await exportContentsCsv(filters) : await exportItemsCsv(filters);

  const day = new Date().toISOString().slice(0, 10);
  const name = `simaset-${contents ? "isi-wadah" : "barang"}-${day}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
