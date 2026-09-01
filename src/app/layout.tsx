import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
// Map styles for the store-location picker. Imported here, in the root layout,
// because Next.js only allows global CSS at this level — and bundled from
// node_modules rather than a CDN because our Content-Security-Policy sets
// script-src/style-src to 'self', which (correctly) blocks third-party assets.
import "leaflet/dist/leaflet.css";

// Roboto, because Takal_Brand_Kit/TAKAL_STYLE_GUIDE.md says Roboto - headings
// bold, body regular. The panel was on Poppins, which disagreed with the brand
// kit AND was being pulled from Google Fonts by globals.css, which our own
// security policy blocks. Loaded here it is served from our own domain, so it
// actually arrives.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Takal - Admin Dashboard",
  description: "Enterprise-grade admin panel for Takal marketplace",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} font-sans bg-takal-page text-takal-ink`}>
        {children}
      </body>
    </html>
  );
}
