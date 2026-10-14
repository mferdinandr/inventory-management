import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: t.scan.title };

export default async function ScanPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t.scan.title}</h1>
      <Scanner />
    </div>
  );
}
