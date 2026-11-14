import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Excel imports are uploaded through a server action (see items/import-actions.ts).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
