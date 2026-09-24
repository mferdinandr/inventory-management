import { ImageResponse } from "next/og"
import { simasetGlyph } from "../_icon-glyph"

const size = { width: 512, height: 512 }

export function GET() {
  const glyph = simasetGlyph(size.width)
  return new ImageResponse(<div style={glyph.style}>{glyph.children}</div>, size)
}
