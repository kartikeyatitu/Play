import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Performance: don't advertise the framework, keep gzip on for self-hosted/dev
  // (Vercel's edge also compresses with brotli), serve modern image formats.
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com/gsi/client" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://accounts.google.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com",
      "media-src 'self' blob:",
      "worker-src 'self'",
      "form-action 'self' https://api.razorpay.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com" "https://api.razorpay.com"), clipboard-write=(self), web-share=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
