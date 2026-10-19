import { qrSvg } from "@/server/qr";

/** One printable label (default 50 x 30 mm, sized by the parent sheet). */
export async function ItemLabel({ code, name }: { code: string; name: string }) {
  const svg = await qrSvg(code, 256);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return (
    <div className="item-label flex h-full w-full items-center gap-[1.5mm] overflow-hidden bg-white p-[2mm] text-black">
      <div className="relative h-full w-[55%] shrink-0">
        {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise */}
        <img
          src={src}
          alt={code}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "contain" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11pt] font-bold leading-tight">{code}</p>
        <p className="line-clamp-3 text-[8pt] leading-tight">{name}</p>
      </div>
    </div>
  );
}
