import "server-only"
import nodemailer from "nodemailer"
import { dbPlatform } from "@/server/db-platform"

let transport: nodemailer.Transporter | undefined

function getTransport(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  }
  return transport
}

/** Untuk menyisipkan isian pengguna (nama orang, nama organisasi) ke badan email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export type MailInput = {
  to: string
  subject: string
  html: string
  /** FR-28: nama templat untuk email_logs, mis. "invite", "reset-password", "daily-digest". */
  template: string
  /** null untuk email lintas-organisasi/pra-sesi (mis. undangan sebelum akun aktif). */
  organizationId?: string | null
}

/**
 * FR-28: "setiap pengiriman tercatat pada log agar kegagalan dapat
 * ditelusuri" — dicatat di sini, satu titik untuk semua pemanggil, bukan
 * diulang di setiap tempat yang mengirim email. Memakai dbPlatform karena
 * pengiriman terjadi lintas konteks (pra-sesi, job terjadwal tanpa sesi
 * pengguna sama sekali) yang tidak selalu punya app.current_org.
 */
export async function sendMail(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const t = getTransport()
  let ok: boolean
  let error: string | undefined

  if (!t) {
    console.warn(
      `[mailer] SMTP belum dikonfigurasi — email ke ${input.to} tidak terkirim: ${input.subject}`,
    )
    ok = false
    error = "SMTP belum dikonfigurasi"
  } else {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM ?? "SIMASET <noreply@simaset.id>",
        to: input.to,
        subject: input.subject,
        html: input.html,
      })
      ok = true
    } catch (err) {
      console.error("[mailer] gagal mengirim:", err)
      ok = false
      error = err instanceof Error ? err.message : String(err)
    }
  }

  await dbPlatform.emailLog
    .create({
      data: {
        organizationId: input.organizationId ?? null,
        toEmail: input.to,
        template: input.template,
        subject: input.subject,
        status: ok ? "SENT" : "FAILED",
        error: error ?? null,
      },
    })
    .catch((e) => console.error("[mailer] gagal mencatat email_logs:", e))

  return ok ? { ok: true } : { ok: false, error }
}
