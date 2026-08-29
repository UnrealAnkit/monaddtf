import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // `next.config.ts` is evaluated as an ES module in some Next/Node
    // environments, where `__dirname` is undefined. The app directory is the
    // working directory for all Next scripts, so cwd is stable here.
    root: process.cwd(),
  },
};

export default nextConfig;
