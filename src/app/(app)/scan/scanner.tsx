"use client"

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"
import { useRouter } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { resolveScanAction } from "@/server/actions/scan.actions"

// FR-25 (docs/02-prd.md §G). Kamera adalah jalur utama; isian kode manual
// adalah cadangan wajib bila label rusak atau kamera tidak tersedia/ditolak.
export function Scanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)

  const handleValue = useCallback(
    async (value: string) => {
      setResolving(true)
      const result = await resolveScanAction(value)
      setResolving(false)
      if (result.ok) {
        router.push(`/assets/${result.assetId}`)
      } else {
        setCameraError(result.error)
      }
    },
    [router],
  )

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserQRCodeReader()

    async function start() {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // biarkan browser memilih — mengutamakan kamera belakang
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelled) {
              controlsRef.current?.stop()
              void handleValue(result.getText())
            }
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      } catch (err) {
        if (cancelled) return
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Akses kamera ditolak. Izinkan akses kamera di pengaturan peramban, atau gunakan isian kode aset di bawah."
            : "Kamera tidak tersedia di perangkat ini. Gunakan isian kode aset di bawah.",
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [handleValue])

  async function onManualSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setManualError(null)
    setResolving(true)
    const result = await resolveScanAction(manualCode)
    setResolving(false)
    if (result.ok) {
      router.push(`/assets/${result.assetId}`)
    } else {
      setManualError(result.error)
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>

      {cameraError ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {cameraError}
        </p>
      ) : null}

      {resolving ? <p className="text-sm text-muted-foreground">Mencari aset…</p> : null}

      <form onSubmit={onManualSubmit} className="space-y-2 rounded-xl border bg-card p-4">
        <label htmlFor="manual-code" className="text-sm font-medium">
          Atau ketik kode aset
        </label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="RSXX-RAD-2026-0012"
            className="flex-1"
          />
          <Button type="submit" disabled={resolving || !manualCode.trim()}>
            Cari
          </Button>
        </div>
        {manualError ? <p className="text-sm text-destructive">{manualError}</p> : null}
      </form>
    </div>
  )
}
