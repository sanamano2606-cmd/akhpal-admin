/**
 * THE TWO DEMO SHOPS (Sana, 29 Oct 2026: "These two always stay live and are
 * never told anything"). Store reviewers (Apple / Google) order from them.
 *
 * The Stores page leaves them out of every count and every problem list
 * (bug B6, Sana 9 Nov 2026: "40 Live" was really 38, and both shops in
 * "Need attention" were these two). They still appear in the Live list,
 * marked "Demo".
 *
 * MUST stay the same as backend takal_assistant.DEMO_SHOP_IDS
 * (tests/demo-shops.test.ts reads that file and checks).
 */
export const DEMO_SHOP_IDS: ReadonlySet<string> = new Set([
  "33ea73d1-d3eb-4393-90e0-be4a6d23d8dd", // Campus Cafe Charbagh
  "6f5b758b-6e2d-49f6-8e28-ceecbea58eb9", // Baby & Baba's Shop (store reviewers)
]);

export function isDemoShop(id: unknown): boolean {
  return DEMO_SHOP_IDS.has(String(id ?? ""));
}
