import { QrCode } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { t } from "@/lib/strings";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t.login.title };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next) ?? undefined;
  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-background to-brand-100 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 size-96 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-24 size-96 rounded-full bg-brand-100/60 blur-3xl"
      />

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-card shadow-2xl shadow-brand-900/10">
          <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-brand-800" />
          <div className="px-8 pb-8 pt-10 sm:px-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-600/30">
                <QrCode className="size-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.appName}</h1>
              <p className="mt-1 text-sm text-ink-500">{t.tagline}</p>
            </div>
            <LoginForm next={next} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-400">
          Ruang operasi dapat membuka halaman ini dari peramban apa pun.
        </p>
      </div>
    </main>
  );
}
