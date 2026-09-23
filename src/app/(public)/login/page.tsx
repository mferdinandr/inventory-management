import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
      callbackUrl: searchParams.get("callbackUrl") ?? "/dashboard",
    })
    if (res?.error) {
      setError("Email atau kata sandi salah.")
      setLoading(false)
      return
    }
    router.push(searchParams.get("callbackUrl") ?? "/dashboard")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SIMASET</h1>
          <p className="text-sm text-muted-foreground">Masuk ke panel inventaris aset rumah sakit</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input type="email" name="email" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Kata sandi</span>
          <input type="password" name="password" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {loading ? "Memproses…" : "Masuk"}
        </button>
      </form>
    </main>
  )
}