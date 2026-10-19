"use client";

import { cloneElement, isValidElement, useState } from "react";
import type { ItemLabelProps, LabelTextPosition } from "@/components/item-label";
import { PrintButton } from "@/components/print-button";
import { Input, Label, NativeSelect } from "@/components/ui";
import { t } from "@/lib/strings";

const PRESETS = [
  { w: 50, h: 30 },
  { w: 60, h: 40 },
  { w: 40, h: 25 },
] as const;

const FONT_SIZES = [
  { label: "75%", scale: 0.75 },
  { label: "100%", scale: 1 },
  { label: "125%", scale: 1.25 },
  { label: "150%", scale: 1.5 },
  { label: "200%", scale: 2 },
] as const;

const MIN = 20;
const MAX = 120;

/** Size controls plus the printable label preview for /print/label/[code]. */
export function LabelSizePicker({ children }: { children: React.ReactNode }) {
  const [w, setW] = useState<number>(PRESETS[0].w);
  const [h, setH] = useState<number>(PRESETS[0].h);
  const [showText, setShowText] = useState(true);
  const [position, setPosition] = useState<LabelTextPosition>("right");
  const [fontScale, setFontScale] = useState(1);
  const preset = PRESETS.find((p) => p.w === w && p.h === h);

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, Number.isFinite(v) ? v : MIN));

  const label = isValidElement(children)
    ? cloneElement(children as React.ReactElement<ItemLabelProps>, {
        hideText: !showText,
        textPosition: position,
        textScale: fontScale,
      })
    : children;

  return (
    <div className="p-4 print:p-0">
      <style>
        {`@page { size: ${w}mm ${h}mm; margin: 0 } @media print { body { background: #fff } }`}
      </style>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-ink-200 bg-card p-4 shadow-sm print:hidden sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
        <div className="w-full sm:w-auto">
          <p className="mb-2 text-sm font-medium text-muted-foreground">{t.print.labelSize}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={`${p.w}-${p.h}`}
                type="button"
                onClick={() => {
                  setW(p.w);
                  setH(p.h);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === p
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-ink-200 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {p.w}×{p.h} mm
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex">
          <div className="space-y-1">
            <Label htmlFor="label-width">{t.print.width}</Label>
            <Input
              id="label-width"
              type="number"
              min={MIN}
              max={MAX}
              inputMode="numeric"
              value={w}
              onChange={(e) => setW(clamp(Number(e.target.value)))}
              className="h-9 w-full sm:w-24"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="label-height">{t.print.height}</Label>
            <Input
              id="label-height"
              type="number"
              min={MIN}
              max={MAX}
              inputMode="numeric"
              value={h}
              onChange={(e) => setH(clamp(Number(e.target.value)))}
              className="h-9 w-full sm:w-24"
            />
          </div>
        </div>

        <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={showText}
            onChange={(e) => setShowText(e.target.checked)}
            className="size-4 accent-primary"
          />
          {t.print.showText}
        </label>

        <div className="space-y-1">
          <Label htmlFor="label-position">{t.print.textPosition}</Label>
          <NativeSelect
            id="label-position"
            value={position}
            onChange={(e) => setPosition(e.target.value as LabelTextPosition)}
            className="h-9 w-full sm:w-32"
          >
            {(Object.keys(t.print.positions) as LabelTextPosition[]).map((p) => (
              <option key={p} value={p}>
                {t.print.positions[p]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1">
          <Label htmlFor="label-font">{t.print.fontSize}</Label>
          <NativeSelect
            id="label-font"
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
            className="h-9 w-full sm:w-32"
          >
            {FONT_SIZES.map((f) => (
              <option key={f.scale} value={f.scale}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="w-full sm:ml-auto sm:w-auto">
          <PrintButton className="w-full sm:w-auto" />
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          style={{ width: `${w}mm`, height: `${h}mm` }}
          className="mx-auto shrink-0 border border-dashed border-slate-300 print:border-0"
        >
          {label}
        </div>
      </div>
    </div>
  );
}
