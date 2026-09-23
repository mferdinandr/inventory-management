import { NextResponse } from "next/server"
import { auth } from "@/auth"

const APP_PREFIXES = ["/dashboard", "/assets", "/scan", "/loans", "/maintenance", "/reports", "/settings"]
const PLATFORM_PREFIXES = ["/operator"]

export default auth((req) => {
  const { nextUrl } = req
  const isApp = APP_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))
  const isPlatform = PLATFORM_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))
  if (!isApp && !isPlatform) return NextResponse.next()

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (isPlatform && req.auth.user.role !== "PLATFORM_OWNER") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}