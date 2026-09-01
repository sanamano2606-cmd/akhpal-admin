import type { Config } from "tailwindcss";

// TAKAL'S COLOURS.
//
// primary-600 (#FFFF00) is the brand yellow and the only colour that means
// "this is the main thing here". Everything else is described in
// src/components/ui/theme.ts, which is where a screen should get its colours
// from - never by typing a hex code into a page.

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // THE BRAND YELLOW. primary-600 is #FFFF00 and is the one in use.
        //
        // The shades are deliberately NOT in Tailwind's usual light-to-dark
        // order: 600 is the pure brand colour, 500 below it is a shade off it,
        // and 700-900 darken for hover and for charts. It is written this way
        // because "600" is Tailwind's conventional slot for a main brand
        // colour, and 120 places in this panel already say primary-600.
        // Renumbering to be tidy would mean touching all of them for nothing.
        primary: {
          50: "#fffee6",
          100: "#fffdcc",
          200: "#fffb99",
          300: "#fff966",
          400: "#fff733",
          500: "#fff500",
          600: "#ffff00", // ← Takal yellow
          700: "#e6e600", // hover
          800: "#b8b800",
          900: "#8a8a00",
        },
        // Removed: a re-declaration of `slate` with Tailwind's own default
        // values, byte for byte. It did nothing except make people think the
        // greys had been customised.
        //
        // Also removed: success / warning / error / info. Four colour names,
        // used ZERO times in the whole panel - pages reached for green-700,
        // amber-800 and red-700 directly, which are Tailwind's colours and NOT
        // Takal's. Names nobody uses are names that mislead.
        //
        // ── TAKAL BRAND KIT v2.0 ──────────────────────────────────────────
        // Copied from Takal_Brand_Kit/takal-colors.css. That file is the
        // source of truth; this is the Tailwind spelling of it. Each meaning
        // colour has a "-soft" background to sit on.
        takal: {
          yellow: "#FFFF00",          // THE brand colour
          "yellow-dark": "#E6E600",   // pressed
          "yellow-soft": "#FFFDE0",   // wash behind an important note

          green: "#1F6F4A",           // good, finished, money in
          "green-soft": "#E8F3EE",
          orange: "#FF6B35",          // waiting, needs you, over a limit
          "orange-soft": "#FFEFE8",
          blue: "#004E89",            // in progress, information
          "blue-soft": "#E6EEF4",
          red: "#D62839",             // refused, blocked, deleted
          "red-soft": "#FBE7E9",
          purple: "#6A3FA0",          // marketplace / parcel jobs
          "purple-soft": "#EFE9F6",
          teal: "#0F7B8A",            // grocery
          "teal-soft": "#E4F1F3",

          ink: "#000000",             // every heading, label and sentence
          "ink-soft": "#4A4A4A",      // small helper text
          line: "#E5E5E5",            // table lines, card edges
          page: "#FAFAFA",            // the page behind the cards
          "disabled-bg": "#D9D9D9",
          "disabled-text": "#8A8A8A",
        },
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
      fontFamily: {
        // ROBOTO, because Takal_Brand_Kit/TAKAL_STYLE_GUIDE.md says Roboto and
        // that file wins. The panel was on Poppins.
        //
        // var(--font-roboto) comes FIRST: that is the variable next/font sets
        // in app/layout.tsx, pointing at a copy served from our own domain.
        // The plain name used to be first, which only matched if the browser
        // had already fetched the font from Google - and our own security
        // policy blocks Google. So the brand font was silently never loading
        // in production at all. The literal name stays behind the variable as
        // a fallback for anyone who has it installed.
        sans: [
          "var(--font-roboto)",
          "Roboto",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
