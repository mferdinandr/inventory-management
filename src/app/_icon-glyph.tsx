import type { CSSProperties } from "react"

// Leading underscore excludes this folder from routing (Next.js convention).
// Shared by icon.tsx, apple-icon.tsx, and the icon-192/icon-512 routes so the
// placeholder mark stays consistent everywhere. Swap this out — and only
// this — once a real brand mark exists; nothing else needs to change.
export function simasetGlyph(size: number): { style: CSSProperties; children: string } {
  return {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#2563eb", // aksen biru — docs/11 keputusan 37
      color: "#ffffff",
      fontFamily: "sans-serif",
      fontWeight: 700,
      fontSize: Math.round(size * 0.55),
      borderRadius: size * 0.18,
    },
    children: "S",
  }
}
