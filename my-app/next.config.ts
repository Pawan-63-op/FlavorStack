import type { NextConfig } from "next";

/**
 * The API origin the server-side rewrites proxy to (e.g. `https://<app>.onrender.com`).
 *
 * Required at **build time**: Next validates rewrite destinations while building, so an unset
 * variable produces the literal destination `undefined/api/v1/:path*` and the build fails with a
 * confusing parse error instead. Fail here with a message that names the variable.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

if (!apiProxyTarget) {
  throw new Error(
    "API_PROXY_TARGET is required at build time (the origin the /api/v1 and /socket.io rewrites proxy to, e.g. https://flavorstack-api.onrender.com)."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  // `standalone` is what `Dockerfile` copies out of `.next/`. Vercel builds its own serverless
  // output and errors on the tracing this mode adds, so it is skipped there.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  async redirects() {
    return [
      {
        source: "/",
        destination: "/Home",
        permanent: false, // true = 308, false = 307
      },
    ];
  },
  /**
   * Both rewrites exist to keep the browser on **one origin**. The auth cookies are
   * `sameSite: 'lax'`, so a split api origin would have them dropped on every cross-site
   * request; proxying through Next means the cookies are first-party and no CORS or
   * `SameSite=None` change is needed on the backend.
   */
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        // Socket.IO rides the same proxy. A rewrite cannot carry a WebSocket upgrade, so the
        // client falls back to long-polling — see `lib/realtime/trackingSocket.ts`.
        source: "/socket.io/:path*",
        destination: `${apiProxyTarget}/socket.io/:path*`,
      },
    ];
  },
  images: {
    domains: ["res.cloudinary.com","images.unsplash.com"]
  }
};

export default nextConfig;
