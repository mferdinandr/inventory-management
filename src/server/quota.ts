import "server-only"
import { db } from "./db"
import type { Prisma } from "../../generated/prisma/client"

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QuotaExceededError"
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