"use client"

import { type FormEvent, useState } from "react"
import { requestPasswordResetAction } from "@/server/actions/auth.actions"

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    await requestPasswordResetAction(String(form.get("email") ?? ""))
    setLoading(false)
    // Selalu tampil sukses — jangan bocorkan apakah email itu terdaftar.
    setSent(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Lupa Kata Sandi</h1>
          <p className="text-sm text-muted-foreground">
            Masukkan email akun SIMASET Anda untuk menerima tautan atur ulang.
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Bila email tersebut terdaftar, kami telah mengirim tautan atur ulang kata sandi. Tautan
            berlaku 1 jam.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {loading ? "Mengirim…" : "Kirim tautan atur ulang"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
