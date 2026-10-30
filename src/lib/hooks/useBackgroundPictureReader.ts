// ─────────────────────────────────────────────────────────────────────────────
// THE PANEL READS NEW PRODUCT PICTURES IN THE BACKGROUND  (migration 152,
// Sana 29 Oct 2026: "the next hour the Assistant Ai should check what changed
// and not avoiding Takal rules" - "GO").
//
// The Takal Assistant runs on the server, which cannot read the writing on a
// picture for free. The panel can (lib/picture-check.ts, Mock 215 - the
// panel's own reading files, nothing paid, nothing from anybody else). So
// while a reviewer has the panel open, it quietly reads the pictures of new
// and changed products, one at a time, and hands what it read to the server
// (POST /admin/pictures/read). The Assistant then hides a product whose
// picture shows a phone number or website, the next hour.
//
// Kept gentle on the laptop and the server:
//   * only for an admin who may review shops (stores.approve) - the server
//     refuses anybody else anyway;
//   * only while the tab is VISIBLE; a hidden tab reads nothing;
//   * one picture at a time, a pause between pictures, a few per round;
//   * nothing waiting -> it asks again in 5 minutes; a failure -> 10 minutes.
// A picture that cannot be opened at all is reported as read with nothing on
// it, so one broken picture can never block the queue.
// Draws nothing.
//
// FINISHED SHOPS FIRST (Sana, 30 Oct 2026: "the Assistant should move the
// ready stores to the ready tab after checking if it ready"). The server now
// hands over FIRST the pictures of hidden shops whose only missing step is the
// picture check - their LOGO too, which this reader never used to see. When
// something was saved it tells the page (PICTURES_READ_EVENT), and the Stores
// page asks for Ready to show again, so a finished shop appears there and in
// the chip's number without anybody opening its Review page.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { canAccess } from "@/lib/perms";

export const READ_PAUSE_MS = 2500;
export const IDLE_WAIT_MS = 5 * 60_000;
export const FAILED_WAIT_MS = 10 * 60_000;
export const PER_ROUND = 8;
/** Sent on `window` after pictures were saved - the Stores page listens. */
export const PICTURES_READ_EVENT = "takal:pictures-read";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

export function useBackgroundPictureReader(): void {
  useEffect(() => {
    if (!canAccess("stores.approve")) return;
    let alive = true;
    (async () => {
      await sleep(20_000);                 // let the page finish loading first
      while (alive) {
        if (!visible()) { await sleep(30_000); continue; }
        let wait = IDLE_WAIT_MS;
        try {
          const { pictures } = await apiClient.getPicturesToRead(PER_ROUND);
          if (pictures.length) {
            const { checkPicture } = await import("@/lib/picture-check");
            const read: unknown[] = [];
            for (const p of pictures) {
              if (!alive || !visible()) break;
              const c = await checkPicture(p.url, false);
              read.push({ product_id: p.product_id, restaurant_id: p.restaurant_id, item_key: p.item_key,
                url: p.url, hits: c.hits, boxes: c.boxes, quality: c.quality });
              await sleep(READ_PAUSE_MS);
            }
            if (read.length) {
              const { saved } = await apiClient.savePictureReads(read);
              if (saved > 0 && typeof window !== "undefined") window.dispatchEvent(new Event(PICTURES_READ_EVENT));
            }
            wait = read.length === pictures.length ? READ_PAUSE_MS : 30_000;
          }
        } catch {
          wait = FAILED_WAIT_MS;           // the server is busy or not updated yet
        }
        await sleep(wait);
      }
    })();
    return () => { alive = false; };
  }, []);
}
