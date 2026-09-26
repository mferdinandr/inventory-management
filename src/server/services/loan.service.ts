import "server-only"
import { isLoanable } from "@/lib/status-machine"
import type { CheckoutLoanInput, ReturnLoanInput } from "@/lib/validators/loan"
import { withOrg } from "@/server/db"
import { assertOrgWritable } from "@/server/quota"
import type { Prisma } from "../../../generated/prisma/client"

// FR-18/FR-19/FR-20 (docs/02-prd.md §E). Konsistensi status<->loans dijaga
// oleh trigger+indeks parsial di DB (docs/03-erd.md §5.3); di sini kita
// hanya menerjemahkan pelanggarannya menjadi satu pesan yang jelas.

export class LoanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LoanError"
  }
}

type Tx = Prisma.TransactionClient

const STATUS_LABELS: Record<string, string> = {
  ON_LOAN: "sedang dipinjam",
  UNDER_REPAIR: "dalam perbaikan",
  AT_VENDOR: "sedang di vendor",
  LOST: "dinyatakan hilang",
  DISPOSED: "sudah dihapuskan",
}

function isUniqueViolation(e: unknown, target: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002" &&
    JSON.stringify((e as { meta?: unknown }).meta ?? "").includes(target)
  )
}

async function loadAssetOrThrow(tx: Tx, organizationId: string, assetId: string) {
  const asset = await tx.asset.findFirst({
    where: { id: assetId, organizationId },
    select: { id: true, status: true, locationId: true },
  })
  if (!asset) throw new LoanError("Aset tidak ditemukan.")
  return asset
}

export type CheckoutLoanResult = { loanId: string }

/** FR-18: peminjaman langsung aktif saat disimpan, tanpa persetujuan. */
export async function checkoutLoan(
  organizationId: string,
  actorUserId: string,
  input: CheckoutLoanInput,
): Promise<CheckoutLoanResult> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await loadAssetOrThrow(tx, organizationId, input.assetId)
    if (!isLoanable(asset.status)) {
      throw new LoanError(
        `Aset ini tidak dapat dipinjam karena statusnya saat ini ${STATUS_LABELS[asset.status] ?? asset.status}.`,
      )
    }

    const now = new Date()
    const checkoutEvent = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: asset.id,
        type: "LOAN_OUT",
        title:
          input.borrowerType === "EXTERNAL_PERSON"
            ? `Dipinjam oleh ${input.borrowerName}`
            : "Dipinjam",
        notes: input.purpose,
        occurredAt: now,
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: asset.status,
        statusAfter: "ON_LOAN",
      },
      select: { id: true },
    })

    let loan: { id: string }
    try {
      loan = await tx.loan.create({
        data: {
          organizationId,
          assetId: asset.id,
          borrowerType: input.borrowerType,
          borrowerUserId: input.borrowerType === "INTERNAL_USER" ? input.borrowerUserId : null,
          borrowerName: input.borrowerType === "EXTERNAL_PERSON" ? input.borrowerName : null,
          borrowerPhone: input.borrowerType === "EXTERNAL_PERSON" ? input.borrowerPhone : null,
          borrowerUnit: input.borrowerUnit ?? null,
          purpose: input.purpose,
          borrowedAt: now,
          dueAt: input.dueAt,
          conditionOut: input.conditionOut,
          checkoutEventId: checkoutEvent.id,
          recordedBy: actorUserId,
        },
        select: { id: true },
      })
    } catch (e) {
      // FR-18/docs/03-erd §5.3: loans_one_active_per_asset menolak dua
      // peminjaman aktif atas aset yang sama — ini satu-satunya jaminan
      // yang benar-benar aman terhadap dua permintaan bersamaan; pemeriksaan
      // status di atas saja rentan balapan periksa-lalu-tulis.
      if (isUniqueViolation(e, "loans_one_active_per_asset")) {
        throw new LoanError("Aset ini baru saja dipinjam oleh permintaan lain. Muat ulang halaman.")
      }
      throw e
    }

    await tx.asset.update({ where: { id: asset.id }, data: { status: "ON_LOAN" } })

    return { loanId: loan.id }
  })
}

/** FR-19: pengembalian — status kembali AVAILABLE, atau DAMAGED bila kondisi rusak. */
export async function returnLoan(
  organizationId: string,
  actorUserId: string,
  input: ReturnLoanInput,
): Promise<void> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const loan = await tx.loan.findFirst({
      where: { id: input.loanId, organizationId },
      select: { id: true, assetId: true, returnedAt: true },
    })
    if (!loan) throw new LoanError("Peminjaman tidak ditemukan.")
    if (loan.returnedAt) throw new LoanError("Peminjaman ini sudah dikembalikan sebelumnya.")

    const asset = await tx.asset.findFirstOrThrow({
      where: { id: loan.assetId, organizationId },
      select: { locationId: true },
    })

    const isDamaged = input.conditionIn === "NEEDS_REPAIR" || input.conditionIn === "UNUSABLE"
    const newStatus = isDamaged ? "DAMAGED" : "AVAILABLE"
    const now = new Date()

    const checkinEvent = await tx.assetEvent.create({
      data: {
        organizationId,
        assetId: loan.assetId,
        type: "LOAN_RETURN",
        title: "Dikembalikan",
        notes: input.returnNotes,
        occurredAt: now,
        recordedBy: actorUserId,
        locationId: asset.locationId,
        statusBefore: "ON_LOAN",
        statusAfter: newStatus,
      },
      select: { id: true },
    })

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        returnedAt: now,
        conditionIn: input.conditionIn,
        returnNotes: input.returnNotes,
        checkinEventId: checkinEvent.id,
        returnedRecordedBy: actorUserId,
      },
    })

    await tx.asset.update({ where: { id: loan.assetId }, data: { status: newStatus } })
  })
}

export type ActiveLoanRow = {
  id: string
  assetId: string
  assetCode: string
  assetName: string
  borrowerType: "INTERNAL_USER" | "EXTERNAL_PERSON"
  borrowerLabel: string
  borrowerPhone: string | null
  purpose: string
  borrowedAt: Date
  dueAt: Date | null
  isOverdue: boolean
  daysOnLoan: number
}

/** FR-20: daftar peminjaman aktif dengan penanda jatuh tempo / ambang tanpa jatuh tempo. */
export async function listActiveLoans(organizationId: string): Promise<ActiveLoanRow[]> {
  return withOrg(organizationId, async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { loanOverdueThresholdDays: true },
    })

    const loans = await tx.loan.findMany({
      where: { organizationId, returnedAt: null },
      orderBy: { borrowedAt: "asc" },
      include: {
        asset: { select: { id: true, assetCode: true, name: true } },
        borrowerUser: { select: { name: true } },
      },
    })

    const now = Date.now()
    return loans.map((l) => {
      const daysOnLoan = Math.floor((now - l.borrowedAt.getTime()) / 86_400_000)
      const isOverdue = l.dueAt
        ? l.dueAt.getTime() < now
        : daysOnLoan > org.loanOverdueThresholdDays
      return {
        id: l.id,
        assetId: l.asset.id,
        assetCode: l.asset.assetCode,
        assetName: l.asset.name,
        borrowerType: l.borrowerType,
        borrowerLabel:
          l.borrowerType === "INTERNAL_USER"
            ? (l.borrowerUser?.name ?? "—")
            : (l.borrowerName ?? "—"),
        borrowerPhone: l.borrowerPhone,
        purpose: l.purpose,
        borrowedAt: l.borrowedAt,
        dueAt: l.dueAt,
        isOverdue,
        daysOnLoan,
      }
    })
  })
}

export async function getActiveLoanForAsset(
  organizationId: string,
  assetId: string,
): Promise<{ id: string } | null> {
  return withOrg(organizationId, (tx) =>
    tx.loan.findFirst({
      where: { organizationId, assetId, returnedAt: null },
      select: { id: true },
    }),
  )
}
