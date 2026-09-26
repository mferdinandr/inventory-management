"use client"

import { useState } from "react"
import { ReturnForm } from "@/components/loans/return-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function ReturnDialog({ loanId, assetId }: { loanId: string; assetId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Kembalikan</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kembalikan aset</DialogTitle>
        </DialogHeader>
        <ReturnForm loanId={loanId} assetId={assetId} />
      </DialogContent>
    </Dialog>
  )
}
