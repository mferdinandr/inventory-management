import { qrSvg } from "@/server/qr";

export type LabelTextPosition = "right" | "left" | "center";

export type ItemLabelProps = {
  code: string;
  name: string;
  /** Hide the code and name so the label is QR-only. */
  hideText?: boolean;
  /** Where the code and name sit relative to the QR: right, left or centered. */
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
  const qrFirst = textPosition !== "left";

  const qrBox = (
    <div className="relative h-full w-[55%] shrink-0">
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
    <div className={`min-w-0 flex-1 ${textPosition === "center" ? "text-center" : ""}`}>
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
      className="item-label flex h-full w-full flex-row items-center overflow-hidden bg-white p-[2mm] text-black"
      style={{ gap: "1.5mm" }}
    >
      {qrFirst ? qrBox : null}
      {!hideText && textBlock}
      {!qrFirst ? qrBox : null}
    </div>
  );
}
