"use server"

import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/permissions"
import { checkoutLoanSchema, returnLoanSchema } from "@/lib/validators/loan"
import { checkoutLoan, LoanError, returnLoan } from "@/server/services/loan.service"
import { requireActiveOrg, requireUser } from "@/server/tenant"

type ActionState = { ok: true } | { ok: false; error: string }

function err(message: string): ActionState {
  return { ok: false, error: message }
}

function raw(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "")
}

export async function checkoutLoanAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "loan:manage")) {
    return err("Anda tidak memiliki izin mencatat peminjaman.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = checkoutLoanSchema.safeParse({
    assetId: raw(formData, "assetId"),
    borrowerType: raw(formData, "borrowerType"),
    borrowerUserId: raw(formData, "borrowerUserId"),
    borrowerName: raw(formData, "borrowerName"),
    borrowerPhone: raw(formData, "borrowerPhone"),
    borrowerUnit: raw(formData, "borrowerUnit"),
    purpose: raw(formData, "purpose"),
    dueAt: raw(formData, "dueAt"),
    conditionOut: raw(formData, "conditionOut") || "GOOD",
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  try {
    await checkoutLoan(organizationId, user.id, parsed.data)
    revalidatePath(`/assets/${parsed.data.assetId}`)
    revalidatePath("/loans")
    return { ok: true }
  } catch (e) {
    if (e instanceof LoanError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}

export async function returnLoanAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  if (!hasPermission(user.role, "loan:manage")) {
    return err("Anda tidak memiliki izin mencatat pengembalian.")
  }
  const organizationId = await requireActiveOrg()

  const parsed = returnLoanSchema.safeParse({
    loanId: raw(formData, "loanId"),
    conditionIn: raw(formData, "conditionIn"),
    returnNotes: raw(formData, "returnNotes"),
  })
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Data tidak valid.")

  const assetId = raw(formData, "assetId")

  try {
    await returnLoan(organizationId, user.id, parsed.data)
    if (assetId) revalidatePath(`/assets/${assetId}`)
    revalidatePath("/loans")
    return { ok: true }
  } catch (e) {
    if (e instanceof LoanError) return err(e.message)
    return err("Terjadi galat tak terduga.")
  }
}
