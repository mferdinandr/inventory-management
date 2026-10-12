import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: t.home.title };

export default async function HomePage() {
  const user = await requireUser();
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">{t.home.title}</h1>
      <p>{t.home.welcome(user.name, t.roles[user.role])}</p>
      <p className="text-slate-600">{t.home.soon}</p>
    </section>
  );
}
