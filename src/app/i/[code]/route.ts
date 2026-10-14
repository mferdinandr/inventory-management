import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";

/** QR target (docs/04 §5.1): signed-in goes to the item, signed-out logs in and comes back. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = `/items/${encodeURIComponent(code)}`;
  const user = await getCurrentUser();
  const path = user ? target : `/login?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(new URL(path, request.url));
}
