"use client"

import { LogInIcon } from "lucide-react"
import { useActionState, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  type OperatorActionState,
  resendAdminInviteAction,
  startImpersonationAction,
} from "@/server/actions/operator.actions"

export function ImpersonateDialog({
  organizationId,
  organizationName,
}: {
  organizationId: string
  organizationName: string
}) {
  const [state, formAction, isPending] = useActionState(
    startImpersonationAction.bind(null, organizationId),
    null,
  )

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <LogInIcon />
            Masuk sebagai organisasi
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Masuk sebagai {organizationName}?</DialogTitle>
          <DialogDescription>
            Sesi ini tercatat sebagai <code>platform.impersonate</code> di audit log organisasi dan
            dapat dilihat oleh pelanggan. Selama sesi berjalan, penanda tetap tampil di bagian atas
            layar.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          {state?.ok === false ? (
            <p className="pb-3 text-sm text-destructive">{state.error}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Batal</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Membuka sesi…" : "Masuk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ResendInviteButton({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<OperatorActionState | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await resendAdminInviteAction(organizationId, userId))
          })
        }
      >
        {isPending ? "Mengirim…" : "Kirim ulang undangan"}
      </Button>
      {result ? (
        <span className={result.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
          {result.ok ? result.message : result.error}
        </span>
      ) : null}
    </div>
  )
}
