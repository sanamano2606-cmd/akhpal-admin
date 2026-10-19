// The Urdu shelf names on the shelf manager (Mock 201), in Nastaliq - the
// script Urdu is read in. Loaded through next/font so the file comes from our
// own domain (the Content-Security-Policy allows only `font-src 'self'`), the
// same way the Terms pages load it. Not preloaded: it is fetched only when an
// Urdu name is actually on screen, so no other page waits for it.
import { Noto_Nastaliq_Urdu } from "next/font/google";

export const urduFont = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
  preload: false,
});
