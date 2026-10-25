import type { ItemFilters, ItemSort } from "@/server/services/item.service";

export const SORT_COLUMNS: ItemSort[] = [
  "code",
  "name",
  "room",
  "note",
  "location",
  "quantity",
  "damaged",
];

/** Reads the list filters from query-string values; shared by the items page and the CSV export. */
export function parseItemFilters(get: (key: string) => string | undefined): ItemFilters {
  const location = get("location");
  const sort = get("sort");
  return {
    q: get("q") ?? "",
    location: location === "OPERASI" || location === "CSSD" ? location : undefined,
    room: get("room") || undefined,
    damaged: get("damaged") === "1",
    needsSterilization: get("needsSterilization") === "1",
    dueSoon: get("dueSoon") === "1",
    archived: get("archived") === "1",
    sort: SORT_COLUMNS.includes(sort as ItemSort) ? (sort as ItemSort) : undefined,
    dir: get("dir") === "desc" ? "desc" : "asc",
  };
}
