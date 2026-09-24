import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString =
  process.env.DATABASE_URL_MIGRATION ??
  process.env.DATABASE_URL ??
  "postgresql://simaset:simaset-dev-only@localhost:5432/simaset"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const PASSWORD = "simaset-demo-2026"
const QUOTA_ASSETS = 2000
const QUOTA_STORAGE = BigInt(21474836480)
const QUOTA_USERS = 50
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

async function randomPublicId(): Promise<string> {
  let out = ""
  for (let i =  0; i < 12; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!
  }
  return out
}

type LocationTypeLiteral = "BUILDING" | "FLOOR" | "DEPARTMENT" | "ROOM"
type CategoryDef = {
  name: string
  code: string
  isMedicalDevice: boolean
  calibration: number | null
}

async function findOrCreateLocation(params: {
  orgId: string
  parentId: string | null
  type: LocationTypeLiteral
  name: string
  code?: string
  path: string
}) {
  const existing = await prisma.location.findFirst({
    where: {
      organizationId: params.orgId,
      parentId: params.parentId,
      name: params.name,
    },
  })
  if (existing) return existing
  return prisma.location.create({
    data: {
      organizationId: params.orgId,
      parentId: params.parentId,
      type: params.type,
      name: params.name,
      code: params.code,
      path: params.path,
    },
  })
}

async function findOrCreateCategory(orgId: string, def: CategoryDef) {
  const existing = await prisma.category.findFirst({
    where: { organizationId: orgId, name: def.name },
  })
  if (existing) return existing
  return prisma.category.create({
    data: {
      organizationId: orgId,
      parentId: null,
      name: def.name,
      code: def.code,
      isMedicalDevice: def.isMedicalDevice,
      defaultCalibrationIntervalMonths: def.calibration,
    },
  })
}

type OrgAssetDef = { name: string; brand: string; serial: string }
type OrgSeed = {
  code: string
  name: string
  adminEmail: string
  assets: readonly OrgAssetDef[]
}

async function seedOrganization(spec: OrgSeed, passwordHash: string) {
  const org = await prisma.organization.upsert({
    where: { code: spec.code },
    update: {},
    create: {
      code: spec.code,
      name: spec.name,
      status: "ACTIVE",
      timezone: "Asia/Jakarta",
      quotaAssets: QUOTA_ASSETS,
      quotaStorageBytes: QUOTA_STORAGE,
      quotaUsers: QUOTA_USERS,
      contactPhone: "0812-0000-0000",
    },
  })

  const admin = await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: org.id, email: spec.adminEmail },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: spec.adminEmail,
      name: "Admin Super",
      passwordHash,
      role: "SUPERADMIN",
      status: "ACTIVE",
    },
  })

  const catEM = await findOrCreateCategory(org.id, {
    name: "Elektromedik",
    code: "EM",
    isMedicalDevice: true,
    calibration:  12,
  })
  const catAPM = await findOrCreateCategory(org.id, {
    name: "Alat Penunjang Medis",
    code: "APM",
    isMedicalDevice: true,
    calibration:  12,
  })
  const catFUR = await findOrCreateCategory(org.id, {
    name: "Furnitur",
    code: "FUR",
    isMedicalDevice: false,
    calibration: null,
  })
  const catIT = await findOrCreateCategory(org.id, {
    name: "Perangkat IT",
    code: "IT",
    isMedicalDevice: false,
    calibration: null,
  })
  const catART = await findOrCreateCategory(org.id, {
    name: "Alat Rumah Tangga",
    code: "ART",
    isMedicalDevice: false,
    calibration: null,
  })
  const catKEND = await findOrCreateCategory(org.id, {
    name: "Kendaraan",
    code: "KEND",
    isMedicalDevice: false,
    calibration: null,
  })

  const gedung = await findOrCreateLocation({
    orgId: org.id,
    parentId: null,
    type: "BUILDING",
    name: "Gedung Utama",
    path: "G",
  })
  const lantai = await findOrCreateLocation({
    orgId: org.id,
    parentId: gedung.id,
    type: "FLOOR",
    name: "Lantai 1",
    path: `${gedung.id}`,
  })
  const instalasi = await findOrCreateLocation({
    orgId: org.id,
    parentId: lantai.id,
    type: "DEPARTMENT",
    name: "Instalasi Radiologi",
    code: "RAD",
    path: `${gedung.id}/${lantai.id}`,
  })
  const ruang1 = await findOrCreateLocation({
    orgId: org.id,
    parentId: instalasi.id,
    type: "ROOM",
    name: "Ruang Radiologi 1",
    path: `${gedung.id}/${lantai.id}/${instalasi.id}`,
  })
  const ruang2 = await findOrCreateLocation({
    orgId: org.id,
    parentId: instalasi.id,
    type: "ROOM",
    name: "Ruang Radiologi 2",
    path: `${gedung.id}/${lantai.id}/${instalasi.id}`,
  })

  for (let i =  0; i < spec.assets.length; i++) {
    const def = spec.assets[i]!
    const assetCode = `${org.code}-RAD-000${i + 1}`
    const existing = await prisma.asset.findUnique({
      where: {
        organizationId_assetCode: { organizationId: org.id, assetCode },
      },
    })
    if (existing) continue
    const asset = await prisma.asset.create({
      data: {
        organizationId: org.id,
        publicId: await randomPublicId(),
        assetCode,
        name: def.name,
        brand: def.brand,
        serialNumber: def.serial,
        categoryId: catEM.id,
        locationId: i ===  0 ? ruang1.id : ruang2.id,
        acquisitionDate: new Date("2024-06-01"),
        acquisitionCost: "45000000",
        fundingSource:"APBD",
        acquisitionDocumentNo:"PPK-2024-0101",
        warrantyUntil: new Date("2027-06-01"),
        condition:"GOOD",
        status: "AVAILABLE",
        createdBy: admin.id,
      },
    })

    // FR-15: setiap aset baru otomatis memiliki entri riwayat pertama bertipe
    // CREATED. event.service.ts (M3) akan menjadi satu-satunya penulis ini di
    // luar seed; di sini ditulis langsung karena layanan itu belum ada.
    await prisma.assetEvent.create({
      data: {
        organizationId: org.id,
        assetId: asset.id,
        type: "CREATED",
        title: "Aset didaftarkan",
        occurredAt: asset.acquisitionDate ?? new Date("2024-06-01"),
        recordedBy: admin.id,
        locationId: asset.locationId,
        statusAfter: "AVAILABLE",
      },
    })
  }
}

async function main() {
  const ownerEmail = process.env.SIMASET_OWNER_EMAIL ?? "owner@simaset.test"
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const owner = await prisma.user.findFirst({
    where: { email: ownerEmail, organizationId: null },
  })
  if (!owner) {
    await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Pemilik Platform",
        passwordHash,
        role: "PLATFORM_OWNER",
        status: "ACTIVE",
      },
    })
  }

  const specs: OrgSeed[] = [
    {
      code: "RS01",
      name: "Rumah Sakit Harapan Sehat",
      adminEmail: "admin1@simaset.test",
      assets: [
        { name: "X-Ray Mobile", brand: "Shimadzu", serial: "XR-2024-001" },
        { name: "ECG 12 Sadapan", brand: "Nihon Kohden", serial: "ECG-2023-118" },
      ],
    },
    {
      code: "RS02",
      name: "RS Bhakti Medika",
      adminEmail: "admin2@simaset.test",
      assets: [
        { name: "X-Ray Mobile", brand: "Shimadzu", serial: "XR-2024-001" },
        { name: "Infus Pump", brand: "B.Braun", serial: "IVP-2024-207" },
      ],
    },
  ]

  for (const spec of specs) {
    await seedOrganization(spec, passwordHash)

  }

  console.log("Seed selesai: 1 pemilik platform,  2 organisasi,")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })