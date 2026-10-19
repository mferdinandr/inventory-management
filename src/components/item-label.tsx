import { qrSvg } from "@/server/qr";

export type LabelTextPosition = "top" | "right" | "left" | "bottom";

export type ItemLabelProps = {
  code: string;
  name: string;
  /** Hide the code and name so the label is QR-only. */
  hideText?: boolean;
  /** Where the code and name sit relative to the QR; right and left are centered. */
  textPosition?: LabelTextPosition;
  /** Multiplier for the code/name font sizes (1 = 11pt code, 8pt name). */
  textScale?: number;
};

/** One printable label; sized by the parent sheet, text layout configurable. */
export async function ItemLabel({
  code,
  name,
  hideText,
  textPosition = "right",
  textScale = 1,
}: ItemLabelProps) {
  const svg = await qrSvg(code, 256);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const stacked = textPosition === "top" || textPosition === "bottom";
  const qrFirst = textPosition === "right" || textPosition === "bottom";

  const qrBox = (
    <div
      className={`relative shrink-0 ${
        hideText ? "h-full w-full" : stacked ? "h-[62%] w-full" : "h-full w-[55%]"
      }`}
    >
      {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise */}
      <img
        src={src}
        alt={code}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "contain" }}
      />
    </div>
  );

  const textBlock = (
    <div
      className={`min-w-0 ${stacked ? "w-full flex-1 text-center" : "flex-1"} ${
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
      className={`item-label flex h-full w-full items-center overflow-hidden bg-white p-[2mm] text-black ${
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
