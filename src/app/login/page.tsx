import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { t } from "@/lib/strings";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t.login.title };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="text-3xl font-bold text-teal-800">{t.appName}</h1>
      <p className="mb-6 mt-1 text-slate-600">{t.tagline}</p>
      <LoginForm />
    </main>
  );
}
