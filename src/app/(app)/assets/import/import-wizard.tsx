"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { AssetFormInput } from "@/lib/validators/asset"
import type { ImportRowError } from "@/lib/validators/import"
import { commitImportAction, previewImportAction } from "@/server/actions/import.actions"

type Preview = { validCount: number; errors: ImportRowError[]; rows: AssetFormInput[] }

/** FR-29: unggah → pratinjau dan validasi (baris bermasalah + nomor baris) → simpan. */
export function ImportWizard() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [committed, setCommitted] = useState<string[] | null>(null)

  async function handlePreview(formData: FormData) {
    setBusy(true)
    setError(null)
    setPreview(null)
    const result = await previewImportAction(formData)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPreview({ validCount: result.validCount, errors: result.errors, rows: result.rows })
  }

  async function handleCommit() {
    if (!preview) return
    setBusy(true)
    setError(null)
    const result = await commitImportAction(preview.rows)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setCommitted(result.assetIds)
  }

  if (committed) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm">
          {committed.length} aset berhasil diimpor. Cetak seluruh labelnya sekarang, atau lakukan
          nanti dari daftar aset.
        </p>
        <div className="flex gap-2">
          <Button
            render={
              <a
                href={`/print/sheet?ids=${committed.join(",")}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Cetak Semua Label
          </Button>
          <Button variant="outline" onClick={() => router.push("/assets")}>
            Ke Daftar Aset
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Unduh templat, isi datanya, lalu unggah kembali untuk pratinjau sebelum disimpan.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" render={<a href="/api/import/template">Unduh Templat</a>} />
          <form action={(fd) => handlePreview(fd)} className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept=".xlsx,.csv"
              required
              className="block text-sm"
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Memproses…" : "Pratinjau"}
            </Button>
          </form>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>

      {preview ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="text-sm">
            <span className="font-medium">{preview.validCount}</span> baris valid,{" "}
            <span className="font-medium text-destructive">{preview.errors.length}</span> baris
            bermasalah.
          </p>

          {preview.errors.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Baris</th>
                    <th className="px-3 py-2">Masalah</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((e) => (
                    <tr key={e.row} className="border-b last:border-0">
                      <td className="px-3 py-2">{e.row}</td>
                      <td className="px-3 py-2 text-destructive">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview.validCount > 0 ? (
            <Button onClick={handleCommit} disabled={busy}>
              {busy ? "Menyimpan…" : `Simpan ${preview.validCount} Aset`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
