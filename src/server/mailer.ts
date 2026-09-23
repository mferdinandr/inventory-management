import "server-only"
import nodemailer from "nodemailer"

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

export type MailInput = {
  to: string
  subject: string
  html: string
}

export async function sendMail(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const t = getTransport()
  if (!t) {
    console.warn(`[mailer] SMTP belum dikonfigurasi — email ke ${input.to} tidak terkirim: ${input.subject}`)
    return { ok: false, error: "Not configured" }
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? "SIMASET <noreply@simaset.id>",
      ...input,
    })
    return { ok: true }
  } catch (err) {
    console.error("[mailer] gagal mengirim:", err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}