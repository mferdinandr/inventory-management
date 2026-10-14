import type { Metadata } from "next";
import Link from "next/link";
import { Button, Input, Label, Select } from "@/components/ui";
import { roleAllows } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { listItems, listRooms } from "@/server/services/item.service";
import { formatAge } from "./format";
import { LinkButton } from "./link-button";

export const metadata: Metadata = { title: t.items.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = first(params.q);
  const location = first(params.location);
  const room = first(params.room);
  const damaged = first(params.damaged) === "1";
  const archived = first(params.archived) === "1";

  const [items, rooms] = await Promise.all([
    listItems({
      q,
      location: location === "OPERASI" || location === "CSSD" ? location : undefined,
      room: room || undefined,
      damaged,
      archived,
    }),
    listRooms(),
  ]);
  const now = new Date();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.items.title}</h1>
        {roleAllows(user.role, "item.create") && (
          <LinkButton href="/items/new">{t.items.add}</LinkButton>
        )}
      </div>

      {/* A plain GET form: filters live in the URL, so a filtered list can be shared or reloaded. */}
      <form
        action="/items"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <div className="sm:col-span-4">
          <Label htmlFor="q">{t.items.list.search}</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t.items.list.searchPlaceholder}
          />
        </div>
        <div>
          <Label htmlFor="location">{t.items.list.location}</Label>
          <Select id="location" name="location" defaultValue={location}>
            <option value="">{t.items.list.allLocations}</option>
            <option value="OPERASI">{t.items.locations.OPERASI}</option>
            <option value="CSSD">{t.items.locations.CSSD}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="room">{t.items.list.room}</Label>
          <Select id="room" name="room" defaultValue={room}>
            <option value="">{t.items.list.allRooms}</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-11 items-center gap-2 text-base">
            <input
              type="checkbox"
              name="damaged"
              value="1"
              defaultChecked={damaged}
              className="size-5"
            />
            {t.items.list.damagedOnly}
          </label>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex min-h-11 items-center gap-2 text-base">
            <input
              type="checkbox"
              name="archived"
              value="1"
              defaultChecked={archived}
              className="size-5"
            />
            {t.items.list.archivedOnly}
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-4">
          <Button type="submit">{t.items.list.apply}</Button>
          <LinkButton href="/items" variant="secondary">
            {t.items.list.reset}
          </LinkButton>
        </div>
      </form>

      <p className="text-sm text-slate-600">{t.items.count(items.length)}</p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">
          {t.items.empty}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/items/${item.code}`}
                className="grid gap-x-4 gap-y-1 p-4 hover:bg-slate-50 sm:grid-cols-[7rem_1fr_9rem_8rem]"
              >
                <span className="font-mono text-sm text-slate-600">{item.code}</span>
                <span>
                  <span className="font-semibold">{item.name}</span>
                  {item.isArchived && (
                    <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs">
                      {t.items.archivedBadge}
                    </span>
                  )}
                  {item.room && <span className="block text-sm text-slate-600">{item.room}</span>}
                </span>
                <span className="text-sm">
                  <span
                    className={
                      item.location === "CSSD" ? "font-medium text-amber-700" : "text-slate-800"
                    }
                  >
                    {t.items.locations[item.location]}
                  </span>
                  {item.needsSterilization && (
                    <span className="block text-slate-500">
                      {formatAge(item.locationSince, now)}
                    </span>
                  )}
                </span>
                <span
                  className={`text-sm ${item.damagedQuantity > 0 ? "font-medium text-red-700" : ""}`}
                >
                  {t.items.list.quantity(item.quantity, item.damagedQuantity)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
