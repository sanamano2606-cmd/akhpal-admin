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
//
// AND IT BLURS THE NUMBER (Mock 219, Sana 30 Oct 2026: "Can The Assistant do
// this" - "A blur" - "Approved"). When nothing is left to read, it asks for
// pictures that SHOW a phone number, blurs only the spots where it was found
// (lib/picture-check.blurPicture), READS THE COPY AGAIN, and only a copy that
// reads clean is uploaded and swapped in - the vendor's original is kept. A
// copy where a number can still be read is dropped and the picture stays as
// it was. It changes no rule: a shop with anything else wrong stays hidden.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { canAccess } from "@/lib/perms";

export const READ_PAUSE_MS = 2500;
export const IDLE_WAIT_MS = 5 * 60_000;
export const FAILED_WAIT_MS = 10 * 60_000;
export const PER_ROUND = 8;
/** Mock 219: pictures blurred per round - slow and gentle on purpose. */
export const BLUR_PER_ROUND = 3;
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
        // Nothing waiting to be read: blur what shows a phone number.
        if (alive && visible() && wait === IDLE_WAIT_MS) {
          try {
            if (await blurRound(() => alive && visible())) wait = READ_PAUSE_MS;
          } catch {
            // Reason to stay quiet: 154 not run yet or the server is busy -
            // nothing was changed, and the next round asks again.
          }
        }
        await sleep(wait);
      }
    })();
    return () => { alive = false; };
  }, []);
}


/** MOCK 219 - one round of blurring. True when something was swapped in. */
export async function blurRound(stillGoing: () => boolean): Promise<boolean> {
  const { switched_on, pictures } = await apiClient.getPicturesToBlur(BLUR_PER_ROUND);
  if (!switched_on || !pictures.length) return false;
  const { blurUntilClean, blurredType } = await import("@/lib/picture-check");
  let done = false;
  for (const p of pictures) {
    if (!stillGoing()) break;
    try {
      // Only a copy that reads clean is used (blurred and read again, up to
      // BLUR_TRIES times); otherwise the picture stays as it was.
      const clean = await blurUntilClean(p.url, p.boxes || []);
      if (!clean) continue;
      const { blob, width, height, check: again } = clean;
      const type = blurredType(p.url);
      const file = new File([blob], `blurred-${Date.now()}.${type === "image/png" ? "png" : "jpg"}`, { type });
      const { url } = await apiClient.uploadImage(file);
      await apiClient.saveBlurredPicture({
        restaurant_id: p.restaurant_id, original_url: p.url, blurred_url: url,
        found: p.hits, hits_after: again.hits, quality: { ...(again.quality || {}), width, height },
      });
      done = true;
    } catch {
      // This one picture could not be done - it stays as it was, marked.
    }
    await sleep(READ_PAUSE_MS);
  }
  if (done && typeof window !== "undefined") window.dispatchEvent(new Event(PICTURES_READ_EVENT));
  return done;
}
