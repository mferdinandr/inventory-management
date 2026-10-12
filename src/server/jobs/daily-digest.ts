import "server-only"
import { dbPlatform } from "@/server/db-platform"
import { escapeHtml, sendMail } from "@/server/mailer"

// FR-28 (docs/02-prd.md §H, v1.1): ringkasan harian pukul 07:00 menurut zona
// waktu masing-masing organisasi, ke Admin dan PIC terkait, berisi jatuh
// tempo kalibrasi 30 hari ke depan dan peminjaman yang telah melewati
// ambang. Tidak dikirim bila tidak ada isi yang perlu dilaporkan.

/** Jam lokal organisasi saat ini (0-23), dihitung dari zona waktu IANA-nya. */
export function localHour(timezone: string, at: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(at)
  // Intl mengembalikan "24" untuk tengah malam pada beberapa locale/runtime.
  return Number(formatted) % 24
}

function localDateKey(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at) // yyyy-mm-dd
}

type DueCalibrationLine = { assetCode: string; assetName: string; nextDueAt: Date }
type OverdueLoanLine = {
  assetCode: string
  assetName: string
  borrowerLabel: string
  daysOverdue: number
}

async function collectDigestContent(organizationId: string): Promise<{
  dueCalibrations: DueCalibrationLine[]
  overdueLoans: OverdueLoanLine[]
  affectedRoomIds: Set<string>
}> {
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 86_400_000)

  const schedules = await dbPlatform.maintenanceSchedule.findMany({
    where: {
      organizationId,
      isActive: true,
      nextDueAt: { lte: in30Days },
      asset: { organizationId, status: { not: "DISPOSED" } },
    },
    select: {
      nextDueAt: true,
      asset: { select: { assetCode: true, name: true, locationId: true } },
    },
  })

  const org = await dbPlatform.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { loanOverdueThresholdDays: true },
  })
  const loans = await dbPlatform.loan.findMany({
    where: { organizationId, returnedAt: null },
    select: {
      dueAt: true,
      borrowedAt: true,
      borrowerType: true,
      borrowerName: true,
      borrowerUser: { select: { name: true } },
      asset: { select: { assetCode: true, name: true, locationId: true } },
    },
  })

  const affectedRoomIds = new Set<string>()
  for (const s of schedules) affectedRoomIds.add(s.asset.locationId)

  const overdueLoans: OverdueLoanLine[] = []
  for (const l of loans) {
    const days = Math.floor((now.getTime() - l.borrowedAt.getTime()) / 86_400_000)
    const isOverdue = l.dueAt
      ? l.dueAt.getTime() < now.getTime()
      : days > org.loanOverdueThresholdDays
    if (!isOverdue) continue
    affectedRoomIds.add(l.asset.locationId)
    overdueLoans.push({
      assetCode: l.asset.assetCode,
      assetName: l.asset.name,
      borrowerLabel:
        l.borrowerType === "INTERNAL_USER"
          ? (l.borrowerUser?.name ?? "—")
          : (l.borrowerName ?? "—"),
      daysOverdue: l.dueAt ? Math.floor((now.getTime() - l.dueAt.getTime()) / 86_400_000) : days,
    })
  }

  return {
    dueCalibrations: schedules.map((s) => ({
      assetCode: s.asset.assetCode,
      assetName: s.asset.name,
      nextDueAt: s.nextDueAt,
    })),
    overdueLoans,
    affectedRoomIds,
  }
}

function renderDigestHtml(
  orgName: string,
  dueCalibrations: DueCalibrationLine[],
  overdueLoans: OverdueLoanLine[],
): string {
  const calibrationRows = dueCalibrations
    .map(
      (c) =>
        `<li>${escapeHtml(c.assetCode)} — ${escapeHtml(c.assetName)}: jatuh tempo ${c.nextDueAt.toLocaleDateString("id-ID")}</li>`,
    )
    .join("")
  const loanRows = overdueLoans
    .map(
      (l) =>
        `<li>${escapeHtml(l.assetCode)} — ${escapeHtml(l.assetName)}: dipinjam ${escapeHtml(l.borrowerLabel)}, telat ${l.daysOverdue} hari</li>`,
    )
    .join("")

  return `
    <p>Ringkasan harian SIMASET — ${escapeHtml(orgName)}</p>
    ${dueCalibrations.length > 0 ? `<h3>Kalibrasi jatuh tempo 30 hari ke depan</h3><ul>${calibrationRows}</ul>` : ""}
    ${overdueLoans.length > 0 ? `<h3>Peminjaman telat</h3><ul>${loanRows}</ul>` : ""}
  `
}

/**
 * Dipanggil oleh worker terjadwal (bukan diimpor dari kode aplikasi biasa —
 * lihat scheduler.ts) untuk satu organisasi yang jam lokalnya sedang 07:00.
 * Idempoten per hari: memeriksa email_logs sebelum mengirim, sehingga aman
 * dipanggil lebih dari sekali dalam jam yang sama.
 */
export async function sendDailyDigestForOrg(organizationId: string): Promise<void> {
  const org = await dbPlatform.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, timezone: true },
  })
  const dateKey = localDateKey(org.timezone)

  const alreadySent = await dbPlatform.emailLog.findFirst({
    where: {
      organizationId,
      template: "daily-digest",
      sentAt: { gte: new Date(`${dateKey}T00:00:00Z`) },
    },
  })
  if (alreadySent) return

  const { dueCalibrations, overdueLoans, affectedRoomIds } =
    await collectDigestContent(organizationId)
  if (dueCalibrations.length === 0 && overdueLoans.length === 0) return // FR-28: tidak dikirim bila tidak ada isi

  const admins = await dbPlatform.user.findMany({
    where: { organizationId, role: { in: ["SUPERADMIN", "ADMIN"] }, status: "ACTIVE" },
    select: { email: true },
  })
  const pics = affectedRoomIds.size
    ? await dbPlatform.user.findMany({
        where: {
          organizationId,
          role: "PIC_ROOM",
          status: "ACTIVE",
          picLocations: { some: { id: { in: Array.from(affectedRoomIds) } } },
        },
        select: { email: true },
      })
    : []

  const recipients = Array.from(new Set([...admins, ...pics].map((u) => u.email)))
  if (recipients.length === 0) return

  const html = renderDigestHtml(org.name, dueCalibrations, overdueLoans)
  for (const to of recipients) {
    await sendMail({
      to,
      subject: `Ringkasan harian SIMASET — ${org.name}`,
      html,
      template: "daily-digest",
      organizationId,
    })
  }
}

/** Dipanggil setiap jam oleh worker; hanya mengirim untuk org yang jam lokalnya persis 07. */
export async function runHourlyDigestCheck(): Promise<void> {
  const orgs = await dbPlatform.organization.findMany({
    where: { status: { not: "SUSPENDED" } },
    select: { id: true, timezone: true },
  })
  for (const org of orgs) {
    if (localHour(org.timezone) !== 7) continue
    await sendDailyDigestForOrg(org.id).catch((e) =>
      console.error(`[daily-digest] gagal untuk organisasi ${org.id}:`, e),
    )
  }
}
