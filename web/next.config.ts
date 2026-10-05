import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // "Source" links on /methods point at the commit being built when it is
    // known (Vercel sets VERCEL_GIT_COMMIT_SHA for Git deployments; CLI
    // deployments can pass NEXT_PUBLIC_GIT_REF as a build env), else at main.
    NEXT_PUBLIC_GIT_REF: process.env.NEXT_PUBLIC_GIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || "",
  },
};

export default nextConfig;
