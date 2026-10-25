import { ArrowDown, ArrowUp, ArrowUpDown, Download, Plus, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
} from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { parseItemFilters } from "@/server/item-filters";
import { type ItemSort, listItems, listRooms } from "@/server/services/item.service";
import { LinkButton } from "./link-button";

export const metadata: Metadata = { title: t.items.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const FIELD = "h-11";

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = parseItemFilters((key) => first(params[key]));
  const {
    q = "",
    room = "",
    damaged = false,
    needsSterilization = false,
    archived = false,
    dueSoon = false,
    sort,
    dir = "asc",
  } = filters;
  const location = filters.location ?? "";

  const [items, rooms] = await Promise.all([listItems(filters), listRooms()]);

  /** Header link that toggles asc/desc, keeping every active filter. */
  function sortHref(col: ItemSort) {
    const nextDir = sort === col && dir === "asc" ? "desc" : "asc";
    const sp = new URLSearchParams({ sort: col, dir: nextDir });
    if (q) sp.set("q", q);
    if (location) sp.set("location", location);
    if (room) sp.set("room", room);
    if (damaged) sp.set("damaged", "1");
    if (needsSterilization) sp.set("needsSterilization", "1");
    if (dueSoon) sp.set("dueSoon", "1");
    if (archived) sp.set("archived", "1");
    return `/items?${sp.toString()}`;
  }

  /** Download link for the CSV export, carrying the filters and sort currently on screen. */
  function exportHref(type: "items" | "contents") {
    const sp = new URLSearchParams({ type });
    if (q) sp.set("q", q);
    if (location) sp.set("location", location);
    if (room) sp.set("room", room);
    if (damaged) sp.set("damaged", "1");
    if (needsSterilization) sp.set("needsSterilization", "1");
    if (dueSoon) sp.set("dueSoon", "1");
    if (archived) sp.set("archived", "1");
    if (sort) sp.set("sort", sort);
    sp.set("dir", dir);
    return `/api/items/export?${sp.toString()}`;
  }

  function SortableHeader({
    label,
    col,
    align = "left",
  }: {
    label: string;
    col: ItemSort;
    align?: "left" | "right";
  }) {
    const active = sort === col;
    const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <th
        className={cn("px-4 py-3 font-medium", align === "right" && "text-right")}
        aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}
      >
        <Link
          href={sortHref(col)}
          className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          {label}
          <Icon
            className={cn(
              "size-3.5 transition-colors",
              active ? "text-brand-600" : "text-muted-foreground group-hover:text-ink-600",
            )}
          />
        </Link>
      </th>
    );
  }

  const checks: { name: string; label: string; checked: boolean }[] = [
    { name: "damaged", label: t.items.list.damagedOnly, checked: damaged },
    {
      name: "needsSterilization",
      label: t.dashboard.cards.needsSterilization,
      checked: needsSterilization,
    },
    { name: "dueSoon", label: t.dashboard.dueSoonOnly, checked: dueSoon },
    { name: "archived", label: t.items.list.archivedOnly, checked: archived },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.items.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {(["items", "contents"] as const).map((type) => (
            <a
              key={type}
              href={exportHref(type)}
              download
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <Download className="size-4" />
              {type === "items" ? t.items.list.exportItems : t.items.list.exportContents}
            </a>
          ))}
          {roleAllows(user.role, "item.create") && (
            <LinkButton href="/items/new">
              <Plus className="size-4" />
              {t.items.add}
            </LinkButton>
          )}
        </div>
      </div>

      {/* A plain GET form: filters live in the URL, so a filtered list can be shared or reloaded. */}
      <Card>
        <CardHeader>
          <CardTitle>{t.items.list.filter}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/items" className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="q">{t.items.list.search}</Label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t.items.list.searchPlaceholder}
                className={FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t.items.list.location}</Label>
              <NativeSelect id="location" name="location" defaultValue={location} className={FIELD}>
                <option value="">{t.items.list.allLocations}</option>
                <option value="OPERASI">{t.items.locations.OPERASI}</option>
                <option value="CSSD">{t.items.locations.CSSD}</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room">{t.items.list.room}</Label>
              <NativeSelect id="room" name="room" defaultValue={room} className={FIELD}>
                <option value="">{t.items.list.allRooms}</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              {checks.map((c) => (
                <label
                  key={c.name}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm text-ink-700 transition-colors has-checked:border-brand-600 has-checked:bg-brand-50"
                >
                  <input
                    type="checkbox"
                    name={c.name}
                    value="1"
                    defaultChecked={c.checked}
                    className="size-4 accent-brand-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" className={FIELD}>
                {t.items.list.apply}
              </Button>
              <LinkButton href="/items" variant="outline" className={cn(FIELD, "px-4")}>
                <RotateCcw className="size-4" />
                {t.items.list.reset}
              </LinkButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{t.items.count(items.length)}</p>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{t.items.empty}</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-muted-foreground">
                <SortableHeader label={t.items.list.table.code} col="code" />
                <SortableHeader label={t.items.list.table.name} col="name" />
                <SortableHeader label={t.items.list.table.room} col="room" />
                <SortableHeader label={t.items.list.table.note} col="note" />
                <SortableHeader label={t.items.list.table.location} col="location" />
                <SortableHeader label={t.items.list.table.quantity} col="quantity" align="right" />
                <SortableHeader label={t.items.list.table.damaged} col="damaged" align="right" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="group relative border-b border-ink-100 transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/items/${item.code}`}
                      className="font-mono text-brand-700 after:absolute after:inset-0"
                    >
                      {item.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{item.name}</span>
                    {item.needsSterilization && (
                      <Badge className="ml-2 h-5 border-transparent bg-orange-50 px-1.5 text-[0.7rem] text-orange-700">
                        {t.dashboard.cards.needsSterilization}
                      </Badge>
                    )}
                    {item.isArchived && (
                      <Badge className="ml-2 h-5 border-transparent bg-ink-100 px-1.5 text-[0.7rem] text-ink-600">
                        {t.items.archivedBadge}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.room || "—"}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">
                    {item.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        item.location === "CSSD" ? "font-medium text-amber-700" : "text-ink-800",
                      )}
                    >
                      {t.items.locations[item.location]}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums",
                      item.damagedQuantity > 0 && "text-danger-600",
                    )}
                  >
                    {item.quantity}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right tabular-nums",
                      item.damagedQuantity > 0
                        ? "font-semibold text-danger-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.damagedQuantity > 0 ? item.damagedQuantity : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
