import { cn } from "@/lib/utils"

/** Pemakaian vs kuota. Merah saat penuh, kuning mulai 80%. */
export function QuotaMeter({
  used,
  quota,
  label,
  className,
}: {
  used: number
  quota: number
  label: string
  className?: string
}) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100
  return (
    <div className={cn("min-w-28 space-y-1", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">{label}</p>
      {/* Angka di atas sudah memuat informasinya; batang ini hanya visual. */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
