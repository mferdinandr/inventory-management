import { ImageResponse } from "next/og"
import { simasetGlyph } from "./_icon-glyph"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  const glyph = simasetGlyph(size.width)
  return new ImageResponse(<div style={glyph.style}>{glyph.children}</div>, size)
}
