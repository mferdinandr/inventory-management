"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { revertDisposalAction } from "@/server/actions/event.actions"

export function RevertDisposalButton({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    const result = await revertDisposalAction(assetId)
    setPending(false)
    if (result.ok) {
      router.refresh()
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Memproses…" : "Batalkan Penghapusan"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
