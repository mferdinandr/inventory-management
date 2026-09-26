import { PrismaPg } from "@prisma/adapter-pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PrismaClient } from "../generated/prisma/client"
import { createAsset } from "../src/server/services/asset.service"
import {
  checkoutLoan,
  getActiveLoanForAsset,
  LoanError,
  listActiveLoans,
  returnLoan,
} from "../src/server/services/loan.service"

const setup = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL_PLATFORM ?? process.env.DATABASE_URL ?? "",
  }),
})

let orgId: string
let adminId: string
let roomId: string
let categoryId: string

beforeAll(async () => {
  const org = await setup.organization.findFirstOrThrow({
    where: { code: "RS01" },
    select: { id: true },
  })
  orgId = org.id
  const admin = await setup.user.findFirstOrThrow({
    where: { organizationId: orgId, role: "SUPERADMIN" },
    select: { id: true },
  })
  adminId = admin.id
  const room = await setup.location.findFirstOrThrow({
    where: { organizationId: orgId, type: "ROOM" },
    select: { id: true },
  })
  roomId = room.id
  const fur = await setup.category.findFirstOrThrow({
    where: { organizationId: orgId, code: "FUR" },
    select: { id: true },
  })
  categoryId = fur.id
})

afterAll(async () => {
  await setup.$disconnect()
})

async function makeAsset() {
  return createAsset(orgId, adminId, {
    name: `Aset Pinjam ${Date.now()}-${Math.random().toString(36).slice(2)}`,
    categoryId,
    locationId: roomId,
    condition: "GOOD",
    acquisitionDate: new Date("2026-01-15"),
    brand: null,
    model: null,
    serialNumber: null,
    yearManufactured: null,
    fundingSource: null,
    acquisitionCost: null,
    acquisitionDocumentNo: null,
    warrantyUntil: null,
    economicLifeYears: null,
    notes: null,
    confirmDuplicateSerial: false,
  })
}

describe("checkoutLoan (FR-18)", () => {
  it("checks out to an external person and sets the asset ON_LOAN", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Budi Santoso",
      borrowerPhone: "081234567890",
      purpose: "Perbaikan di rumah",
      dueAt: null,
      conditionOut: "GOOD",
    })
    expect(loanId).toBeTruthy()

    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("ON_LOAN")

    const loanEvent = await setup.assetEvent.findFirstOrThrow({
      where: { assetId: asset.id, type: "LOAN_OUT" },
    })
    expect(loanEvent.statusAfter).toBe("ON_LOAN")
  })

  it("checks out to a registered internal user", async () => {
    const asset = await makeAsset()
    const borrower = await setup.user.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
    })
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "INTERNAL_USER",
      borrowerUserId: borrower.id,
      purpose: "Dipakai di ruangan lain",
      dueAt: null,
      conditionOut: "GOOD",
    })
    const loan = await setup.loan.findUniqueOrThrow({ where: { id: loanId } })
    expect(loan.borrowerUserId).toBe(borrower.id)
  })

  it("rejects checkout for an asset that is already ON_LOAN, LOST, or DISPOSED", async () => {
    const asset = await makeAsset()
    await setup.asset.update({ where: { id: asset.id }, data: { status: "LOST" } })
    await expect(
      checkoutLoan(orgId, adminId, {
        assetId: asset.id,
        borrowerType: "EXTERNAL_PERSON",
        borrowerName: "X",
        borrowerPhone: "0800",
        purpose: "test",
        dueAt: null,
        conditionOut: "GOOD",
      }),
    ).rejects.toThrow(LoanError)
  })

  it("a second concurrent checkout of the same asset is rejected with one clear error", async () => {
    const asset = await makeAsset()
    const attempt = () =>
      checkoutLoan(orgId, adminId, {
        assetId: asset.id,
        borrowerType: "EXTERNAL_PERSON",
        borrowerName: "Peminjam",
        borrowerPhone: "0812",
        purpose: "Rebutan",
        dueAt: null,
        conditionOut: "GOOD",
      })

    const results = await Promise.allSettled([attempt(), attempt()])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LoanError)

    const loans = await setup.loan.findMany({ where: { assetId: asset.id, returnedAt: null } })
    expect(loans).toHaveLength(1)
  })
})

describe("returnLoan (FR-19)", () => {
  it("returns to AVAILABLE on good condition and logs a LOAN_RETURN event", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Peminjam",
      borrowerPhone: "0812",
      purpose: "test",
      dueAt: null,
      conditionOut: "GOOD",
    })

    await returnLoan(orgId, adminId, { loanId, conditionIn: "GOOD", returnNotes: null })

    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("AVAILABLE")
    const loan = await setup.loan.findUniqueOrThrow({ where: { id: loanId } })
    expect(loan.returnedAt).not.toBeNull()

    const returnEvent = await setup.assetEvent.findFirstOrThrow({
      where: { assetId: asset.id, type: "LOAN_RETURN" },
    })
    expect(returnEvent.statusAfter).toBe("AVAILABLE")
  })

  it("returns to DAMAGED when the condition is reported as needing repair", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Peminjam",
      borrowerPhone: "0812",
      purpose: "test",
      dueAt: null,
      conditionOut: "GOOD",
    })
    await returnLoan(orgId, adminId, {
      loanId,
      conditionIn: "UNUSABLE",
      returnNotes: "Layar pecah",
    })
    const after = await setup.asset.findUniqueOrThrow({ where: { id: asset.id } })
    expect(after.status).toBe("DAMAGED")
  })

  it("rejects returning a loan twice", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Peminjam",
      borrowerPhone: "0812",
      purpose: "test",
      dueAt: null,
      conditionOut: "GOOD",
    })
    await returnLoan(orgId, adminId, { loanId, conditionIn: "GOOD", returnNotes: null })
    await expect(
      returnLoan(orgId, adminId, { loanId, conditionIn: "GOOD", returnNotes: null }),
    ).rejects.toThrow(LoanError)
  })
})

describe("listActiveLoans / getActiveLoanForAsset (FR-20)", () => {
  it("flags a loan with a past due date as overdue", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Peminjam",
      borrowerPhone: "0812",
      purpose: "test",
      dueAt: new Date(Date.now() - 1000),
      conditionOut: "GOOD",
    })
    const items = await listActiveLoans(orgId)
    const row = items.find((l) => l.id === loanId)
    expect(row?.isOverdue).toBe(true)
  })

  it("getActiveLoanForAsset finds the open loan for an ON_LOAN asset", async () => {
    const asset = await makeAsset()
    const { loanId } = await checkoutLoan(orgId, adminId, {
      assetId: asset.id,
      borrowerType: "EXTERNAL_PERSON",
      borrowerName: "Peminjam",
      borrowerPhone: "0812",
      purpose: "test",
      dueAt: null,
      conditionOut: "GOOD",
    })
    expect((await getActiveLoanForAsset(orgId, asset.id))?.id).toBe(loanId)
  })
})
