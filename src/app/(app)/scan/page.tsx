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
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-card shadow-2xl shadow-brand-900/10">
        <div className="px-6 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
          <Scanner />
        </div>
      </div>
    </div>
  );
}
