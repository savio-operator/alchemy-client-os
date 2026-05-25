import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/better-sqlite3/**/*",
      "node_modules/argon2/**/*",
    ],
  },
};

export default nextConfig;
