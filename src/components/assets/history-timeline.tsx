"use client"

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getAttachmentUrlAction } from "@/server/actions/attachment.actions"
import { correctEventAction } from "@/server/actions/event.actions"

const EVENT_TYPE_LABELS: Record<string, string> = {
  CREATED: "Didaftarkan",
  INSPECTION: "Inspeksi",
  MAINTENANCE: "Pemeliharaan",
  REPAIR: "Perbaikan",
  CALIBRATION: "Kalibrasi",
  LOAN_OUT: "Dipinjam",
  LOAN_RETURN: "Dikembalikan",
  TRANSFER: "Mutasi",
  STATUS_CHANGE: "Ubah status",
  NOTE: "Catatan",
  DISPOSAL: "Dihapuskan",
  CORRECTION: "Koreksi",
  LABEL_PRINTED: "Cetak label",
}

const BACKDATED_THRESHOLD_MS = 24 * 60 * 60 * 1000

export type TimelineEvent = {
  id: string
  type: string
  title: string
  notes: string | null
  occurredAt: string | Date
  recordedAt: string | Date
  recordedByUser: { name: string } | null
  statusBefore: string | null
  statusAfter: string | null
  attachments: Array<{ id: string; mimeType: string; originalFilename: string | null }>
  corrections: Array<{ id: string }>
  correctsEvent: { id: string; title: string } | null
}

function AttachmentLink({ attachmentId, label }: { attachmentId: string; label: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const result = await getAttachmentUrlAction(attachmentId)
    setLoading(false)
    if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer")
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
    >
      {loading ? "Membuka…" : label}
    </button>
  )
}

function CorrectionDialog({ assetId, eventId }: { assetId: string; eventId: string }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(correctEventAction, null)

  useEffect(() => {
    if (state?.ok) setOpen(false)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<button type="button" className="text-xs text-primary hover:underline" />}
      >
        Koreksi
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koreksi entri riwayat</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="assetId" value={assetId} />
          <textarea
            name="reason"
            required
            rows={3}
            maxLength={1000}
            placeholder="Alasan koreksi *"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan…" : "Simpan koreksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function HistoryTimeline({ assetId, events }: { assetId: string; events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
  }

  return (
    <ul className="space-y-4 text-sm">
      {events.map((e) => {
        const occurredAt = new Date(e.occurredAt)
        const recordedAt = new Date(e.recordedAt)
        const isBackdated = recordedAt.getTime() - occurredAt.getTime() > BACKDATED_THRESHOLD_MS
        const wasCorrected = e.corrections.length > 0

        return (
          <li key={e.id} className="border-b pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {EVENT_TYPE_LABELS[e.type] ?? e.type}
                </span>{" "}
                <span className="font-medium">{e.title}</span>
                {isBackdated ? (
                  <span className="ml-1 text-xs text-amber-600">(dicatat mundur)</span>
                ) : null}
                {wasCorrected ? (
                  <span className="ml-1 text-xs text-muted-foreground">(telah dikoreksi)</span>
                ) : null}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {occurredAt.toLocaleString("id-ID")}
              </time>
            </div>

            {e.notes ? <p className="mt-1 text-muted-foreground">{e.notes}</p> : null}

            {e.correctsEvent ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Mengoreksi: "{e.correctsEvent.title}"
              </p>
            ) : null}

            {e.statusBefore && e.statusAfter ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {e.statusBefore} → {e.statusAfter}
              </p>
            ) : null}

            {e.attachments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {e.attachments.map((a) => (
                  <AttachmentLink
                    key={a.id}
                    attachmentId={a.id}
                    label={a.originalFilename ?? "Lampiran"}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>oleh {e.recordedByUser?.name ?? "—"}</span>
              {e.type !== "CORRECTION" ? (
                <CorrectionDialog assetId={assetId} eventId={e.id} />
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
