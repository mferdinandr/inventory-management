import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "PLATFORM_OWNER" | "SUPERADMIN" | "ADMIN" | "PIC_ROOM" | "TECHNICIAN" | "VIEWER"
      organizationId: string | null
      status: "INVITED" | "ACTIVE" | "DISABLED"
      /** PLATFORM_OWNER sedang "masuk sebagai" organisasi `organizationId` (FR-01b). */
      impersonating: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    organizationId?: string | null
    status?: string
    impersonating?: boolean
  }
}
