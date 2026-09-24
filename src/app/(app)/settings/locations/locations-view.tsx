"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, type ReactNode, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type LocationType, PARENT_TYPES, TYPE_LABELS } from "@/lib/location"
import { createLocationAction, updateLocationAction } from "@/server/actions/location.actions"
import type { LocationListItem } from "@/server/services/location.service"

const LOCATION_TYPES: LocationType[] = ["BUILDING", "FLOOR", "DEPARTMENT", "ROOM"]

type PicOption = { id: string; name: string }

type ActionResult = { ok: boolean; error?: string }

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function LocationsView({
  locations,
  picCandidates,
}: {
  locations: LocationListItem[]
  picCandidates: PicOption[]
}) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createType, setCreateType] = useState<LocationType>("BUILDING")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<ActionResult>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? "Terjadi kesalahan. Silakan coba lagi.")
        return false
      }
      return true
    } finally {
      setBusy(false)
    }
  }

  function parentOptionsFor(type: LocationType, currentId?: string | null) {
    const requiredParent = PARENT_TYPES[type]
    if (!requiredParent) return []
    const options = locations.filter((l) => l.type === requiredParent && l.isActive)
    if (currentId && !options.some((o) => o.id === currentId)) {
      const current = locations.find((l) => l.id === currentId)
      if (current) options.push(current)
    }
    return options.sort((a, b) =>
      a.breadcrumb.join(" / ").localeCompare(b.breadcrumb.join(" / "), "id"),
    )
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const form = new FormData(e.currentTarget)
    const parentId = String(form.get("parentId") ?? "")
    const ok = await run(() =>
      createLocationAction({
        type: createType,
        parentId: parentId === "" ? null : parentId,
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? ""),
        picUserId: String(form.get("picUserId") ?? ""),
      }),
    )
    if (ok) {
      setShowCreate(false)
      router.refresh()
    }
  }

  async function onSave(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const form = new FormData(e.currentTarget)
    const parentId = String(form.get("parentId") ?? "")
    const ok = await run(() =>
      updateLocationAction(id, {
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? ""),
        parentId: parentId === "" ? null : parentId,
        picUserId: String(form.get("picUserId") ?? ""),
      }),
    )
    if (ok) {
      setEditingId(null)
      router.refresh()
    }
  }

  async function onToggleActive(location: LocationListItem) {
    if (busy) return
    const ok = await run(() => updateLocationAction(location.id, { isActive: !location.isActive }))
    if (ok) router.refresh()
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant={showCreate ? "outline" : "default"}
          onClick={() => {
            setShowCreate((v) => !v)
            setError(null)
          }}
        >
          {showCreate ? "Batal" : "Tambah lokasi"}
        </Button>
      </div>

      {showCreate ? (
        <form onSubmit={onCreate} className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Lokasi baru</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis">
              <select
                name="type"
                className={inputClass}
                value={createType}
                onChange={(e) => setCreateType(e.target.value as LocationType)}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            {PARENT_TYPES[createType] ? (
              <Field label="Induk">
                <ParentSelect name="parentId" options={parentOptionsFor(createType)} includeEmpty />
              </Field>
            ) : null}
            <Field label="Nama">
              <Input name="name" required maxLength={200} placeholder="mis. Ruang CT-Scan" />
            </Field>
            <Field label="Kode (opsional)">
              <Input name="code" maxLength={20} placeholder="mis. RAD" />
            </Field>
            {createType === "ROOM" ? (
              <Field label="PIC ruangan (opsional)">
                <PicSelect name="picUserId" options={picCandidates} />
              </Field>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              Simpan
            </Button>
          </div>
        </form>
      ) : null}

      {locations.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Belum ada lokasi. Mulailah dengan menambahkan Gedung pertama, lalu susun Lantai,
          Instalasi/Departemen, dan Ruangan di bawahnya.
        </div>
      ) : (
        <ul className="space-y-2">
          {locations.map((location) => (
            <li key={location.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="truncate font-medium"
                      style={{ paddingLeft: location.depth * 16 }}
                    >
                      {location.name}
                    </span>
                    <Badge variant="outline">{TYPE_LABELS[location.type]}</Badge>
                    {!location.isActive ? <Badge variant="secondary">Nonaktif</Badge> : null}
                  </div>
                  {location.depth > 0 ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {location.breadcrumb.join(" / ")}
                    </p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {location.code ? <span>Kode: {location.code}</span> : null}
                    {location.picName ? <span>PIC: {location.picName}</span> : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(editingId === location.id ? null : location.id)
                      setError(null)
                    }}
                  >
                    Ubah
                  </Button>
                  <Button
                    type="button"
                    variant={location.isActive ? "secondary" : "default"}
                    size="sm"
                    disabled={busy}
                    onClick={() => onToggleActive(location)}
                  >
                    {location.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>

              {editingId === location.id ? (
                <form
                  onSubmit={(e) => onSave(location.id, e)}
                  className="mt-4 space-y-4 border-t border-border pt-4"
                >
                  <h3 className="text-sm font-semibold">Ubah {TYPE_LABELS[location.type]}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nama">
                      <Input name="name" required maxLength={200} defaultValue={location.name} />
                    </Field>
                    <Field label="Kode (opsional)">
                      <Input name="code" maxLength={20} defaultValue={location.code ?? ""} />
                    </Field>
                    {PARENT_TYPES[location.type] ? (
                      <Field label="Induk">
                        <ParentSelect
                          name="parentId"
                          options={parentOptionsFor(location.type, location.parentId)}
                          defaultValue={location.parentId ?? ""}
                        />
                      </Field>
                    ) : null}
                    {location.type === "ROOM" ? (
                      <Field label="PIC ruangan (opsional)">
                        <PicSelect
                          name="picUserId"
                          options={picCandidates}
                          defaultValue={location.picUserId ?? ""}
                          fallbackName={location.picName ?? undefined}
                        />
                      </Field>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" disabled={busy}>
                      Simpan perubahan
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: kolom field membungkus kontrol di dalam label
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function ParentSelect({
  name,
  options,
  defaultValue,
  includeEmpty = false,
}: {
  name: string
  options: LocationListItem[]
  defaultValue?: string
  includeEmpty?: boolean
}) {
  return (
    <select name={name} className={inputClass} defaultValue={defaultValue ?? ""}>
      {includeEmpty ? <option value="">Pilih induk…</option> : null}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.breadcrumb.join(" / ")}
        </option>
      ))}
    </select>
  )
}

function PicSelect({
  name,
  options,
  defaultValue,
  fallbackName,
}: {
  name: string
  options: PicOption[]
  defaultValue?: string
  fallbackName?: string
}) {
  const all =
    defaultValue && !options.some((o) => o.id === defaultValue)
      ? [{ id: defaultValue, name: fallbackName ?? "PIC saat ini" }, ...options]
      : options
  return (
    <select name={name} className={inputClass} defaultValue={defaultValue ?? ""}>
      <option value="">— Tidak ada —</option>
      {all.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  )
}
