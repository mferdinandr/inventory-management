"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { t } from "@/lib/strings";

export type ContentRow = {
  id?: string;
  name: string;
  brand: string;
  quantity: number;
  damagedQuantity: number;
  note: string;
};

/** Editing state: numbers stay strings so a field can be empty while typing. */
type Draft = {
  key: string;
  id?: string;
  name: string;
  brand: string;
  quantity: string;
  damagedQuantity: string;
  note: string;
};

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

let nextKey = 0;
const newKey = () => `row-${nextKey++}`;

const toDraft = (r: ContentRow): Draft => ({
  key: newKey(),
  id: r.id,
  name: r.name,
  brand: r.brand,
  quantity: String(r.quantity),
  damagedQuantity: String(r.damagedQuantity),
  note: r.note,
});

/**
 * Edits a container's contents and posts them as one JSON field named `contents`.
 *
 * Built for long lists: the search box only hides rows (nothing is removed), the quick-add
 * line adds a row with Enter and keeps the cursor there, and new rows go to the top so they
 * are never lost below the fold. `restricted` is for steril staff: existing rows keep their
 * name and brand and cannot be removed, but counts and notes are editable and rows can be added.
 */
export function ContentsEditor({
  initial,
  restricted = false,
}: {
  initial: ContentRow[];
  restricted?: boolean;
}) {
  const [rows, setRows] = useState<Draft[]>(() => initial.map(toDraft));
  const [filter, setFilter] = useState("");
  const [quick, setQuick] = useState({ name: "", quantity: "1" });
  const [focusKey, setFocusKey] = useState<string>();
  const quickName = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus a freshly added row once it has rendered.
  useEffect(() => {
    if (!focusKey) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-row="${focusKey}"] input`)?.focus();
    setFocusKey(undefined);
  }, [focusKey]);

  const serialized = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.name.trim() !== "")
          .map((r) => ({
            id: r.id,
            name: r.name,
            brand: r.brand,
            quantity: num(r.quantity),
            damagedQuantity: num(r.damagedQuantity),
            note: r.note,
          })),
      ),
    [rows],
  );

  const needle = filter.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      needle === "" ||
      r.name === "" ||
      r.name.toLowerCase().includes(needle) ||
      r.brand.toLowerCase().includes(needle),
  );

  const update = (key: string, patch: Partial<Draft>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addQuick() {
    const name = quick.name.trim();
    if (name === "") return;
    setRows((all) => [
      {
        key: newKey(),
        name,
        brand: "",
        quantity: quick.quantity || "1",
        damagedQuantity: "0",
        note: "",
      },
      ...all,
    ]);
    setQuick({ name: "", quantity: quick.quantity || "1" });
    quickName.current?.focus();
  }

  function addBlank() {
    const key = newKey();
    setFilter("");
    setRows((all) => [
      { key, name: "", brand: "", quantity: "1", damagedQuantity: "0", note: "" },
      ...all,
    ]);
    setFocusKey(key);
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="contents" value={serialized} />
      {restricted && <p className="text-sm text-slate-600">{t.items.contents.restricted}</p>}

      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
        <p className="mb-2 text-sm font-medium text-teal-900">{t.items.contents.quickAdd}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Input
              ref={quickName}
              aria-label={t.items.contents.name}
              placeholder={t.items.contents.name}
              value={quick.name}
              onChange={(e) => setQuick({ ...quick, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuick();
                }
              }}
            />
          </div>
          <div className="w-24">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label={t.items.contents.quantity}
              value={quick.quantity}
              onChange={(e) => setQuick({ ...quick, quantity: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuick();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={addQuick}>
            {t.items.contents.addRow}
          </Button>
        </div>
        <p className="mt-2 text-xs text-teal-900/80">{t.items.contents.quickAddHint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <Input
            type="search"
            aria-label={t.items.contents.search}
            placeholder={t.items.contents.searchPlaceholder}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <span className="text-sm text-slate-600">
          {t.items.contents.rows(visible.length, rows.length)}
        </span>
        <Button type="button" variant="outline" onClick={addBlank}>
          {t.items.contents.addRow}
        </Button>
      </div>

      <div
        ref={listRef}
        className="max-h-[65vh] overflow-y-auto rounded-lg border border-slate-200"
      >
        <div className="sticky top-0 z-10 hidden grid-cols-[1fr_9rem_5.5rem_5.5rem_1fr_5rem] gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 md:grid">
          <span>{t.items.contents.name}</span>
          <span>{t.items.contents.brand}</span>
          <span>{t.items.contents.quantity}</span>
          <span>{t.items.contents.damaged}</span>
          <span>{t.items.contents.note}</span>
          <span />
        </div>
        {visible.length === 0 ? (
          <p className="p-3 text-sm text-slate-600">{t.items.contents.noMatch}</p>
        ) : (
          <ul className="divide-y divide-slate-200 bg-white">
            {visible.map((r) => {
              const locked = restricted && r.id !== undefined;
              return (
                <li
                  key={r.key}
                  data-row={r.key}
                  className="grid grid-cols-2 gap-2 p-3 md:grid-cols-[1fr_9rem_5.5rem_5.5rem_1fr_5rem] md:items-center"
                >
                  <div className="col-span-2 md:col-span-1">
                    <Input
                      aria-label={t.items.contents.name}
                      value={r.name}
                      readOnly={locked}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                    />
                  </div>
                  <Input
                    aria-label={t.items.contents.brand}
                    placeholder={t.items.contents.brand}
                    value={r.brand}
                    readOnly={locked}
                    onChange={(e) => update(r.key, { brand: e.target.value })}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t.items.contents.quantity}
                    placeholder={t.items.contents.quantity}
                    value={r.quantity}
                    onChange={(e) => update(r.key, { quantity: e.target.value })}
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t.items.contents.damaged}
                    placeholder={t.items.contents.damaged}
                    value={r.damagedQuantity}
                    onChange={(e) => update(r.key, { damagedQuantity: e.target.value })}
                  />
                  <div className="col-span-2 md:col-span-1">
                    <Input
                      aria-label={t.items.contents.note}
                      placeholder={t.items.contents.note}
                      value={r.note}
                      onChange={(e) => update(r.key, { note: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      aria-label={t.items.contents.removeRow(r.name)}
                      disabled={locked}
                      onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                    >
                      {t.items.contents.remove}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {rows.some((r) => r.name.trim() === "") && (
        <p className="text-sm text-slate-600">{t.items.contents.unnamed}</p>
      )}
    </div>
  );
}
