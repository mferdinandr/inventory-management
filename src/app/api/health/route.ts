import { NextResponse } from "next/server";
import { db } from "@/server/db";

/** Uptime check (docs/09 §6): public, reveals nothing but whether the database answers. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
