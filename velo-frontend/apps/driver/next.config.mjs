import path from "node:path";
import { createSecurityHeaders } from "@velo/config/security-headers";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@velo/ui", "motion"],
  async headers() {
    return [{ source: "/:path*", headers: createSecurityHeaders() }];
  },
};

export default nextConfig;
