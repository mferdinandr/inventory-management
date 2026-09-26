import { requireActiveOrg, requireUser } from "@/server/tenant"
import { Scanner } from "./scanner"

export const dynamic = "force-dynamic"

export default async function ScanPage() {
  await requireUser()
  await requireActiveOrg()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Pindai Aset</h1>
        <p className="text-sm text-muted-foreground">
          Arahkan kamera ke QR pada label aset, atau ketik kodenya secara manual.
        </p>
      </header>
      <Scanner />
    </div>
  )
}
