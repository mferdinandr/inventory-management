"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ORGANIZATION_STATUSES, type TIMEZONES } from "@/lib/validators/organization"
import {
  createOrganizationAction,
  type OperatorActionState,
  updateOrganizationAction,
} from "@/server/actions/operator.actions"
import { ORGANIZATION_STATUS_LABELS } from "./labels"

const STATUS_ITEMS = ORGANIZATION_STATUSES.map((value) => ({
  value,
  label: ORGANIZATION_STATUS_LABELS[value],
}))

const TIMEZONE_ITEMS = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
] satisfies Array<{ value: (typeof TIMEZONES)[number]; label: string }>

export type QuotaValues = {
  status: (typeof ORGANIZATION_STATUSES)[number]
  quotaAssets: number
  quotaStorageGb: number
  quotaUsers: number
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function QuotaFields({
  prefix,
  values,
  saved,
}: {
  prefix: string
  values: QuotaValues
  saved?: Record<string, string>
}) {
  const [status, setStatus] = useState<string>(saved?.status ?? values.status)
  return (
    <>
      <Field id={`${prefix}-status`} label="Status langganan">
        <Select
          name="status"
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(v) => setStatus(String(v))}
        >
          <SelectTrigger id={`${prefix}-status`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${prefix}-assets`} label="Kuota aset">
          <Input
            id={`${prefix}-assets`}
            name="quotaAssets"
            type="number"
            min={1}
            required
            defaultValue={saved?.quotaAssets ?? values.quotaAssets}
          />
        </Field>
        <Field id={`${prefix}-storage`} label="Penyimpanan (GB)">
          <Input
            id={`${prefix}-storage`}
            name="quotaStorageGb"
            type="number"
            min={1}
            required
            defaultValue={saved?.quotaStorageGb ?? values.quotaStorageGb}
          />
        </Field>
        <Field id={`${prefix}-users`} label="Kuota pengguna">
          <Input
            id={`${prefix}-users`}
            name="quotaUsers"
            type="number"
            min={1}
            required
            defaultValue={saved?.quotaUsers ?? values.quotaUsers}
          />
        </Field>
      </div>
    </>
  )
}

function ActionMessage({ state }: { state: OperatorActionState | null }) {
  if (!state) return null
  if (!state.ok) return <p className="text-sm text-destructive">{state.error}</p>
  return state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null
}

export function CreateOrganizationForm({ defaults }: { defaults: QuotaValues }) {
  const [state, formAction, isPending] = useActionState(createOrganizationAction, null)
  const saved = state?.ok === false ? state.values : undefined
  const [timezone, setTimezone] = useState<string>(saved?.timezone ?? "Asia/Jakarta")

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-medium">Rumah sakit</h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field id="org-name" label="Nama *">
            <Input
              id="org-name"
              name="name"
              required
              maxLength={200}
              placeholder="RS Contoh Sejahtera"
              defaultValue={saved?.name}
            />
          </Field>
          <Field
            id="org-code"
            label="Kode *"
            hint="Huruf, angka, tanda hubung. Tidak dapat diubah."
          >
            <Input
              id="org-code"
              name="code"
              required
              minLength={2}
              maxLength={20}
              placeholder="RSCS"
              className="uppercase"
              defaultValue={saved?.code}
            />
          </Field>
        </div>
        <Field id="org-timezone" label="Zona waktu">
          <Select
            name="timezone"
            items={TIMEZONE_ITEMS}
            value={timezone}
            onValueChange={(v) => setTimezone(String(v))}
          >
            <SelectTrigger id="org-timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Langganan dan kuota</h2>
        <QuotaFields prefix="org" values={defaults} saved={saved} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-medium">Super Admin pertama</h2>
          <p className="text-sm text-muted-foreground">
            Undangan dikirim ke email ini dan berlaku 7 hari. Kategori tidak diisi otomatis — rumah
            sakit menyusunnya sendiri.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="admin-name" label="Nama *">
            <Input
              id="admin-name"
              name="adminName"
              required
              maxLength={200}
              defaultValue={saved?.adminName}
            />
          </Field>
          <Field id="admin-email" label="Email *">
            <Input
              id="admin-email"
              name="adminEmail"
              type="email"
              required
              defaultValue={saved?.adminEmail}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Membuat…" : "Buat organisasi dan kirim undangan"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

export function UpdateQuotaForm({
  organizationId,
  values,
}: {
  organizationId: string
  values: QuotaValues
}) {
  const [state, formAction, isPending] = useActionState(
    updateOrganizationAction.bind(null, organizationId),
    null,
  )
  const saved = state?.ok === false ? state.values : undefined

  return (
    <form action={formAction} className="space-y-4">
      <QuotaFields prefix="quota" values={values} saved={saved} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Menyimpan…" : "Simpan"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}
