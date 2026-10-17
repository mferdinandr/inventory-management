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
          <div className="px-8 pb-8 pt-10 sm:px-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.appName}</h1>
              <p className="mt-1 text-sm text-ink-500">{t.tagline}</p>
            </div>
            <LoginForm next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
