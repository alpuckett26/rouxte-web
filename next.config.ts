import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.mapbox.com" },
      { protocol: "https", hostname: "tiles.mapbox.com" },
      { protocol: "https", hostname: "events.mapbox.com" },
    ],
  },
};

export default nextConfig;
