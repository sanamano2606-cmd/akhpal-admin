// THE REVIEW PAGE'S OWN CHECKS - one place, so the badge, the red card, the
// locked Approve and the note all say the same thing  (Mock 215, Sana 28 Oct
// 2026: "Add 11, 9, 8, 1, 4 only" + "the Shop/product that has number website
// on logo Or In description or anywhere in product page will not be Approved
// by any admin include me showing the reason on a note").
//
// The server holds the same lock (shop_review.contact_lock) and is the one
// that refuses - this file only draws it, so a person never presses a button
// that is going to say no.

import type { ShopReviewPage, SavedPictureCheck } from "./shop-review";
import { contactLine, type ContactHit } from "./contact-info.ts";
import { qualityWords, type PictureCheck } from "./picture-check.ts";

export type Found = {
  key: string;              // "logo", "shop.description", "product:<id>"
  label: string;            // "Shop logo", "Trimmer"
  where: "words" | "picture";
  field?: string;           // "description" ...
  excerpt?: string;         // the words round it, for a text find
  url?: string;             // the picture, for a picture find
  hits: ContactHit[];
};

type Check = PictureCheck | SavedPictureCheck;

/** Every check so far: what the server already holds, and what this
 *  browser has read since (newer wins). */
export function allChecks(page: ShopReviewPage | null | undefined, local: Record<string, Check>): Record<string, Check> {
  return { ...(page?.pictures?.checks || {}), ...local };
}

/** Every phone number / website found - in words (the server) and on
 *  pictures (this browser), minus pictures a reviewer cleared. */
export function contactFinds(page: ShopReviewPage | null | undefined, local: Record<string, Check>): Found[] {
  const out: Found[] = [];
  for (const t of page?.contact?.text_hits || []) {
    if (t.hits?.length) out.push({ key: t.key, label: t.label, where: "words", field: t.field, excerpt: t.excerpt, hits: t.hits });
  }
  const checks = allChecks(page, local);
  for (const p of page?.pictures?.list || []) {
    const c = checks[p.url];
    if (!c || !c.hits?.length) continue;
    if ((c as SavedPictureCheck).not_contact) continue;
    out.push({ key: p.key, label: p.label, where: "picture", url: p.url, hits: c.hits });
  }
  return out;
}

export function pictureProgress(page: ShopReviewPage | null | undefined, local: Record<string, Check>) {
  const list = page?.pictures?.list || [];
  const checks = allChecks(page, local);
  const done = list.filter((p) => !!checks[p.url]).length;
  return { done, total: list.length, left: list.length - done };
}

/** THE NOTE under a locked Approve - or null when the rule lets it through.
 *  Example: "Cannot be approved - Takal does not allow phone numbers or
 *  websites. Found: Shop logo (picture) · Description · Trimmer. Nobody can
 *  approve it, not even the main admin, until they are removed." */
export function contactLock(page: ShopReviewPage | null | undefined, local: Record<string, Check>): string | null {
  const finds = contactFinds(page, local);
  const prog = pictureProgress(page, local);
  if (finds.length) {
    const where = [...new Set(finds.map((f) => (f.where === "picture" ? `${f.label} (picture)` : f.label)))];
    return "Cannot be approved - Takal does not allow phone numbers or websites on a shop or its products. "
      + `Found: ${where.join(" · ")}. Nobody can approve it, not even the main admin, until they are removed.`;
  }
  if (prog.left > 0) {
    return `Approve opens when every picture has been checked for phone numbers (${prog.done} of ${prog.total} done).`;
  }
  return null;
}

export type RiskLevel = "red" | "amber" | "green";
export type RiskLine = { ok: boolean; text: string; level: RiskLevel };

/** THE BADGE (item 9): one colour for the whole shop, and the lines behind it. */
export function riskOf(page: ShopReviewPage | null | undefined, local: Record<string, Check>): { level: RiskLevel; title: string; lines: RiskLine[] } {
  const lines: RiskLine[] = [];
  const finds = contactFinds(page, local);
  const prog = pictureProgress(page, local);
  lines.push(finds.length
    ? { ok: false, level: "red", text: `Phone number or website found in ${finds.length} place${finds.length === 1 ? "" : "s"}` }
    : { ok: prog.left === 0, level: prog.left ? "amber" : "green",
        text: prog.left ? `No phone number or website so far - ${prog.left} picture${prog.left === 1 ? "" : "s"} still to check` : "No phone number or website anywhere" });
  lines.push(prog.total === 0
    ? { ok: true, level: "green", text: "No pictures to check yet" }
    : prog.left
    ? { ok: false, level: "amber", text: `Pictures checked: ${prog.done} of ${prog.total}` }
    : { ok: true, level: "green", text: `All ${prog.total} pictures checked` });

  const checks = allChecks(page, local);
  const poor = (page?.pictures?.list || []).filter((p) => p.key !== "logo" && qualityWords(checks[p.url]?.quality).length);
  lines.push(poor.length
    ? { ok: false, level: "amber", text: `${poor.length} photo${poor.length === 1 ? " is" : "s are"} small or too dark` }
    : { ok: true, level: "green", text: "Photos are a good size" });

  const twins = page?.same_shop || [];
  const rejectedTwin = twins.some((t) => t.status === "rejected");
  lines.push(twins.length
    ? { ok: false, level: rejectedTwin ? "red" : "amber",
        text: rejectedTwin ? "Looks like a shop Takal already rejected" : `Shares a phone, owner or bank account with ${twins.length} other shop${twins.length === 1 ? "" : "s"}` }
    : { ok: true, level: "green", text: "Not the same as any other shop" });

  const level: RiskLevel = lines.some((l) => l.level === "red") ? "red" : lines.some((l) => l.level === "amber") ? "amber" : "green";
  const title = level === "red" ? (finds.length ? "CANNOT BE APPROVED" : "HIGH RISK") : level === "amber" ? "CHECK CAREFULLY" : "LOOKS SAFE";
  return { level, title, lines };
}

/** The finds that belong to one thing on the page (the logo row, a product). */
export function findsFor(key: string, finds: Found[]): Found[] {
  return finds.filter((f) => f.key === key);
}

/** "WhatsApp 03449679387" -> the words for a chip. */
export function hitWords(f: Found): string {
  return contactLine(f.hits);
}
