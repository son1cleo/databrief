import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // @resvg/resvg-js ships a native binary loader that Turbopack/webpack
  // can't bundle into a Server Component/Route Handler chunk — it must be
  // require()'d directly from node_modules at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
