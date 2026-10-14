import type { NextConfig } from "next";

// Everything in the dashboard is per-user and dynamic (admin data behind a login),
// so the static-caching modes are left off.
const nextConfig: NextConfig = {
  // Service cover images go through a Server Action; storage allows up to 5 MB plus form overhead.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
