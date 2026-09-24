import "server-only"
import type { Prisma } from "../../generated/prisma/client"
import { db, withOrg } from "./db"

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuotaExceededError"
  }
}

export class OrganizationSuspendedError extends Error {
  constructor() {
    super("Organisasi ini sedang ditangguhkan — hanya dapat dibaca. Hubungi pengelola SIMASET.")
    this.name = "OrganizationSuspendedError"
  }
}

/**
 * FR-01 / docs/03-erd.md §3.1: organisasi `SUSPENDED` hanya dapat membaca.
 * Dipanggil di awal setiap mutasi di dalam withOrg(); berlaku juga saat pemilik
 * platform sedang "masuk sebagai" organisasi tersebut.
 */
export async function assertOrgWritable(
  organizationId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { status: true },
  })
  if (!org) throw new Error("Organisasi tidak ditemukan")
  if (org.status === "SUSPENDED") throw new OrganizationSuspendedError()
}

/** Untuk penanda "hanya baca" di tata letak aplikasi. */
export async function isOrgSuspended(organizationId: string): Promise<boolean> {
  const org = await withOrg(organizationId, (tx) =>
    tx.organization.findUnique({ where: { id: organizationId }, select: { status: true } }),
  )
  return org?.status === "SUSPENDED"
}

export type QuotaUsage = {
  status: "TRIAL" | "ACTIVE" | "SUSPENDED"
  quota: { assets: number; storageBytes: bigint; users: number }
  usage: { assets: number; storageBytes: bigint; users: number }
}

/**
 * FR-01c: "Admin organisasi dapat melihat pemakaian kuotanya sendiri." Definisi
 * "terpakai" sama dengan pemeriksaan di bawah dan dengan panel operator.
 */
export async function getQuotaUsage(organizationId: string): Promise<QuotaUsage> {
  return withOrg(organizationId, (tx) => readQuotaUsage(organizationId, tx))
}

async function readQuotaUsage(
  organizationId: string,
  tx: Prisma.TransactionClient,
): Promise<QuotaUsage> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: {
      status: true,
      quotaAssets: true,
      quotaStorageBytes: true,
      quotaUsers: true,
      usedStorageBytes: true,
    },
  })
  if (!org) throw new Error("Organisasi tidak ditemukan")
  // Berurutan, bukan Promise.all: keduanya berbagi satu koneksi transaksi.
  const assets = await tx.asset.count({
    where: { organizationId, status: { not: "DISPOSED" } },
  })
  const users = await tx.user.count({
    where: { organizationId, status: { in: ["ACTIVE", "INVITED"] } },
  })
  return {
    status: org.status,
    quota: { assets: org.quotaAssets, storageBytes: org.quotaStorageBytes, users: org.quotaUsers },
    usage: { assets, storageBytes: org.usedStorageBytes, users },
  }
}

export async function assertAssetQuota(
  organizationId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { quotaAssets: true },
  })
  if (!org) throw new Error("Organisasi tidak ditemukan")
  const used = await client.asset.count({
    where: { organizationId, status: { not: "DISPOSED" } },
  })
  if (used >= org.quotaAssets) {
    throw new QuotaExceededError("Kuota aset organisasi sudah penuh.")
  }
}

export async function assertStorageQuota(
  organizationId: string,
  additionalBytes: bigint,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { quotaStorageBytes: true, usedStorageBytes: true },
  })
  if (!org) throw new Error("Organisasi tidak ditemukan")
  if (org.usedStorageBytes + additionalBytes > org.quotaStorageBytes) {
    throw new QuotaExceededError("Kuota penyimpanan organisasi sudah terlampaui.")
  }
}

export async function assertUserQuota(
  organizationId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db
  const org = await client.organization.findUnique({
    where: { id: organizationId },
    select: { quotaUsers: true },
  })
  if (!org) throw new Error("Organisasi tidak ditemukan")
  const used = await client.user.count({
    where: { organizationId, status: { in: ["ACTIVE", "INVITED"] } },
  })
  if (used >= org.quotaUsers) {
    throw new QuotaExceededError("Kuota pengguna organisasi sudah penuh.")
  }
}
