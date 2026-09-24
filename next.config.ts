import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "pino"],
  // Without this, Next.js walks up looking for the nearest lockfile and can land
  // on an unrelated one outside this repo (e.g. a sibling worktree or the home
  // directory), which throws off `output: "standalone"`'s file tracing.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
}

export default nextConfig
