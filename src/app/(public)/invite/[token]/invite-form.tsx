"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { acceptInviteAction } from "@/server/actions/auth.actions"

export function InviteForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.")
      return
    }
    setLoading(true)
    const result = await acceptInviteAction(token, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push("/login?accepted=1")
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Terima Undangan</h1>
        <p className="text-sm text-muted-foreground">Atur kata sandi untuk akun SIMASET Anda</p>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Kata sandi baru</span>
        <input
          type="password"
          name="password"
          required
          minLength={10}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">Minimal 10 karakter.</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Ulangi kata sandi</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={10}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Memproses…" : "Aktifkan akun"}
      </button>
    </form>
  )
}
