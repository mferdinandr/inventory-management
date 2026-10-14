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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-800">{t.appName}</h1>
      <p className="mb-6 mt-1 text-slate-600">{t.tagline}</p>
      <LoginForm next={next} />
    </main>
  );
}
