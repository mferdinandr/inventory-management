import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Hospital,
  PackagePlus,
  PackageSearch,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ItemListCard } from "@/components/item-list-card";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import {
  getSummary,
  listDueSoon,
  listNeedsSterilization,
  listRecentActivity,
  listRecentItems,
} from "@/server/services/summary.service";
import { formatAge } from "./items/format";
import { LinkButton } from "./items/link-button";

export const metadata: Metadata = { title: t.home.title };
// Counts change with every edit; never serve a cached page.
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/** Whole calendar days from `now` until `nextDue` (midnight in the hospital's timezone). */
function daysUntil(nextDue: Date, now: Date): number {
  const jakarta = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  const day = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  return Math.round((day(jakarta(nextDue)) - day(jakarta(now))) / DAY_MS);
}

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();
  const [summary, recentItems, needsSterilization, dueSoon, activity] = await Promise.all([
    getSummary(),
    listRecentItems(6),
    listNeedsSterilization(6),
    listDueSoon(now, 6),
    listRecentActivity(10),
  ]);
  const c = t.dashboard.cards;

  const cards = [
    {
      label: c.operasi,
      value: summary.operasi,
      href: "/items?location=OPERASI",
      icon: Hospital,
      iconClass: "bg-brand-50 text-brand-700",
    },
    {
      label: c.cssd,
      value: summary.cssd,
      href: "/items?location=CSSD",
      icon: Boxes,
      iconClass: "bg-ink-100 text-ink-600",
    },
    {
      label: c.damaged,
      value: summary.damaged,
      href: "/items?damaged=1",
      icon: TriangleAlert,
      iconClass: summary.damaged > 0 ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-400",
    },
    {
      label: c.dueSoon,
      value: summary.dueSoon,
      href: "/items?dueSoon=1",
      icon: CalendarClock,
      iconClass: summary.dueSoon > 0 ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-400",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.dashboard.greeting(user.name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.roles[user.role]} · {t.tagline}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton variant="outline" href="/scan">
            <ScanLine className="size-4" />
            {t.dashboard.scan}
          </LinkButton>
          {roleAllows(user.role, "item.create") && (
            <LinkButton href="/items/new">
              <PackagePlus className="size-4" />
              {t.dashboard.add}
            </LinkButton>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.dashboard.groupCounts}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <Link href="/items" className="group sm:col-span-2 lg:col-span-2">
            <Card className="border-0 bg-brand-700 text-white shadow-lg transition-colors hover:bg-brand-800">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <span className="rounded-xl bg-white/10 p-3">
                    <PackageSearch className="size-6" />
                  </span>
                  <div>
                    <p className="text-sm text-brand-100">{c.total}</p>
                    <p className="text-3xl font-bold">{summary.operasi + summary.cssd}</p>
                  </div>
                </div>
                <ArrowRight className="size-5 text-brand-200 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>

          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="group">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-3xl font-bold">{card.value}</p>
                  </div>
                  <span className={cn("rounded-lg p-2", card.iconClass)}>
                    <card.icon className="size-5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.dashboard.groupActivity}</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <ItemListCard
            title={t.dashboard.recentItems}
            emptyText={t.dashboard.noRecentItems}
            items={recentItems.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              badge: item.hasDamage ? (
                <Badge variant="destructive">{t.dashboard.damagedBadge}</Badge>
              ) : undefined,
            }))}
            hrefFor={(item) => `/items/${item.code}`}
            meta={(item) => {
              const row = recentItems.find((i) => i.id === item.id);
              if (!row) return null;
              const place = t.items.locations[row.location];
              return (
                <span
                  className={row.location === "CSSD" ? "font-medium text-amber-700" : undefined}
                >
                  {place}
                  {row.needsSterilization &&
                    ` · ${t.dashboard.sinceIn(formatAge(row.locationSince, now), place)}`}
                </span>
              );
            }}
          />

          <ItemListCard
            title={t.dashboard.needsSterilization}
            emptyText={t.dashboard.noNeedsSterilization}
            items={needsSterilization.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
            }))}
            hrefFor={(item) => `/items/${item.code}`}
            meta={(item) => {
              const row = needsSterilization.find((i) => i.id === item.id);
              if (!row) return null;
              const place = t.items.locations[row.location];
              return (
                <>
                  {place}
                  {` · ${t.dashboard.sinceIn(formatAge(row.locationSince, now), place)}`}
                </>
              );
            }}
          />

          <ItemListCard
            title={t.dashboard.dueSoonList}
            emptyText={t.dashboard.noDueSoon}
            items={dueSoon.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
            hrefFor={(item) => `/items/${item.code}`}
            meta={(item) => {
              const row = dueSoon.find((i) => i.id === item.id);
              if (!row) return null;
              const days = daysUntil(row.nextDue, now);
              return (
                <>
                  {t.maintenance.types[row.type]} ·{" "}
                  <span className={days < 0 ? "font-medium text-danger-700" : undefined}>
                    {days < 0 ? t.dashboard.daysOverdue(-days) : t.dashboard.daysLeft(days)}
                  </span>
                </>
              );
            }}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.activity}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline entries={activity} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
