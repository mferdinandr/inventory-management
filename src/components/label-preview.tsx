"use client";

import type { LabelTextPosition } from "@/components/item-label";

type Props = {
  code: string;
  name: string;
  /** Data URI of the QR SVG, generated server-side. */
  qrSrc: string;
  hideText?: boolean;
  textPosition?: LabelTextPosition;
  textScale?: number;
};

/** Client-rendered label so the size/text options update the preview live. */
export function LabelPreview({
  code,
  name,
  qrSrc,
  hideText,
  textPosition = "right",
  textScale = 1,
}: Props) {
  const stacked = textPosition === "top" || textPosition === "bottom";
  const qrFirst = textPosition === "right" || textPosition === "bottom";

  const qrBox = (
    <div
      className={`relative shrink-0 ${
        hideText ? "h-full w-full" : stacked ? "h-[62%] w-full" : "h-[86%] aspect-square"
      }`}
    >
      {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise */}
      <img
        src={qrSrc}
        alt={code}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "contain" }}
      />
    </div>
  );

  const textBlock = (
    <div
      className={`min-w-0 ${stacked ? "w-full flex-1 text-center" : ""} ${
        textPosition === "left" ? "text-right" : ""
      }`}
    >
      <p className="font-bold leading-tight" style={{ fontSize: `${11 * textScale}pt` }}>
        {code}
      </p>
      <p className="line-clamp-3 leading-tight" style={{ fontSize: `${8 * textScale}pt` }}>
        {name}
      </p>
    </div>
  );

  return (
    <div
      className={`item-label flex h-full w-full items-center justify-center overflow-hidden bg-white p-[2mm] text-black ${
        stacked ? "flex-col" : "flex-row"
      }`}
      style={{ gap: "1.5mm" }}
    >
      {qrFirst ? qrBox : null}
      {!hideText && textBlock}
      {!qrFirst ? qrBox : null}
    </div>
  );
}
