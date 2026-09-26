"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { recordSheetPrintAction } from "@/server/actions/asset.actions"

export function PrintSheetButton({ assetIds }: { assetIds: string[] }) {
  const [recorded, setRecorded] = useState(false)

  async function handlePrint() {
    if (!recorded && assetIds.length > 0) {
      await recordSheetPrintAction(assetIds)
      setRecorded(true)
    }
    window.print()
  }

  return (
    <Button onClick={handlePrint} size="sm" disabled={assetIds.length === 0}>
      Cetak {assetIds.length} label
    </Button>
  )
}
