/** @type {import('next').NextConfig} */

// The backend API the admin talks to (used to scope the Content-Security-Policy).
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";

const isProd = process.env.NODE_ENV === "production";

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
      // 'unsafe-eval' is needed by the Next.js dev server's React Refresh
      // runtime, but NOT by a production build. Allowing it in production
      // removed most of the value of having a CSP at all: the admin's bearer
      // token lives in browser storage, so script injection is the whole
      // threat model here. It is now dev-only.
      isProd
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' " + API_URL,
      "font-src 'self' data:",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Lint DOES gate the build again.
  //
  // It was switched off because warnings were blocking deploys. The cost of
  // that was silence: nothing ever told anyone the code had drifted, and a
  // check nobody sees is a check that does not exist. The codebase turned out
  // to be clean - the whole of src/ raises 3 fixable errors and 4 deliberate
  // warnings - so the switch is back on, with warnings still allowed through.
  // If a deploy is ever blocked by this, the right move is to fix the error,
  // not to switch it off again.
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },
  images: {
    unoptimized: true,
  },

  // ── OLD ADDRESSES STILL WORK ───────────────────────────────────────────
  // Pages moved when the sidebar was rebuilt into one line per domain. Every
  // old address sends you to the new one, permanently, so a bookmark, a link
  // in an old email, or a browser's autocomplete all still land in the right
  // place instead of on a "page not found".
  //
  // These lines cost nothing and can be removed in a year or so, once nobody
  // has an old bookmark left.
  async redirects() {
    return [
      // Reports: three scattered links became one domain with tabs.
      { source: "/dashboard/analytics", destination: "/dashboard/reports/sales", permanent: true },
      { source: "/dashboard/settings/audit", destination: "/dashboard/reports/audit", permanent: true },

      // Marketing: five links in three places became one domain with tabs.
      { source: "/dashboard/promos", destination: "/dashboard/marketing", permanent: true },
      { source: "/dashboard/home-banners", destination: "/dashboard/marketing/banners", permanent: true },
      { source: "/dashboard/welcome-pages", destination: "/dashboard/marketing/welcome", permanent: true },
      { source: "/dashboard/settings/notifications", destination: "/dashboard/marketing/notifications", permanent: true },
      { source: "/dashboard/settings/banner", destination: "/dashboard/marketing/app-banner", permanent: true },

      // Orders: the whole life of an order, plus the offices it passes through.
      { source: "/dashboard/returns", destination: "/dashboard/orders/returns", permanent: true },
      { source: "/dashboard/parcels", destination: "/dashboard/orders/parcels", permanent: true },
      { source: "/dashboard/deliveries", destination: "/dashboard/my-deliveries", permanent: true },
      { source: "/dashboard/settings/hubs", destination: "/dashboard/orders/offices", permanent: true },

      // Customers: a review is written by a customer, so it lives with them.
      { source: "/dashboard/reviews", destination: "/dashboard/customers/reviews", permanent: true },

      // Riders: rider money moved into the rider's own section.
      { source: "/dashboard/settings/rider-pay", destination: "/dashboard/riders/pay-rules", permanent: true },

      // Stores: the folder was called "restaurants" while the page was called
      // "Stores" and managed all 16 shop types. It is `stores` now.
      { source: "/dashboard/restaurants", destination: "/dashboard/stores", permanent: true },
      { source: "/dashboard/restaurants/:id", destination: "/dashboard/stores/:id", permanent: true },
      { source: "/dashboard/inventory", destination: "/dashboard/stores/inventory", permanent: true },
      { source: "/dashboard/categories", destination: "/dashboard/stores/catalogue", permanent: true },
      { source: "/dashboard/reliability", destination: "/dashboard/stores/reliability", permanent: true },
      { source: "/dashboard/settings/commissions", destination: "/dashboard/stores/commission", permanent: true },

      // Payments: "Pay Out" and "Payouts" were two pages with near-identical
      // names showing different numbers for the same question. One section now.
      { source: "/dashboard/settlements", destination: "/dashboard/payments/settlements", permanent: true },
      { source: "/dashboard/settings/payments", destination: "/dashboard/payments/methods", permanent: true },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: API_URL,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
