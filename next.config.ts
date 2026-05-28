import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type checking done locally — skip during Render build to avoid OOM
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
