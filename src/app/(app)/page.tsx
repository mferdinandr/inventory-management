import {
  ArrowRight,
  Boxes,
  CalendarClock,
  ChevronRight,
  Hospital,
  PackagePlus,
  PackageSearch,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
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
          <LinkButton href="/scan">
            <ScanLine className="size-4" />
            {t.dashboard.scan}
          </LinkButton>
          {roleAllows(user.role, "item.create") && (
            <LinkButton variant="outline" href="/items/new">
              <PackagePlus className="size-4" />
              {t.dashboard.add}
            </LinkButton>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

        <Link href="/items" className="col-span-2 group lg:col-span-4">
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <PackageSearch className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">{c.total}</p>
                  <p className="text-xl font-bold">{summary.operasi + summary.cssd}</p>
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t.dashboard.recentItems}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentItems.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">{t.dashboard.noRecentItems}</p>
            ) : (
              <ul className="divide-y divide-ink-200">
                {recentItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/items/${item.code}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.code}
                          </span>
                          {item.hasDamage && (
                            <Badge variant="destructive">{t.dashboard.damagedBadge}</Badge>
                          )}
                        </div>
                        <p className="truncate font-medium">{item.name}</p>
                        <p
                          className={cn(
                            "text-sm",
                            item.location === "CSSD" ? "text-amber-700" : "text-muted-foreground",
                          )}
                        >
                          {t.items.locations[item.location]}
                          {item.needsSterilization &&
                            ` · ${t.dashboard.sinceIn(
                              formatAge(item.locationSince, now),
                              t.items.locations[item.location],
                            )}`}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.dashboard.activity}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline entries={activity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
