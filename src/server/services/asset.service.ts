import "server-only"
import { formatAssetCode, generatePublicId } from "@/lib/asset-code"
import type { AssetFormInput } from "@/lib/validators/asset"
import { withOrg } from "@/server/db"
import { assertAssetQuota, assertOrgWritable } from "@/server/quota"
import type { Prisma } from "../../../generated/prisma/client"
import type { AssetCondition, AssetStatus } from "../../../generated/prisma/enums"

// FR-06/FR-08/FR-13/FR-14 (docs/02-prd.md). Setiap mutasi berjalan di dalam
// withOrg() agar tunduk RLS; lihat docs/04 ADR-08.

export class AssetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AssetError"
  }
}

export class DuplicateSerialError extends Error {
  constructor(
    message: string,
    public readonly existingAssetCode: string,
  ) {
    super(message)
    this.name = "DuplicateSerialError"
  }
}

type Tx = Prisma.TransactionClient

function isUniqueViolation(e: unknown, target: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002" &&
    JSON.stringify((e as { meta?: unknown }).meta ?? "").includes(target)
  )
}

/**
 * Ruangan → kode instalasi. `path` menyimpan rantai id leluhur tanpa id
 * sendiri (docs/03-erd.md §3.4); untuk sebuah ROOM, leluhur terakhir SELALU
 * DEPARTMENT-nya (aturan induk-jenis, lihat lib/location.ts). Tanpa kode
 * instalasi, asset_code tidak bisa dibentuk — diperiksa lebih dulu daripada
 * membiarkan pengguna mengisi seluruh formulir lalu gagal di akhir.
 */
async function departmentCodeForRoom(tx: Tx, locationId: string): Promise<string> {
  const room = await tx.location.findUnique({
    where: { id: locationId },
    select: { type: true, path: true },
  })
  if (room?.type !== "ROOM") {
    throw new AssetError("Lokasi yang dipilih bukan ruangan.")
  }
  const departmentId = room.path.split("/").at(-1)
  if (!departmentId) throw new AssetError("Ruangan ini belum memiliki instalasi induk.")
  const department = await tx.location.findUnique({
    where: { id: departmentId },
    select: { code: true, name: true },
  })
  if (!department?.code) {
    throw new AssetError(
      `Instalasi "${department?.name ?? ""}" belum memiliki kode. Isi kode instalasi di Pengaturan Lokasi sebelum mendaftarkan aset di sini.`,
    )
  }
  return department.code
}

async function nextSequence(
  tx: Tx,
  organizationId: string,
  orgCode: string,
  departmentCode: string,
  year: number,
): Promise<number> {
  const prefix = `${orgCode}-${departmentCode}-${year}-`
  const count = await tx.asset.count({
    where: { organizationId, assetCode: { startsWith: prefix } },
  })
  return count + 1
}

export type CreateAssetResult = { id: string; publicId: string; assetCode: string }

export async function createAsset(
  organizationId: string,
  actorUserId: string,
  input: AssetFormInput,
): Promise<CreateAssetResult> {
  return withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    await assertAssetQuota(organizationId, tx)

    if (input.serialNumber && !input.confirmDuplicateSerial) {
      const dupe = await tx.asset.findFirst({
        where: { organizationId, serialNumber: input.serialNumber },
        select: { assetCode: true },
      })
      if (dupe) {
        throw new DuplicateSerialError(
          `Nomor seri ini sudah dipakai oleh aset ${dupe.assetCode}.`,
          dupe.assetCode,
        )
      }
    }

    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { code: true },
    })
    const departmentCode = await departmentCodeForRoom(tx, input.locationId)
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, organizationId },
      select: { isMedicalDevice: true, defaultCalibrationIntervalMonths: true },
    })
    if (!category) throw new AssetError("Kategori tidak ditemukan.")

    const year = input.acquisitionDate.getFullYear()

    // Tabrakan public_id/asset_code astronomis kecil kemungkinannya (docs/08:
    // 57^12 kombinasi), tapi diperiksa dan diulang sesuai dok, bukan diasumsikan
    // tidak akan pernah terjadi. Postgres membatalkan SELURUH transaksi begitu
    // satu statement gagal (unique violation termasuk) — tanpa SAVEPOINT di
    // sini, percobaan ulang di dalam tx yang sama akan langsung gagal lagi
    // dengan "current transaction is aborted" pada percobaan berikutnya.
    for (let attempt = 0; attempt < 5; attempt++) {
      const publicId = generatePublicId()
      const sequence = await nextSequence(tx, organizationId, org.code, departmentCode, year)
      const assetCode = formatAssetCode({
        orgCode: org.code,
        departmentCode,
        year,
        sequence,
      })
      await tx.$executeRawUnsafe("SAVEPOINT asset_create_attempt")
      try {
        const asset = await tx.asset.create({
          data: {
            organizationId,
            publicId,
            assetCode,
            name: input.name,
            categoryId: input.categoryId,
            locationId: input.locationId,
            condition: input.condition,
            status: "AVAILABLE",
            brand: input.brand,
            model: input.model,
            serialNumber: input.serialNumber,
            yearManufactured: input.yearManufactured,
            acquisitionDate: input.acquisitionDate,
            acquisitionCost: input.acquisitionCost,
            fundingSource: input.fundingSource,
            acquisitionDocumentNo: input.acquisitionDocumentNo,
            warrantyUntil: input.warrantyUntil,
            economicLifeYears: input.economicLifeYears,
            notes: input.notes,
            createdBy: actorUserId,
          },
          select: { id: true, publicId: true, assetCode: true, locationId: true },
        })

        // FR-15: entri riwayat pertama, otomatis, bertipe CREATED.
        await tx.assetEvent.create({
          data: {
            organizationId,
            assetId: asset.id,
            type: "CREATED",
            title: "Aset didaftarkan",
            occurredAt: input.acquisitionDate,
            recordedBy: actorUserId,
            locationId: asset.locationId,
            statusAfter: "AVAILABLE",
          },
        })

        // FR-06: aset berkategori medis otomatis dibuatkan jadwal kalibrasi
        // bila intervalnya tersedia. Pencatatan pelaksanaan (M5) belum ada;
        // ini hanya membuat jadwalnya.
        if (category.isMedicalDevice && category.defaultCalibrationIntervalMonths) {
          const nextDue = new Date(input.acquisitionDate)
          nextDue.setMonth(nextDue.getMonth() + category.defaultCalibrationIntervalMonths)
          await tx.maintenanceSchedule.create({
            data: {
              organizationId,
              assetId: asset.id,
              type: "CALIBRATION",
              intervalMonths: category.defaultCalibrationIntervalMonths,
              nextDueAt: nextDue,
            },
          })
        }

        await tx.$executeRawUnsafe("RELEASE SAVEPOINT asset_create_attempt")
        return asset
      } catch (e) {
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT asset_create_attempt")
        if (isUniqueViolation(e, "public_id")) continue // ulangi dengan public_id baru
        if (isUniqueViolation(e, "asset_code")) continue // ulangi dengan urutan baru
        throw e
      }
    }
    throw new AssetError("Gagal membuat kode aset setelah beberapa percobaan. Coba lagi.")
  })
}

export type AssetListItem = {
  id: string
  assetCode: string
  publicId: string
  name: string
  status: AssetStatus
  condition: AssetCondition
  brand: string | null
  model: string | null
  locationName: string
  categoryName: string | null
}

export type AssetListFilter = {
  q?: string
  locationId?: string
  categoryId?: string
  status?: AssetStatus
  includeDisposed?: boolean
  cursor?: string
  limit?: number
}

export async function listAssets(
  organizationId: string,
  filter: AssetListFilter,
): Promise<{ items: AssetListItem[]; nextCursor: string | null }> {
  const limit = Math.min(filter.limit ?? 25, 100)
  return withOrg(organizationId, async (tx) => {
    const where: Prisma.AssetWhereInput = {
      organizationId,
      ...(filter.includeDisposed ? {} : { status: { not: "DISPOSED" } }),
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: "insensitive" } },
              { assetCode: { contains: filter.q, mode: "insensitive" } },
              { serialNumber: { contains: filter.q, mode: "insensitive" } },
              { brand: { contains: filter.q, mode: "insensitive" } },
              { model: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const rows = await tx.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        assetCode: true,
        publicId: true,
        name: true,
        status: true,
        condition: true,
        brand: true,
        model: true,
        location: { select: { name: true } },
        category: { select: { name: true } },
      },
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    return {
      items: page.map((r) => ({
        id: r.id,
        assetCode: r.assetCode,
        publicId: r.publicId,
        name: r.name,
        status: r.status,
        condition: r.condition,
        brand: r.brand,
        model: r.model,
        locationName: r.location.name,
        categoryName: r.category?.name ?? null,
      })),
      nextCursor: hasMore ? page.at(-1)!.id : null,
    }
  })
}

/**
 * FR-25: pemindai di dalam aplikasi langsung menuju halaman aset saat QR
 * terbaca. QR memuat public_id (global, lihat docs/08-qr-labeling.md), tapi
 * navigasi di dalam aplikasi memakai id internal — dicari lewat sesi
 * (RLS-bound) pemindai, sehingga aset milik organisasi lain otomatis tidak
 * pernah ditemukan di sini (bukan hanya "disembunyikan", benar-benar
 * mengembalikan null seperti tidak ada).
 */
export async function findAssetIdByPublicId(
  organizationId: string,
  publicId: string,
): Promise<string | null> {
  const asset = await withOrg(organizationId, (tx) =>
    tx.asset.findFirst({ where: { organizationId, publicId }, select: { id: true } }),
  )
  return asset?.id ?? null
}

/** FR-25: isian manual asset_code sebagai cadangan bila label rusak. */
export async function findAssetIdByCode(
  organizationId: string,
  assetCode: string,
): Promise<string | null> {
  const asset = await withOrg(organizationId, (tx) =>
    tx.asset.findFirst({
      where: { organizationId, assetCode: { equals: assetCode, mode: "insensitive" } },
      select: { id: true },
    }),
  )
  return asset?.id ?? null
}

export async function getAssetDetail(organizationId: string, assetId: string) {
  return withOrg(organizationId, (tx) =>
    tx.asset.findFirst({
      where: { id: assetId, organizationId },
      include: {
        category: true,
        location: true,
        vendor: true,
        responsibleUser: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        events: {
          orderBy: { occurredAt: "desc" },
          take: 30,
          include: {
            recordedByUser: { select: { id: true, name: true } },
            attachments: { select: { id: true, mimeType: true, originalFilename: true } },
            corrections: { select: { id: true } },
            correctsEvent: { select: { id: true, title: true } },
          },
        },
        labelPrints: { orderBy: { printedAt: "desc" }, take: 10 },
      },
    }),
  )
}

/**
 * FR-13/FR-14: mencetak label — baik pertama kali maupun cetak ulang — selalu
 * mengarah ke public_id yang sama dan tercatat di label_prints serta riwayat.
 */
export async function recordLabelPrint(
  organizationId: string,
  actorUserId: string,
  assetId: string,
  reason: "FIRST_PRINT" | "LABEL_DAMAGED" | "LABEL_LOST" | "LABEL_FADED" | "RELOCATED",
  labelSize: string,
): Promise<void> {
  await withOrg(organizationId, async (tx) => {
    await assertOrgWritable(organizationId, tx)
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId },
      select: { id: true, locationId: true, qrFirstPrintedAt: true },
    })
    if (!asset) throw new AssetError("Aset tidak ditemukan.")

    await tx.labelPrint.create({
      data: { organizationId, assetId, reason, labelSize, printedBy: actorUserId },
    })

    if (!asset.qrFirstPrintedAt) {
      await tx.asset.update({ where: { id: assetId }, data: { qrFirstPrintedAt: new Date() } })
    }

    await tx.assetEvent.create({
      data: {
        organizationId,
        assetId,
        type: "LABEL_PRINTED",
        title: reason === "FIRST_PRINT" ? "Label dicetak pertama kali" : "Label dicetak ulang",
        occurredAt: new Date(),
        recordedBy: actorUserId,
        locationId: asset.locationId,
        metadata: { reason, labelSize },
      },
    })
  })
}
