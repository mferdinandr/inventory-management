import { redirect } from "next/navigation"
import { auth } from "@/auth"

// Tidak ada halaman beranda: arahkan ke tempat yang sesuai dengan sesi.
export default async function Home() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "PLATFORM_OWNER" && !session.user.organizationId) redirect("/operator")
  redirect("/dashboard")
}
