import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { ChangePasswordForm } from "./form";

export const metadata: Metadata = { title: t.changePassword.title };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-card shadow-xl shadow-brand-900/5">
        <div className="px-6 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              {t.changePassword.title}
            </h1>
            {user.mustChangePassword && (
              <p className="mt-2 text-sm text-muted-foreground">{t.changePassword.forced}</p>
            )}
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </section>
  );
}
