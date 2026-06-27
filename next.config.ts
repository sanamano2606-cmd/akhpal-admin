import type { NextConfig } from "next";

// The backend API the admin talks to (used to scope the Content-Security-Policy).
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";

// Security headers applied to every response. These reduce the impact of common
// web attacks (clickjacking, MIME sniffing, and cross-site script injection that
// could otherwise read the admin token from the browser).
const securityHeaders = [
  // Stop the admin from being embedded in an <iframe> on another site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let the browser guess/override declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full admin URLs to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Turn off device APIs the admin doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Force HTTPS for a year.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Content-Security-Policy: limit where scripts, styles and data can come from.
  // connect-src is scoped to this app + the backend API so a malicious script
  // can't quietly ship the admin token to an attacker's server.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js needs inline/eval for its runtime; acceptable for an internal admin tool.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      `connect-src 'self' ${API_URL}`,
      "font-src 'self' data:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
