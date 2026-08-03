import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
// Map styles for the store-location picker. Imported here, in the root layout,
// because Next.js only allows global CSS at this level — and bundled from
// node_modules rather than a CDN because our Content-Security-Policy sets
// script-src/style-src to 'self', which (correctly) blocks third-party assets.
import "leaflet/dist/leaflet.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
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
      <body className={`${poppins.variable} font-sans bg-slate-50 text-slate-800`}>
        {children}
      </body>
    </html>
  );
}
