// NO PHONE NUMBER OR WEBSITE ON A SHOP OR A PRODUCT  (Mock 215-2, Sana 28 Oct
// 2026: "the Shop/product that has number website on logo Or In description
// or anywhere in product page will not be Approved by any admin include me
// showing the reason on a note").
//
// A number on a logo or in a description takes the customer - and the order -
// straight to the shop, round Takal. This is the ONE rule that finds them. The
// server has the same rule in Python (backend/contact_info.py) and is the one
// that refuses Approve; the tests run the same examples through both.
//
// Examples that ARE found:   "0344-9679387", "+92 344 9679387", "WhatsApp: …",
//                            "www.horain.pk", "fb.com/horain", "واٹس ایپ"
// Examples that are NOT:     "500 ml", "Rs 2,200", "Pack of 12", "1.5kg",
//                            "Model 2026", "9:00 AM – 9:00 PM"

export type ContactKind = "phone" | "website" | "social" | "email";
export type ContactHit = { kind: ContactKind; text: string };

/** Urdu / Arabic digits written as 0-9, so "۰۳۴۴…" is found too. */
export function westernDigits(text: string): string {
  return String(text || "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

// A Pakistani mobile: 03xx xxxxxxx, +92 3xx…, 92 3xx…, with or without
// spaces, dashes or dots between the groups.
const MOBILE = /(?<!\d)(?:\+?92[\s\-.]?|0)3\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4}(?!\d)/g;
// A landline only after a word that says it is one (a bare "0946 123456"
// looks like too many other things): "Ph 0946-722345", "Tel: 091 1234567".
const LANDLINE = /(?:ph(?:one)?|tel|cell|call|contact|mob(?:ile)?|فون|رابطہ)\s*[:.#-]?\s*((?:\+?92[\s\-.]?|0)\d{2,4}[\s\-.]?\d{5,8})(?!\d)/gi;
const WEBSITE = /\b(?:https?:\/\/\S+|www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+\S*|[a-z0-9][a-z0-9-]{1,}\.(?:com|pk|net|org|shop|store|online|site|co|info|biz|me|app)\b(?:\/\S*)?)/gi;
const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
// Social and chat apps: the name itself is a way round Takal.
const SOCIAL_WORDS = /\b(?:whats\s?app|facebook|fb\.com|instagram|insta|tiktok|youtube|snapchat|telegram|imo)\b|واٹس\s?ایپ|وٹس\s?ایپ|فیس\s?بک/gi;
// "@horain_traders" - an account name. Not in a picture: there it is mostly
// noise read off a pattern.
const HANDLE = /(?<![a-z0-9._%+-])@[a-z0-9_.]{3,30}\b/gi;

function push(out: ContactHit[], kind: ContactKind, text: string) {
  const t = text.trim().replace(/[.,;:)]+$/, "");
  if (t && !out.some((h) => h.kind === kind && h.text.toLowerCase() === t.toLowerCase())) out.push({ kind, text: t });
}

/** Every phone number, website, e-mail or social app named in the text.
 *  `fromPicture`: words read off a picture - short noisy matches (a bare
 *  "@abc", "insta") are left out; numbers and addresses still count. */
export function findContactInfo(text: string | null | undefined, opts: { fromPicture?: boolean } = {}): ContactHit[] {
  const t = westernDigits(String(text || ""));
  if (!t.trim()) return [];
  const out: ContactHit[] = [];
  for (const m of t.matchAll(MOBILE)) push(out, "phone", m[0]);
  for (const m of t.matchAll(LANDLINE)) push(out, "phone", m[1]);
  const emails = [...t.matchAll(EMAIL)].map((m) => m[0]);
  for (const e of emails) push(out, "email", e);
  for (const m of t.matchAll(WEBSITE)) {
    // The domain of an e-mail address is not a second, separate website.
    if (emails.some((e) => e.toLowerCase().endsWith(m[0].toLowerCase()))) continue;
    push(out, "website", m[0]);
  }
  for (const m of t.matchAll(SOCIAL_WORDS)) {
    if (opts.fromPicture && /^insta$/i.test(m[0])) continue;
    push(out, "social", m[0]);
  }
  if (!opts.fromPicture) {
    for (const m of t.matchAll(HANDLE)) {
      if (!emails.some((e) => e.includes(m[0]))) push(out, "social", m[0]);
    }
  }
  return out;
}

export const CONTACT_WORDS: Record<ContactKind, string> = {
  phone: "Phone number",
  website: "Website",
  social: "WhatsApp / social",
  email: "E-mail address",
};

/** "Phone number 0344-9679387 · Social app WhatsApp" - for a note. */
export function contactLine(hits: ContactHit[]): string {
  return hits.map((h) => `${CONTACT_WORDS[h.kind]} ${h.text}`).join(" · ");
}
