import { ImageResponse } from "next/og"
import { simasetGlyph } from "./_icon-glyph"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  const glyph = simasetGlyph(size.width)
  return new ImageResponse(<div style={glyph.style}>{glyph.children}</div>, size)
}
