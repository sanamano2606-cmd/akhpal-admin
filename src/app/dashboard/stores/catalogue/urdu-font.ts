// The Urdu shelf names on the shelf manager (Mock 201) and the Review page's
// Urdu lines, in NASKH - the round, clear Pakistani school-book letters.
// Sana's rule (31 Oct 2026): Urdu in designs uses Noto Naskh, not the tall
// slanted Nastaliq. Was the Nastaliq font until the Stores visual audit of
// 10 Nov 2026 (finding C4) found the panel still loading Nastaliq.
// Loaded through next/font so the file comes from our own domain (the
// Content-Security-Policy allows only `font-src 'self'`). Not preloaded: it is
// fetched only when an Urdu name is actually on screen, so no other page waits.
// Example: shelf "Broast & Fried Chicken" -> its Urdu name in round Naskh letters.
import { Noto_Naskh_Arabic } from "next/font/google";

export const urduFont = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400"],
  display: "swap",
  preload: false,
});
