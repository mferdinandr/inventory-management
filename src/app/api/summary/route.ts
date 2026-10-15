import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getSummary } from "@/server/services/summary.service";

/** Counts for the Beranda (docs/06 §5). Any signed-in role. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Silakan masuk terlebih dahulu" } },
      { status: 401 },
    );
  }
  return NextResponse.json(await getSummary(), { headers: { "Cache-Control": "no-store" } });
}
