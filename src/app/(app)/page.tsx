import type { Metadata } from "next";
import Link from "next/link";
import { ActivityTimeline } from "@/components/activity-timeline";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { getSummary, listRecentActivity, listRecentItems } from "@/server/services/summary.service";
import { formatAge } from "./items/format";
import { LinkButton } from "./items/link-button";

export const metadata: Metadata = { title: t.home.title };
// Counts change with every edit; never serve a cached page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [summary, recentItems, activity] = await Promise.all([
    getSummary(),
    listRecentItems(),
    listRecentActivity(),
  ]);
  const now = new Date();
  const c = t.dashboard.cards;
  const cards = [
    { label: c.operasi, value: summary.operasi, href: "/items?location=OPERASI", tone: "" },
    { label: c.cssd, value: summary.cssd, href: "/items?location=CSSD", tone: "" },
    {
      label: c.damaged,
      value: summary.damaged,
      href: "/items?damaged=1",
      tone: summary.damaged > 0 ? "text-red-700" : "",
    },
    {
      label: c.dueSoon,
      value: summary.dueSoon,
      href: "/items?dueSoon=1",
      tone: summary.dueSoon > 0 ? "text-amber-700" : "",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">{t.dashboard.greeting(user.name)}</h1>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/scan">{t.dashboard.scan}</LinkButton>
          {roleAllows(user.role, "item.create") && (
            <LinkButton href="/items/new" variant="secondary">
              {t.dashboard.add}
            </LinkButton>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex min-h-24 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
          >
            <span className="text-sm text-slate-600">{card.label}</span>
            <span className={`text-3xl font-bold ${card.tone}`}>{card.value}</span>
          </Link>
        ))}
        <Link
          href="/items"
          className="col-span-2 flex min-h-14 items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
        >
          <span className="text-sm text-slate-600">{c.total}</span>
          <span className="text-xl font-bold">{summary.operasi + summary.cssd}</span>
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.dashboard.recentItems}</h2>
        {recentItems.length === 0 ? (
          <p className="text-slate-600">{t.dashboard.noRecentItems}</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {recentItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.code}`}
                  className="block min-h-14 space-y-1 p-4 hover:bg-slate-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-slate-600">{item.code}</span>
                    {item.hasDamage && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {t.dashboard.damagedBadge}
                      </span>
                    )}
                  </span>
                  <span className="block font-semibold">{item.name}</span>
                  <span
                    className={`block text-sm ${item.location === "CSSD" ? "font-medium text-amber-700" : "text-slate-600"}`}
                  >
                    {t.items.locations[item.location]}
                    {item.needsSterilization &&
                      ` · ${t.dashboard.sinceIn(formatAge(item.locationSince, now), t.items.locations[item.location])}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t.dashboard.activity}</h2>
        <ActivityTimeline entries={activity} />
      </section>
    </div>
  );
}
