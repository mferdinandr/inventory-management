import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { ChangePasswordForm } from "./form";

export const metadata: Metadata = { title: t.changePassword.title };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <section className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">{t.changePassword.title}</h1>
      {user.mustChangePassword && <p className="text-slate-600">{t.changePassword.forced}</p>}
      <ChangePasswordForm />
    </section>
  );
}
