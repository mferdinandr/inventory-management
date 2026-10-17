import {
  ArrowRight,
  Boxes,
  CalendarClock,
  FlaskConical,
  Hospital,
  PackagePlus,
  PackageSearch,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Card, CardContent } from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getSummary, listRecentActivity } from "@/server/services/summary.service";
import { LinkButton } from "./items/link-button";

export const metadata: Metadata = { title: t.home.title };
// Counts change with every edit; never serve a cached page.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [summary, activity] = await Promise.all([getSummary(), listRecentActivity(10)]);
  const c = t.dashboard.cards;

  const cards = [
    {
      label: c.operasi,
      value: summary.operasi,
      href: "/items?location=OPERASI",
      icon: Hospital,
      iconClass: "bg-brand-50 text-brand-700",
      tone: "",
    },
    {
      label: c.cssd,
      value: summary.cssd,
      href: "/items?location=CSSD",
      icon: Boxes,
      iconClass: "bg-ink-100 text-ink-600",
      tone: "",
    },
    {
      label: c.needsSterilization,
      value: summary.needsSterilization,
      href: "/items?needsSterilization=1",
      icon: FlaskConical,
      iconClass:
        summary.needsSterilization > 0 ? "bg-orange-50 text-orange-700" : "bg-ink-100 text-ink-400",
      tone: "text-orange-700",
    },
    {
      label: c.damaged,
      value: summary.damaged,
      href: "/items?damaged=1",
      icon: TriangleAlert,
      iconClass: summary.damaged > 0 ? "bg-danger-50 text-danger-700" : "bg-ink-100 text-ink-400",
      tone: "text-danger-700",
    },
    {
      label: c.dueSoon,
      value: summary.dueSoon,
      href: "/items?dueSoon=1",
      icon: CalendarClock,
      iconClass: summary.dueSoon > 0 ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-400",
      tone: "text-amber-700",
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
                    <p
                      className={cn(
                        "truncate text-sm",
                        card.value > 0 ? card.tone : "text-muted-foreground",
                      )}
                    >
                      {card.label}
                    </p>
                    <p className={cn("mt-1 text-3xl font-bold", card.value > 0 ? card.tone : "")}>
                      {card.value}
                    </p>
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

      {activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t.dashboard.groupActivity}</h2>
          <ActivityTimeline entries={activity} />
        </section>
      )}
    </div>
  );
}
