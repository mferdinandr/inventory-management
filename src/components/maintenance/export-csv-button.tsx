"use client"

import { Button } from "@/components/ui/button"
import type { DueScheduleRow } from "@/server/services/maintenance.service"

function toCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** FR-23: "dapat diekspor" — CSV sederhana yang dibangun di peramban dari baris yang sudah ditampilkan. */
export function ExportCsvButton({ rows }: { rows: DueScheduleRow[] }) {
  function handleExport() {
    const header = [
      "Kode Aset",
      "Nama Aset",
      "Kategori",
      "Ruangan",
      "Jenis",
      "Jatuh Tempo",
      "Sisa Hari",
    ]
    const lines = rows.map((r) =>
      [
        r.assetCode,
        r.assetName,
        r.categoryName ?? "",
        r.locationName,
        r.type,
        new Date(r.nextDueAt).toLocaleDateString("id-ID"),
        String(r.daysUntilDue),
      ]
        .map(toCsvValue)
        .join(","),
    )
    const csv = [header.map(toCsvValue).join(","), ...lines].join("\n")
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `jadwal-jatuh-tempo-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
      Ekspor CSV
    </Button>
  )
}
