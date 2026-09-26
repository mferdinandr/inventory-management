import "server-only"
import { dbPublic } from "@/server/db-public"

// FR-24 (docs/02-prd.md §G): halaman hasil pemindaian QR. Kolom aman dipilih
// satu per satu (bukan "ambil semua lalu saring") — dan sungguh tidak bisa
// diperluas diam-diam, karena role simaset_public secara harfiah tidak
// memiliki izin SELECT atas kolom lain (lihat migrasi
// 20260924145959_public_page_grants). Menambah field ke sini tanpa GRANT-nya
// akan gagal di database, bukan diam-diam bocor.

export type PublicAsset = {
  publicId: string
  assetCode: string
  name: string
  categoryName: string | null
  brand: string | null
  model: string | null
  locationName: string
  status: string
  condition: string
  picName: string | null
  nextCalibrationDue: string | null
  isDisposed: boolean
  organizationName: string
  organizationLogoUrl: string | null
  recentEvents: Array<{ id: string; type: string; title: string; occurredAt: string }>
}

export async function getPublicAsset(publicId: string): Promise<PublicAsset | null> {
  const asset = await dbPublic.asset.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      assetCode: true,
      name: true,
      brand: true,
      model: true,
      status: true,
      condition: true,
      organizationId: true,
      locationId: true,
      categoryId: true,
    },
  })
  if (!asset) return null

  const [location, category, org, schedule, events] = await Promise.all([
    dbPublic.location.findUnique({
      where: { id: asset.locationId },
      select: { name: true, picUserId: true },
    }),
    asset.categoryId
      ? dbPublic.category.findUnique({ where: { id: asset.categoryId }, select: { name: true } })
      : Promise.resolve(null),
    dbPublic.organization.findUnique({
      where: { id: asset.organizationId },
      select: { name: true, logoObjectKey: true },
    }),
    dbPublic.maintenanceSchedule.findFirst({
      where: { assetId: asset.id, isActive: true },
      orderBy: { nextDueAt: "asc" },
      select: { nextDueAt: true },
    }),
    dbPublic.assetEvent.findMany({
      where: { assetId: asset.id },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: { id: true, type: true, title: true, occurredAt: true },
    }),
  ])

  const pic = location?.picUserId
    ? await dbPublic.user.findUnique({ where: { id: location.picUserId }, select: { name: true } })
    : null

  return {
    publicId: asset.publicId,
    assetCode: asset.assetCode,
    name: asset.name,
    categoryName: category?.name ?? null,
    brand: asset.brand,
    model: asset.model,
    locationName: location?.name ?? "",
    status: asset.status,
    condition: asset.condition,
    picName: pic?.name ?? null,
    nextCalibrationDue: schedule?.nextDueAt?.toISOString().slice(0, 10) ?? null,
    isDisposed: asset.status === "DISPOSED",
    organizationName: org?.name ?? "",
    organizationLogoUrl: org?.logoObjectKey ?? null,
    recentEvents: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      occurredAt: e.occurredAt.toISOString(),
    })),
  }
}
