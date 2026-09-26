"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { recordLabelPrintAction } from "@/server/actions/asset.actions"

export function PrintLabelButton({
  assetId,
  reason,
  labelSize,
}: {
  assetId: string
  reason: string
  labelSize: string
}) {
  const [recorded, setRecorded] = useState(false)

  async function handlePrint() {
    // FR-14: setiap pencetakan tercatat, siapa, kapan, alasan — sebelum
    // dialog cetak muncul, bukan sesudah (pengguna bisa membatalkan dialognya
    // tanpa kita tahu, tapi maksud mencetak sudah tercatat).
    if (!recorded) {
      await recordLabelPrintAction(assetId, reason, labelSize)
      setRecorded(true)
    }
    window.print()
  }

  return (
    <Button onClick={handlePrint} size="sm">
      Cetak
    </Button>
  )
}
