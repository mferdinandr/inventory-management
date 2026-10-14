import { qrSvg } from "@/server/qr";

/** One 50 x 30 mm label (docs/08 §2): QR, bold code, name clipped to two lines. */
export async function ItemLabel({ code, name }: { code: string; name: string }) {
  const svg = await qrSvg(code, 256);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return (
    <div className="item-label flex h-[30mm] w-[50mm] items-center gap-[1.5mm] overflow-hidden bg-white p-[2mm] text-black">
      {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise */}
      <img src={src} alt={code} className="h-[24mm] w-[24mm] shrink-0" />
      <div className="min-w-0">
        <p className="text-[11pt] font-bold leading-tight">{code}</p>
        <p className="line-clamp-3 text-[8pt] leading-tight">{name}</p>
      </div>
    </div>
  );
}
