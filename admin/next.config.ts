import type { NextConfig } from "next";

// Everything in the dashboard is per-user and dynamic (admin data behind a login),
// so the static-caching modes are left off.
const nextConfig: NextConfig = {};

export default nextConfig;
