import "server-only"
import { withOrg } from "@/server/db"
import { getAccessibleRoomIds } from "@/server/services/scope.service"
import type { UserRole } from "../../../generated/prisma/enums"

// FR-26 (docs/02-prd.md §H, v1.1).

export type DashboardStats = {
  assetsByStatus: Array<{ status: string; count: number }>
  assetsByDepartment: Array<{ departmentName: string; count: number }>
  dueCalibrations: Array<{
    assetId: string
    assetCode: string
    assetName: string
    nextDueAt: Date
    isOverdue: boolean
  }>
  loans: { active: number; overdue: number }
  underRepairCount: number
  recentActivity: Array<{
    id: string
    type: string
    title: string
    occurredAt: Date
    assetCode: string
    assetName: string
  }>
}

export async function getDashboardStats(
  organizationId: string,
  userId: string,
  role: UserRole,
): Promise<DashboardStats> {
  return withOrg(organizationId, async (tx) => {
    const roomIds = await getAccessibleRoomIds(tx, organizationId, userId, role)
    const assetScope = roomIds !== null ? { locationId: { in: roomIds } } : {}

    const statusGroups = await tx.asset.groupBy({
      by: ["status"],
      where: { organizationId, status: { not: "DISPOSED" }, ...assetScope },
      _count: { _all: true },
    })

    const departmentRows = await tx.asset.findMany({
      where: { organizationId, status: { not: "DISPOSED" }, ...assetScope },
      select: {
        location: { select: { path: true, parent: { select: { name: true, id: true } } } },
      },
    })
    const byDept = new Map<string, number>()
    for (const row of departmentRows) {
      const name = row.location.parent?.name ?? "Tanpa instalasi"
      byDept.set(name, (byDept.get(name) ?? 0) + 1)
    }

    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 86_400_000)
    const dueSchedules = await tx.maintenanceSchedule.findMany({
      where: {
        organizationId,
        isActive: true,
        nextDueAt: { lte: in30Days },
        asset: { organizationId, status: { not: "DISPOSED" }, ...assetScope },
      },
      orderBy: { nextDueAt: "asc" },
      take: 10,
      select: {
        nextDueAt: true,
        asset: { select: { id: true, assetCode: true, name: true } },
      },
    })

    const loanWhere = {
      organizationId,
      returnedAt: null,
      ...(roomIds !== null ? { asset: { locationId: { in: roomIds } } } : {}),
    }
    const activeLoans = await tx.loan.findMany({
      where: loanWhere,
      select: { dueAt: true, borrowedAt: true },
    })
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { loanOverdueThresholdDays: true },
    })
    const overdueLoans = activeLoans.filter((l) => {
      if (l.dueAt) return l.dueAt.getTime() < now.getTime()
      const days = Math.floor((now.getTime() - l.borrowedAt.getTime()) / 86_400_000)
      return days > org.loanOverdueThresholdDays
    }).length

    const underRepairCount = await tx.asset.count({
      where: { organizationId, status: "UNDER_REPAIR", ...assetScope },
    })

    const recentEvents = await tx.assetEvent.findMany({
      where: {
        organizationId,
        ...(roomIds !== null ? { asset: { locationId: { in: roomIds } } } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        occurredAt: true,
        asset: { select: { assetCode: true, name: true } },
      },
    })

    return {
      assetsByStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      assetsByDepartment: Array.from(byDept.entries())
        .map(([departmentName, count]) => ({ departmentName, count }))
        .sort((a, b) => b.count - a.count),
      dueCalibrations: dueSchedules.map((s) => ({
        assetId: s.asset.id,
        assetCode: s.asset.assetCode,
        assetName: s.asset.name,
        nextDueAt: s.nextDueAt,
        isOverdue: s.nextDueAt.getTime() < now.getTime(),
      })),
      loans: { active: activeLoans.length, overdue: overdueLoans },
      underRepairCount,
      recentActivity: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        occurredAt: e.occurredAt,
        assetCode: e.asset.assetCode,
        assetName: e.asset.name,
      })),
    }
  })
}
