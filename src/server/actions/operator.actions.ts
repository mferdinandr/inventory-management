"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { signIn } from "@/auth"
import {
  createOrganizationSchema,
  organizationIdSchema,
  updateOrganizationSchema,
} from "@/lib/validators/organization"
import {
  createOrganization,
  endImpersonation,
  OperatorError,
  type PlatformTicket,
  type RequestMeta,
  resendAdminInvite,
  startImpersonation,
  updateOrganization,
} from "@/server/services/operator.service"
import { requireUser, type SessionUser } from "@/server/tenant"

export type OperatorActionState =
  | { ok: true; message: string }
  // `values` mengembalikan isian formulir: React 19 mengosongkan <form> setelah
  // action selesai, sehingga tanpa ini pengguna kehilangan ketikannya saat galat.
  | { ok: false; error: string; values?: Record<string, string> }

function err(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value
  return values
}

function errorMessage(e: unknown): string {
  if (e instanceof OperatorError) return e.message
  if (e instanceof Error) return e.message
  return "Terjadi galat tak terduga."
}

// middleware.ts sudah menolak non-PLATFORM_OWNER di /operator, tetapi Server
// Action dapat dipanggil langsung — periksa ulang di sini. Mengembalikan null
// (bukan redirect seperti tenant.requirePlatformOwner) agar formulir bisa
// menampilkan pesan galat.
async function platformOwnerOrNull(): Promise<SessionUser | null> {
  const user = await requireUser()
  return user.role === "PLATFORM_OWNER" ? user : null
}

function parseOrganizationId(id: string): string | null {
  const parsed = organizationIdSchema.safeParse({ id })
  return parsed.success ? parsed.data.id : null
}

async function requestMeta(): Promise<RequestMeta> {
  const h = await headers()
  return {
    ipAddress: h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  }
}

async function redeem(ticket: PlatformTicket, redirectTo: string): Promise<OperatorActionState> {
  try {
    // signIn() melempar redirect Next.js saat berhasil — biarkan lolos.
    await signIn("platform-session", { ...ticket, redirectTo })
  } catch (e) {
    if (e instanceof AuthError) return err("Sesi tidak dapat dibuka. Silakan coba lagi.")
    throw e
  }
  return { ok: true, message: "" }
}

export async function createOrganizationAction(
  _prev: OperatorActionState | null,
  formData: FormData,
): Promise<OperatorActionState> {
  const user = await platformOwnerOrNull()
  if (!user) return err("Anda tidak memiliki izin untuk tindakan ini.")

  const values = formValues(formData)
  const parsed = createOrganizationSchema.safeParse(values)
  if (!parsed.success) {
    return { ...err(parsed.error.issues[0]?.message ?? "Data tidak valid."), values }
  }

  let result: Awaited<ReturnType<typeof createOrganization>>
  try {
    result = await createOrganization(user.id, parsed.data)
  } catch (e) {
    return { ...err(errorMessage(e)), values }
  }
  revalidatePath("/operator")
  redirect(`/operator/${result.organizationId}?invite=${result.mailSent ? "sent" : "failed"}`)
}

export async function updateOrganizationAction(
  organizationId: string,
  _prev: OperatorActionState | null,
  formData: FormData,
): Promise<OperatorActionState> {
  const user = await platformOwnerOrNull()
  if (!user) return err("Anda tidak memiliki izin untuk tindakan ini.")
  const id = parseOrganizationId(organizationId)
  if (!id) return err("Organisasi tidak valid.")

  const values = formValues(formData)
  const parsed = updateOrganizationSchema.safeParse(values)
  if (!parsed.success) {
    return { ...err(parsed.error.issues[0]?.message ?? "Data tidak valid."), values }
  }

  try {
    await updateOrganization(user.id, id, parsed.data)
  } catch (e) {
    return { ...err(errorMessage(e)), values }
  }
  revalidatePath("/operator")
  revalidatePath(`/operator/${id}`)
  return { ok: true, message: "Kuota dan status tersimpan." }
}

export async function resendAdminInviteAction(
  organizationId: string,
  userId: string,
): Promise<OperatorActionState> {
  const user = await platformOwnerOrNull()
  if (!user) return err("Anda tidak memiliki izin untuk tindakan ini.")
  const id = parseOrganizationId(organizationId)
  if (!id) return err("Organisasi tidak valid.")

  try {
    const result = await resendAdminInvite(user.id, id, userId)
    revalidatePath(`/operator/${id}`)
    return result.mailSent
      ? { ok: true, message: "Undangan baru terkirim." }
      : err("Undangan diperbarui, tetapi email gagal terkirim. Periksa konfigurasi SMTP.")
  } catch (e) {
    return err(errorMessage(e))
  }
}

export async function startImpersonationAction(
  organizationId: string,
  _prev: OperatorActionState | null,
  _formData: FormData,
): Promise<OperatorActionState> {
  const user = await platformOwnerOrNull()
  if (!user) return err("Anda tidak memiliki izin untuk tindakan ini.")
  const id = parseOrganizationId(organizationId)
  if (!id) return err("Organisasi tidak valid.")

  let ticket: PlatformTicket
  try {
    ticket = await startImpersonation(user.id, id, await requestMeta())
  } catch (e) {
    return err(errorMessage(e))
  }
  return redeem(ticket, "/dashboard")
}

export async function endImpersonationAction(): Promise<void> {
  const user = await platformOwnerOrNull()
  if (!user?.impersonating || !user.organizationId) redirect("/dashboard")

  const ticket = await endImpersonation(user.id, user.organizationId, await requestMeta())
  await redeem(ticket, `/operator/${user.organizationId}`)
}
