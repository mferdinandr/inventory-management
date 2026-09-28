"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { setScheduleActiveAction } from "@/server/actions/maintenance.actions"
import { ExecutionFormDialog } from "./execution-form-dialog"

type Option = { id: string; label: string }

export type ScheduleView = {
  id: string
  type: string
  intervalMonths: number
  lastPerformedAt: string | Date | null
  nextDueAt: string | Date
  isActive: boolean
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = {
  CALIBRATION: "Kalibrasi",
  PREVENTIVE: "Pemeliharaan preventif",
  CORRECTIVE: "Perbaikan korektif",
}

export function ScheduleList({
  assetId,
  schedules,
  vendors,
  canManage,
}: {
  assetId: string
  schedules: ScheduleView[]
  vendors: Option[]
  canManage: boolean
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleToggle(schedule: ScheduleView) {
    setPendingId(schedule.id)
    await setScheduleActiveAction(schedule.id, !schedule.isActive, assetId)
    setPendingId(null)
    router.refresh()
  }

  if (schedules.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada jadwal pemeliharaan.</p>
  }

  return (
    <ul className="space-y-3">
      {schedules.map((s) => {
        const nextDue = new Date(s.nextDueAt)
        const overdue = nextDue.getTime() < Date.now()
        return (
          <li
            key={s.id}
            className={`rounded-lg border p-3 text-sm ${s.isActive ? "" : "opacity-55"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{TYPE_LABELS[s.type] ?? s.type}</span>
                <Badge variant="secondary">setiap {s.intervalMonths} bulan</Badge>
                {!s.isActive ? <Badge variant="outline">Nonaktif</Badge> : null}
              </div>
              <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                Jatuh tempo: {nextDue.toLocaleDateString("id-ID")}
                {overdue ? " (lewat)" : ""}
              </span>
            </div>
            {s.lastPerformedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Terakhir dilaksanakan: {new Date(s.lastPerformedAt).toLocaleDateString("id-ID")}
              </p>
            ) : null}
            {canManage ? (
              <div className="mt-2 flex items-center gap-2">
                <ExecutionFormDialog assetId={assetId} scheduleId={s.id} vendors={vendors} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === s.id}
                  onClick={() => void handleToggle(s)}
                >
                  {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
