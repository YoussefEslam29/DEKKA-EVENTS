import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cover images are URLs typed in by the admin, so the host isn't known
    // ahead of time. Narrow this list if you settle on one image host.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
