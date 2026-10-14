"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { t } from "@/lib/strings";

type Row = {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  damagedQuantity: number;
  note: string | null;
};

/** Read-only contents with an in-list search, for sets with many rows. */
export function ContentsList({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      needle === "" ||
      r.name.toLowerCase().includes(needle) ||
      (r.brand ?? "").toLowerCase().includes(needle),
  );

  if (rows.length === 0) return <p className="text-slate-600">{t.items.detail.noContents}</p>;

  return (
    <div className="space-y-3">
      {rows.length > 8 && (
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
            {t.items.contents.rows(shown.length, rows.length)}
          </span>
        </div>
      )}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-medium">{t.items.contents.name}</th>
              <th className="px-3 py-2 font-medium">{t.items.contents.brand}</th>
              <th className="px-3 py-2 text-right font-medium">{t.items.contents.quantity}</th>
              <th className="px-3 py-2 text-right font-medium">{t.items.contents.damaged}</th>
              <th className="px-3 py-2 font-medium">{t.items.contents.note}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.brand}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td
                  className={`px-3 py-2 text-right ${r.damagedQuantity > 0 ? "font-medium text-red-700" : ""}`}
                >
                  {r.damagedQuantity}
                </td>
                <td className="px-3 py-2">{r.note}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-slate-600">
                  {t.items.contents.noMatch}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
