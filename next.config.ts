import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "pino"],
};

export default nextConfig;