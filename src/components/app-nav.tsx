"use client"

import {
  BarChart3,
  Boxes,
  Handshake,
  LayoutDashboard,
  type LucideIcon,
  ScanLine,
  Settings,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon; comingSoon?: boolean }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Aset", icon: Boxes },
  { href: "/scan", label: "Pindai", icon: ScanLine },
  { href: "/loans", label: "Peminjaman", icon: Handshake },
  { href: "/maintenance", label: "Pemeliharaan", icon: Wrench, comingSoon: true },
  { href: "/reports", label: "Laporan", icon: BarChart3, comingSoon: true },
  { href: "/settings", label: "Pengaturan", icon: Settings },
]

export function AppNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col" : "flex-row overflow-x-auto",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, comingSoon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const content = (
          <>
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {comingSoon ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                Segera
              </span>
            ) : null}
          </>
        )
        if (comingSoon) {
          return (
            <span
              key={href}
              className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/70"
            >
              {content}
            </span>
          )
        }
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
