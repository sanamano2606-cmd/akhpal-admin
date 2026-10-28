// THE WHATSAPP MESSAGE IN THREE LANGUAGES  (Mock 215-3, Sana 28 Oct 2026:
// "add a switch for urdu writing and english writing when sending a whatsapp
// message during review and only whatsapp message" -> "a switch with all three
// (English, اردو, Roman)").
//
// ONLY the WhatsApp message changes. What the vendor reads in the Partners app
// stays as it is. The Urdu is written as Urdu - not word-for-word from the
// English - and every ready reason (lib/shop-review.ts) has its own Urdu and
// Roman Urdu words here; a test fails the day one is added without them.
// Words a reviewer typed herself go out exactly as typed, in every language.

export type WaLang = "en" | "ur" | "roman";
export const WA_LANGS: { key: WaLang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "ur", label: "اردو" },
  { key: "roman", label: "Roman" },
];
export const WA_LANG_KEY = "takal.whatsapp.lang";

/** The language last chosen in this browser (English the first time). */
export function savedWaLang(): WaLang {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(WA_LANG_KEY) : null;
    return v === "ur" || v === "roman" ? v : "en";
  } catch {
    return "en";
  }
}
export function rememberWaLang(lang: WaLang): void {
  try { window.localStorage.setItem(WA_LANG_KEY, lang); } catch { /* private window - fine */ }
}

// ── The names of the things a reviewer marks ─────────────────────────────────
export const LABEL_WORDS: Record<string, { ur: string; roman: string }> = {
  "Owner name": { ur: "مالک کا نام", roman: "Malik ka naam" },
  "Phone number": { ur: "فون نمبر", roman: "Phone number" },
  "Email": { ur: "ای میل", roman: "Email" },
  "Shop name": { ur: "دکان کا نام", roman: "Dukan ka naam" },
  "Shop type": { ur: "دکان کی قسم", roman: "Dukan ki qisam" },
  "Description": { ur: "دکان کا تعارف", roman: "Dukan ka taaruf" },
  "Minimum order": { ur: "کم سے کم آرڈر", roman: "Kam se kam order" },
  "Opening hours": { ur: "دکان کھلنے کے اوقات", roman: "Dukan khulne ka waqt" },
  "Shop logo": { ur: "دکان کا لوگو", roman: "Dukan ka logo" },
  "Address and map pin": { ur: "پتہ اور نقشے پر نشان", roman: "Pata aur map ka pin" },
  "Where Takal sends your money": { ur: "آپ کی رقم کہاں بھیجی جائے", roman: "Aap ki raqam kahan bheji jaye" },
  "Pharmacy licence": { ur: "فارمیسی کا لائسنس", roman: "Pharmacy ka licence" },
  "Products - at least 5, each with a photo": { ur: "پراڈکٹس — کم از کم 5، ہر ایک کی تصویر کے ساتھ", roman: "Products — kam az kam 5, har aik ki tasveer ke sath" },
};
const PRODUCT_TAIL = " - photo and details";

// ── Every ready reason: [Urdu, Roman Urdu] ───────────────────────────────────
export const REASON_WORDS: Record<string, [string, string]> = {
  // logo
  "Has a phone number or website on it": ["لوگو پر فون نمبر یا ویب سائٹ لکھی ہے، اسے ہٹا دیں", "Logo par phone number ya website likhi hai, usay hata dein"],
  "Picture is blurry": ["تصویر صاف نہیں ہے", "Tasveer saaf nahi hai"],
  "Too dark": ["تصویر بہت اندھیری ہے", "Tasveer bohat andheri hai"],
  "Not the shop's own logo": ["یہ آپ کی دکان کا اپنا لوگو نہیں ہے", "Yeh aap ki dukan ka apna logo nahi hai"],
  "Cut off / wrong size": ["تصویر کٹی ہوئی ہے یا سائز ٹھیک نہیں", "Tasveer kati hui hai ya size theek nahi"],
  "A person's photo, not a logo": ["یہ کسی شخص کی تصویر ہے، لوگو نہیں", "Yeh kisi shakhs ki tasveer hai, logo nahi"],
  "A photo of the shop, not a logo": ["یہ دکان کی تصویر ہے، لوگو نہیں", "Yeh dukan ki tasveer hai, logo nahi"],
  "Has another company's brand on it": ["اس پر کسی اور کمپنی کا برانڈ ہے", "Is par kisi aur company ka brand hai"],
  "Writing is too small to read": ["لکھائی بہت چھوٹی ہے، پڑھی نہیں جاتی", "Likhai bohat choti hai, parhi nahi jati"],
  "Picture is stretched": ["تصویر کھنچی ہوئی ہے", "Tasveer khinchi hui hai"],
  "No logo uploaded yet": ["لوگو ابھی نہیں ڈالا گیا", "Logo abhi nahi dala gaya"],
  // one product
  "Phone number or website on the photo": ["تصویر پر فون نمبر یا ویب سائٹ لکھی ہے، اسے ہٹا دیں", "Tasveer par phone number ya website likhi hai, usay hata dein"],
  "Phone number or website in the description": ["تفصیل میں فون نمبر یا ویب سائٹ لکھی ہے، اسے ہٹا دیں", "Tafseel mein phone number ya website likhi hai, usay hata dein"],
  "Blurry": ["تصویر صاف نہیں ہے", "Tasveer saaf nahi hai"],
  "Not a real photo of this product": ["یہ اس پراڈکٹ کی اصل تصویر نہیں ہے", "Yeh is product ki asal tasveer nahi hai"],
  "Messy background - use plain white": ["پیچھے کا منظر صاف نہیں، سادہ سفید پس منظر استعمال کریں", "Peechay ka manzar saaf nahi, saada safed background use karein"],
  "Photo copied with another shop's logo": ["تصویر کسی اور دکان کے لوگو کے ساتھ لی گئی ہے", "Tasveer kisi aur dukan ke logo ke sath li gayi hai"],
  "Wrong product": ["یہ غلط پراڈکٹ ہے", "Yeh ghalat product hai"],
  "Price looks wrong": ["قیمت درست نہیں لگتی", "Qeemat durust nahi lagti"],
  "Name is not clear": ["نام واضح نہیں ہے", "Naam wazeh nahi hai"],
  "Description is missing": ["تفصیل نہیں لکھی گئی", "Tafseel nahi likhi gayi"],
  "Size or weight is missing (example: 500 g)": ["سائز یا وزن نہیں لکھا (مثال: 500 گرام)", "Size ya wazan nahi likha (misaal: 500 gram)"],
  "Wrong shelf": ["پراڈکٹ غلط شیلف میں ہے", "Product ghalat shelf mein hai"],
  "Discount looks too big": ["رعایت بہت زیادہ لگتی ہے", "Riayat bohat zyada lagti hai"],
  "Cannot be sold without a licence": ["یہ پراڈکٹ لائسنس کے بغیر نہیں بیچی جا سکتی", "Yeh product licence ke baghair nahi bechi ja sakti"],
  "Same product added twice": ["ایک ہی پراڈکٹ دو بار ڈالی گئی ہے", "Aik hi product do baar dali gayi hai"],
  // owner
  "Name is not complete": ["نام مکمل نہیں ہے", "Naam mukammal nahi hai"],
  "Spelling is wrong": ["ہجے غلط ہیں", "Spelling ghalat hai"],
  "Write the full name as on the CNIC": ["شناختی کارڈ والا پورا نام لکھیں", "Shanakhti card wala poora naam likhein"],
  "Phone is not answering": ["فون کا جواب نہیں ملتا", "Phone ka jawab nahi milta"],
  "Number looks wrong": ["نمبر درست نہیں لگتا", "Number durust nahi lagta"],
  "Number is not on WhatsApp": ["یہ نمبر واٹس ایپ پر نہیں ہے", "Yeh number WhatsApp par nahi hai"],
  "Number belongs to someone else": ["یہ نمبر کسی اور کا ہے", "Yeh number kisi aur ka hai"],
  "Email looks wrong": ["ای میل درست نہیں لگتی", "Email durust nahi lagti"],
  "Email is missing": ["ای میل نہیں دی گئی", "Email nahi di gayi"],
  // shop details
  "Not the name on the sign board": ["یہ نام دکان کے بورڈ والا نہیں ہے", "Yeh naam dukan ke board wala nahi hai"],
  "Shop name and type do not match": ["دکان کا نام اور قسم آپس میں نہیں ملتے", "Dukan ka naam aur qisam aapas mein nahi milte"],
  "Has a phone number or city in the name": ["نام میں فون نمبر یا شہر کا نام لکھا ہے", "Naam mein phone number ya sheher ka naam likha hai"],
  "Too long - remove extra words": ["نام بہت لمبا ہے، فالتو الفاظ ہٹا دیں", "Naam bohat lamba hai, faltu alfaaz hata dein"],
  "Wrong shop type": ["دکان کی قسم غلط ہے", "Dukan ki qisam ghalat hai"],
  "Choose a more exact type": ["دکان کی زیادہ درست قسم چنیں", "Dukan ki zyada durust qisam chunein"],
  "Description is empty or too short": ["تعارف خالی ہے یا بہت مختصر ہے", "Taaruf khali hai ya bohat mukhtasar hai"],
  "Description is not about this shop": ["تعارف اس دکان کے بارے میں نہیں ہے", "Taaruf is dukan ke baray mein nahi hai"],
  "Spelling mistakes": ["ہجے کی غلطیاں ہیں", "Spelling ki ghaltiyan hain"],
  "Has a phone number or website - remove it": ["اس میں فون نمبر یا ویب سائٹ لکھی ہے، اسے ہٹا دیں", "Is mein phone number ya website likhi hai, usay hata dein"],
  "Write simply what you sell": ["سادہ الفاظ میں لکھیں کہ آپ کیا بیچتے ہیں", "Saada alfaaz mein likhein ke aap kya bechte hain"],
  "Minimum order looks wrong": ["کم سے کم آرڈر درست نہیں لگتا", "Kam se kam order durust nahi lagta"],
  "Minimum order is too low": ["کم سے کم آرڈر بہت کم ہے", "Kam se kam order bohat kam hai"],
  "Minimum order is too high": ["کم سے کم آرڈر بہت زیادہ ہے", "Kam se kam order bohat zyada hai"],
  "Opening hours look wrong": ["کھلنے کے اوقات درست نہیں لگتے", "Khulne ka waqt durust nahi lagta"],
  "Closing time is before opening time": ["بند ہونے کا وقت کھلنے کے وقت سے پہلے ہے", "Band hone ka waqt khulne ke waqt se pehle hai"],
  "AM and PM look swapped": ["صبح اور شام (AM اور PM) الٹ لگتے ہیں", "Subah aur shaam (AM aur PM) ulat lagte hain"],
  "Shown open 24 hours - is that right?": ["دکان 24 گھنٹے کھلی دکھائی دیتی ہے — کیا یہ درست ہے؟", "Dukan 24 ghante khuli dikhayi deti hai — kya yeh durust hai?"],
  // location
  "Map pin is in the wrong place": ["نقشے پر نشان غلط جگہ پر ہے", "Map par pin ghalat jagah par hai"],
  "Address is not complete": ["پتہ مکمل نہیں ہے", "Pata mukammal nahi hai"],
  "Pin is not on the shop": ["نشان دکان پر نہیں لگا", "Pin dukan par nahi laga"],
  "Add a nearby landmark": ["قریب کی کوئی مشہور جگہ بھی لکھیں", "Qareeb ki koi mashhoor jagah bhi likhein"],
  "Shop is outside the delivery area": ["دکان ڈیلیوری کے علاقے سے باہر ہے", "Dukan delivery ke ilaqay se bahar hai"],
  // money
  "Account name does not match the owner": ["اکاؤنٹ کا نام مالک کے نام سے نہیں ملتا", "Account ka naam malik ke naam se nahi milta"],
  "Account number looks wrong": ["اکاؤنٹ نمبر درست نہیں لگتا", "Account number durust nahi lagta"],
  "Details are missing": ["تفصیلات نہیں دی گئیں", "Tafseelat nahi di gayin"],
  "IBAN is not complete": ["IBAN مکمل نہیں ہے", "IBAN mukammal nahi hai"],
  "Bank name is missing": ["بینک کا نام نہیں لکھا", "Bank ka naam nahi likha"],
  "Account is not in the owner's or shop's name": ["اکاؤنٹ مالک یا دکان کے نام پر نہیں ہے", "Account malik ya dukan ke naam par nahi hai"],
  // licence
  "Photo is not clear": ["تصویر صاف نہیں ہے", "Tasveer saaf nahi hai"],
  "Number does not match the photo": ["نمبر تصویر والے نمبر سے نہیں ملتا", "Number tasveer wale number se nahi milta"],
  "Licence is in another name": ["لائسنس کسی اور کے نام پر ہے", "Licence kisi aur ke naam par hai"],
  "Date looks wrong": ["تاریخ درست نہیں لگتی", "Tareekh durust nahi lagti"],
  // the products line
  "No products uploaded": ["کوئی پراڈکٹ نہیں ڈالی گئی", "Koi product nahi dali gayi"],
  "Fewer than 5 products": ["5 سے کم پراڈکٹس ہیں", "5 se kam products hain"],
  "Some products have no photo": ["کچھ پراڈکٹس کی تصویر نہیں ہے", "Kuch products ki tasveer nahi hai"],
  "Products are not from this shop type": ["پراڈکٹس اس قسم کی دکان کی نہیں ہیں", "Products is qisam ki dukan ki nahi hain"],
  "Prices are missing": ["قیمتیں نہیں لکھی گئیں", "Qeematein nahi likhi gayin"],
};

// ── The waiting list's "what is left" steps (backend vendor_intake._WORDS) ──
export const STEP_WORDS: Record<string, { ur: string; roman: string }> = {
  "Shop details and phone": { ur: "دکان کی تفصیل اور فون", roman: "Dukan ki tafseel aur phone" },
  "Address and map pin": { ur: "پتہ اور نقشے پر نشان", roman: "Pata aur map ka pin" },
  "Opening hours": { ur: "دکان کھلنے کے اوقات", roman: "Dukan khulne ka waqt" },
  "Shop logo": { ur: "دکان کا لوگو", roman: "Dukan ka logo" },
  "At least 5 products": { ur: "کم از کم 5 پراڈکٹس", roman: "Kam az kam 5 products" },
  "A photo on every product": { ur: "ہر پراڈکٹ کی تصویر", roman: "Har product ki tasveer" },
  "Where Takal sends the money": { ur: "آپ کی رقم کہاں بھیجی جائے", roman: "Aap ki raqam kahan bheji jaye" },
  "Owner has signed in and accepted the Terms": { ur: "مالک ایپ میں داخل ہو کر شرائط قبول کرے", roman: "Malik app mein login kar ke sharait qabool kare" },
};

/** English words inside an Urdu line: kept whole, left-to-right, so a name
 *  like "Mobile and Accessories" is not scrambled by the right-to-left line
 *  round it (Unicode first-strong isolate - WhatsApp honours it). */
export function isolate(text: string): string {
  return text ? `\u2068${text}\u2069` : text;
}

export type WaFix = { label: string; reason: string; words?: string; vendor_can_fix?: boolean };

function labelIn(lang: WaLang, label: string): string {
  if (lang === "en") return label;
  if (label.endsWith(PRODUCT_TAIL)) {
    const name = label.slice(0, -PRODUCT_TAIL.length);
    return lang === "ur" ? `${isolate(name)} — تصویر اور تفصیل` : `${name} — tasveer aur tafseel`;
  }
  const w = LABEL_WORDS[label];
  return w ? w[lang] : label;
}

/** A ready reason in the language; a reason typed by the reviewer as typed. */
export function reasonIn(lang: WaLang, reason: string): string {
  const r = String(reason || "").trim();
  if (lang === "en") return r;
  const w = REASON_WORDS[r] || REASON_WORDS[r.replace(/\.$/, "")];
  return w ? (lang === "ur" ? w[0] : w[1]) : r;
}

function firstName(owner: string): string {
  return String(owner || "").trim().split(/\s+/)[0] || "";
}

/** The send-back message. `en` is word for word what the server writes
 *  (shop_review.whatsapp_text), so English stays as it always was. */
export function sendBackMessage(lang: WaLang, owner: string, shop: string, fixes: WaFix[]): string {
  const first = firstName(owner);
  const n = fixes.length;
  const lines: string[] = [];
  if (lang === "en") {
    lines.push(`Assalam o Alaikum${first ? " " + first : ""},`, "",
      `Takal checked your shop "${shop}". Please fix ${n === 1 ? "this thing" : `these ${n} things`} in the Takal Partners app:`, "");
  } else if (lang === "ur") {
    lines.push(`السلام علیکم${first ? " " + isolate(first) : ""}،`, "",
      `تکل نے آپ کی دکان "${isolate(shop)}" چیک کی ہے۔ برائے مہربانی تکل پارٹنرز ایپ میں ${n === 1 ? "یہ چیز" : `یہ ${n} چیزیں`} ٹھیک کر دیں:`, "");
  } else {
    lines.push(`Assalam o Alaikum${first ? " " + first : ""},`, "",
      `Takal ne aap ki dukan "${shop}" check ki hai. Meherbani kar ke Takal Partners app mein ${n === 1 ? "yeh cheez" : `yeh ${n} cheezen`} theek kar dein:`, "");
  }
  fixes.forEach((f, i) => {
    const reason = reasonIn(lang, f.reason).replace(/[.۔]$/, "");
    const end = lang === "ur" ? "۔" : ".";
    const num = lang === "ur" ? `${i + 1}۔` : `${i + 1}.`;
    lines.push(`${num} ${labelIn(lang, f.label)}${lang === "ur" ? ": " : " - "}${reason}${end}`);
    if (f.words) lines.push(`   ${lang === "ur" ? isolate(f.words) : f.words}`);
    if (f.vendor_can_fix === false) {
      lines.push(lang === "en" ? "   (Takal will sort this one out with you.)"
        : lang === "ur" ? "   (یہ معاملہ تکل آپ کے ساتھ مل کر حل کرے گا۔)"
        : "   (Yeh maamla Takal aap ke sath mil kar hal karega.)");
    }
    lines.push("");
  });
  if (lang === "en") lines.push('When you have fixed them, press "Send for review again" in the app.', "", "Thank you,", "Takal Team");
  else if (lang === "ur") lines.push('ٹھیک کرنے کے بعد ایپ میں "Send for review again" کا بٹن دبائیں۔', "", "شکریہ،", "تکل ٹیم");
  else lines.push('Theek karne ke baad app mein "Send for review again" ka button dabayen.', "", "Shukriya,", "Takal Team");
  return lines.join("\n");
}

/** The waiting list's "WhatsApp what is left". `en` is word for word the
 *  old message (vendor-queue.whatIsLeftMessage). */
export function whatIsLeftIn(lang: WaLang, shop: string, left: string[]): string {
  const given = (shop || "").trim();
  const name = given ? (lang === "ur" ? isolate(given) : given) : (lang === "ur" ? "آپ کی دکان" : lang === "roman" ? "aap ki dukan" : "your shop");
  const step = (x: string) => (lang === "en" ? x : STEP_WORDS[x]?.[lang] || x);
  if (lang === "en") {
    if (!left.length) return `Assalam o Alaikum! ${name} is ready on Takal - we are approving it now. Thank you.`;
    return [`Assalam o Alaikum! Thank you for registering ${name} on Takal.`,
      "Before we can open it for customers, please finish these in the Takal Partners app:",
      ...left.map((x, i) => `${i + 1}. ${x}`), "Reply here if you need help."].join("\n");
  }
  if (lang === "ur") {
    if (!left.length) return `السلام علیکم! ${name} تکل پر تیار ہے — ہم اسے ابھی منظور کر رہے ہیں۔ شکریہ۔`;
    return [`السلام علیکم! ${name} کو تکل پر رجسٹر کرنے کا شکریہ۔`,
      "گاہکوں کے لیے کھولنے سے پہلے، برائے مہربانی تکل پارٹنرز ایپ میں یہ مکمل کر دیں:",
      ...left.map((x, i) => `${i + 1}۔ ${step(x)}`), "کسی مدد کی ضرورت ہو تو یہیں جواب دیں۔"].join("\n");
  }
  if (!left.length) return `Assalam o Alaikum! ${name} Takal par tayyar hai — hum isay abhi approve kar rahe hain. Shukriya.`;
  return [`Assalam o Alaikum! ${name} ko Takal par register karne ka shukriya.`,
    "Customers ke liye kholne se pehle, meherbani kar ke Takal Partners app mein yeh mukammal kar dein:",
    ...left.map((x, i) => `${i + 1}. ${step(x)}`), "Koi madad chahiye ho to yahin jawab dein."].join("\n");
}

/** Reasons a reviewer typed herself - shown under the preview, because they
 *  go out as typed whatever the language. */
export function typedOwnWords(fixes: WaFix[]): number {
  return fixes.filter((f) => !REASON_WORDS[String(f.reason || "").trim()] || !!f.words).length;
}
