/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  devIndicators: false,
  images: { unoptimized: true },
  transpilePackages: ["@velo/ui", "motion", "lenis"],
};

export default nextConfig;
