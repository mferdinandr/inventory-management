import { fileResponse } from "@/server/export"
import { buildImportTemplate } from "@/server/services/import.service"
import { requireUser } from "@/server/tenant"

/** FR-29: templat impor massal yang disediakan. */
export async function GET(): Promise<Response> {
  await requireUser()
  const buffer = await buildImportTemplate()
  return fileResponse(
    buffer,
    "templat-impor-aset.xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
}
