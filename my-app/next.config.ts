import type { NextConfig } from "next";
import { Julius_Sans_One } from "next/font/google";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/Home",
        permanent: false, // true = 308, false = 307
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
  images: {
    domains: ["res.cloudinary.com","images.unsplash.com"]
  }
};

export default nextConfig;