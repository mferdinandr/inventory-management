import type { MetadataRoute } from "next"

// Auto-served at /manifest.webmanifest and linked from <head> by Next.js —
// no manual <link rel="manifest"> needed. docs/02-prd.md FR-24b: installable
// only, no offline cache (SIMASET stays online-only).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIMASET — Inventaris Aset Rumah Sakit",
    short_name: "SIMASET",
    description: "Pelacakan aset rumah sakit berbasis QR Code.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "id",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
