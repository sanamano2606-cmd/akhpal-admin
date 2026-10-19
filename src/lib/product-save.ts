// ─────────────────────────────────────────────────────────────────────────────
// SAVING ONE PRODUCT FROM THE ✏️ EDITOR - THE WORDS AND THE SMALL RULES.
// (Audit 202, A1 and A2, 19 Oct 2026.)
//
// A new product is saved in steps: the product itself first, then its
// pictures, then its options (sizes / extras / colours). Before this fix, if
// the pictures or the options failed, the box still thought it was making a
// NEW product - so pressing Save again made a SECOND copy of it. Now the box
// remembers the product the first press made, and a second press finishes
// THAT product. These are the words it says, kept here so they can be tested
// without React.
//
// A fixed-price store also needs a BUYING price for a new product (what Takal
// pays the shop). Without one the server saves the product switched off.
// ─────────────────────────────────────────────────────────────────────────────

import { customerPays } from "./fixed-prices.ts";

/** A step after the product itself that can fail on its own. */
export type ProductPart = "pictures" | "options";

/** What to say when the product is saved but one of its parts is not.
 *  `created` = this press made the product (it was new). Null = nothing failed. */
export function partsFailedMessage(created: boolean, failed: ProductPart[]): string | null {
  const parts = Array.from(new Set(failed));
  if (parts.length === 0) return null;
  const first = created ? "Product saved" : "Changes saved";
  if (parts.length === 2) {
    return `${first}, but its pictures and options did not save - press Save to try again`;
  }
  return parts[0] === "pictures"
    ? `${first}, but its pictures did not upload - press Save to try again`
    : `${first}, but its options did not save - press Save to try again`;
}

/** The buying price box of a NEW product in a fixed-price store: whole rupees,
 *  required. Null = fine. */
export function buyingPriceProblem(text: string): string | null {
  const t = text.trim();
  if (t === "") return "Enter the buying price - Takal pays the shop this";
  if (!/^\d+$/.test(t)) return "The buying price is whole rupees only, like 450";
  return null;
}

/** The buying price is more than the selling price after the discount: the
 *  product would sell at a loss. Said, not refused - the Products tab is the
 *  place that asks about a loss on purpose. */
export function sellsAtALoss(buying: string, selling: string, discountPercent: string): boolean {
  const b = Number(buying.trim());
  const s = Number(selling.trim());
  if (!buying.trim() || !selling.trim() || !Number.isFinite(b) || !Number.isFinite(s)) return false;
  // The same sum the store's price list uses (fixed-prices.ts), so the two
  // screens never disagree about what the customer pays.
  const pays = customerPays(s, parseInt(discountPercent) || 0);
  return pays !== null && b > pays;
}
