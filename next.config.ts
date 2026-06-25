import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live ATC + airport-data photo hosts for next/image (target card photos).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.airport-data.com" },
      { protocol: "https", hostname: "airport-data.com" },
      { protocol: "https", hostname: "*.planespotters.net" },
    ],
  },
  // Allow the dev server to be reached over the LAN / Tailscale for phone testing.
  // (Next prints the network URL; add origins here if it warns about cross-origin.)
};

export default nextConfig;
