import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { buildImportTemplate } from "@/server/import/xlsx-template";

/** Empty Excel template for the import on the new item page. Roles that may register items. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !can(user.role, "item.create")) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Peran Anda tidak berwenang" } },
      { status: 403 },
    );
  }
  return new NextResponse(new Uint8Array(await buildImportTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-impor-simaset.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
