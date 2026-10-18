import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Button,
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
import { listItems, listRooms } from "@/server/services/item.service";
import { LinkButton } from "./link-button";

export const metadata: Metadata = { title: t.items.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const FIELD = "h-11";

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = first(params.q);
  const location = first(params.location);
  const room = first(params.room);
  const damaged = first(params.damaged) === "1";
  const needsSterilization = first(params.needsSterilization) === "1";
  const archived = first(params.archived) === "1";
  const dueSoon = first(params.dueSoon) === "1";

  const [items, rooms] = await Promise.all([
    listItems({
      q,
      location: location === "OPERASI" || location === "CSSD" ? location : undefined,
      room: room || undefined,
      damaged,
      needsSterilization,
      dueSoon,
      archived,
    }),
    listRooms(),
  ]);

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
        {roleAllows(user.role, "item.create") && (
          <LinkButton href="/items/new">{t.items.add}</LinkButton>
        )}
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
              <LinkButton href="/items" variant="outline" className={FIELD}>
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
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/items/${item.code}`} className="block">
                <Card className="p-4 transition-colors hover:border-primary/50">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-mono text-sm text-muted-foreground">{item.code}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      {item.room && <p className="text-sm text-muted-foreground">{item.room}</p>}
                    </div>
                    <Badge
                      className={cn(
                        "border-transparent",
                        item.location === "CSSD"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-brand-50 text-brand-700",
                      )}
                    >
                      {t.items.locations[item.location]}
                    </Badge>
                    {item.needsSterilization && (
                      <Badge className="border-transparent bg-orange-50 text-orange-700">
                        {t.dashboard.cards.needsSterilization}
                      </Badge>
                    )}
                    {item.damagedQuantity > 0 && (
                      <Badge className="border-transparent bg-danger-50 text-danger-700">
                        {t.dashboard.cards.damaged}
                      </Badge>
                    )}
                    {item.isArchived && (
                      <Badge className="border-transparent bg-ink-100 text-ink-600">
                        {t.items.archivedBadge}
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        item.damagedQuantity > 0 ? "text-danger-600" : "text-ink-900",
                      )}
                    >
                      {t.items.list.quantity(item.quantity, item.damagedQuantity)}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
