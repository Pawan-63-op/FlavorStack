import type { NextConfig } from "next";
import { Julius_Sans_One } from "next/font/google";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/Home",
        permanent: false, // true = 308, false = 307
      },
    ];
  },
  images: {
    domains: ["res.cloudinary.com","images.unsplash.com"]
  }
};

export default nextConfig;