import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Twice the dev cache went bad after files changed under a running
    // server, and pages reloaded in a loop. Without it, a restart is clean.
    turbopackFileSystemCacheForDev: false,
  },
  partialPrefetching: true,
  // The Game tab is the home page.
  redirects() {
    return [{ destination: "/game", permanent: false, source: "/" }];
  },
  turbopack: {
    rules: {
      "*.css": {
        as: "*.css",
        loaders: ["@tailwindcss/turbopack"],
      },
    },
  },
};

export default nextConfig;
