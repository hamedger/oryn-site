import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  outputFileTracingRoot: path.join(process.cwd()),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
