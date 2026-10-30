// MOCK 218 v2 - EASY SIZES, COLOURS AND DETAILS (Sana, 29 Oct 2026: "GO 218").
//
// The panel's copy of the easy steps' two rules:
//   buildRows - the choices -> the option rows to save
//   readRows  - the saved rows -> the choices, to change them
// The SAME rules as backend/option_templates.py and the Partners app's
// choices_rules.dart. All three are tested against one list of cases,
// swat-delivery-app/backend/option_wizard_cases.json, so the panel, the app
// and the server can never save a product's choices in two different ways.
//
// HOW A CHOICE IS SAVED (Mock 92):
//   one kind    variant_type = the kind's label ("Size"),  value "M"
//   two kinds   variant_type = the FIRST value ("Red"),    value "M"
// so the customer picks Red first and then sees only Red's sizes.

import type { OptionDraft } from "./product-edit.ts";

/** The group names the customer app reads as a QUESTION, not a first step. */
export const QUESTION_WORDS = new Set([
  "size", "colour", "color", "option", "options", "weight", "flavour",
  "flavor", "type", "style", "pack", "رنگ", "سائز",
]);

export interface ChoiceGroup { title: string; values: string[]; dots?: Record<string, string> }
export interface ChoiceKind { key: string; label: string; roman?: string; icon?: string; swatch?: boolean; groups: ChoiceGroup[] }
export interface DetailBox { label: string; example: string; important?: boolean }
export interface ChoiceTemplate {
  department: string; shelf: string; kinds: ChoiceKind[]; suggested: string[]; details: DetailBox[];
  fromServer: boolean;
}
export interface Choice {
  levels: string[]; first: string[]; second?: Record<string, string[]>;
  price?: Record<string, unknown>; stock?: Record<string, unknown>;
}
export interface BuiltRow { variant_type: string; variant_value: string; price_override: number | null; stock_quantity: number | null }
export interface Built { rows: BuiltRow[]; add_detail: { label: string; value: string } | null; problem?: string; value?: string }

/** Every ready value of a kind, in order. */
export const valuesOf = (k: ChoiceKind) => k.groups.flatMap((g) => g.values);

/** The everyday kinds, for when the server cannot be asked. */
export const FALLBACK: ChoiceTemplate = {
  department: "", shelf: "", fromServer: false, suggested: ["colour"],
  kinds: [
    { key: "colour", label: "Colour", roman: "Rang", icon: "🎨", swatch: true, groups: [{ title: "Colours", values: [
      "Black", "White", "Red", "Maroon", "Mehroon", "Pink", "Blue", "Sky blue", "Navy", "Green", "Mehndi green", "Yellow",
      "Orange", "Brown", "Beige", "Cream", "Grey", "Silver", "Gold", "Purple", "Olive"] }] },
    { key: "size", label: "Size", roman: "S, M, L, XL", icon: "📏", groups: [
      { title: "Letters", values: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "Free size"] },
      { title: "Numbers (waist, chest)", values: ["26", "28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48", "50"] }] },
    { key: "weight", label: "Weight", roman: "Wazan", icon: "⚖️", groups: [
      { title: "Grams", values: ["50 g", "100 g", "125 g", "250 g", "400 g", "500 g", "750 g"] },
      { title: "Kilograms", values: ["1 kg", "1.5 kg", "2 kg", "2.5 kg", "5 kg", "10 kg", "20 kg"] }] },
    { key: "volume", label: "Volume", roman: "ml / Litre", icon: "🧴", groups: [
      { title: "Millilitres", values: ["100 ml", "200 ml", "250 ml", "330 ml", "500 ml", "750 ml"] },
      { title: "Litres", values: ["1 L", "1.5 L", "2 L", "3 L", "5 L"] }] },
    { key: "pack", label: "Pack", roman: "Pack / tadaad", icon: "📦", groups: [
      { title: "Packs", values: ["Single", "Pack of 2", "Pack of 3", "Pack of 6", "Dozen", "Carton"] }] },
  ],
  details: [{ label: "Brand", example: "Brand name", important: true }, { label: "Made in", example: "Pakistan" }],
};

/** The server's /option-templates answer, or FALLBACK when it is not usable. */
export function templateFrom(j: unknown): ChoiceTemplate {
  if (!j || typeof j !== "object") return FALLBACK;
  const o = j as Record<string, unknown>;
  const kinds: ChoiceKind[] = [];
  for (const k of Array.isArray(o.kinds) ? o.kinds : []) {
    if (!k || typeof k !== "object") continue;
    const r = k as Record<string, unknown>;
    const key = String(r.key ?? "").trim(), label = String(r.label ?? "").trim();
    if (!key || !label) continue;
    const groups: ChoiceGroup[] = [];
    for (const g of Array.isArray(r.groups) ? r.groups : []) {
      if (!g || typeof g !== "object") continue;
      const gg = g as Record<string, unknown>;
      const values = (Array.isArray(gg.values) ? gg.values : []).map((v) => String(v).trim()).filter(Boolean);
      if (values.length) groups.push({ title: String(gg.title ?? ""), values, dots: (gg.dots as Record<string, string>) || undefined });
    }
    kinds.push({ key, label, roman: String(r.roman ?? ""), icon: String(r.icon ?? ""), swatch: r.swatch === true, groups });
  }
  if (!kinds.length) return FALLBACK;
  return {
    department: String(o.department ?? ""), shelf: String(o.shelf ?? ""), kinds, fromServer: true,
    suggested: (Array.isArray(o.suggested) ? o.suggested : []).map(String),
    details: (Array.isArray(o.details) ? o.details : [])
      .filter((d) => d && typeof d === "object" && String((d as any).label ?? "").trim())
      .map((d: any) => ({ label: String(d.label), example: String(d.example ?? ""), important: d.important === true })),
  };
}

const one = (v: unknown) => String(v ?? "").trim().split(/\s+/).join(" ");

/** Blanks out, extra spaces out, repeats out (any capitals), first spelling kept. */
export function cleanValues(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values || []) {
    const t = one(v);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out;
}

const price = (p: unknown): number | null => {
  if (p === null || p === undefined || p === "") return null;
  const n = typeof p === "number" ? p : Number(p);
  return Number.isFinite(n) ? n : null;
};
const stock = (q: unknown): number | null => {
  if (q === null || q === undefined || q === "") return null;
  const n = typeof q === "number" ? q : parseInt(String(q), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

/** choices -> rows. Two levels with only ONE first value (a shirt only in
 *  Red) is saved as one level of the second kind, and "Colour: Red" goes
 *  into the details - the customer is never asked "choose Red" alone. */
export function buildRows(choice: Choice): Built {
  const levels = cleanValues(choice.levels || []).slice(0, 2);
  const pr = choice.price || {}, st = choice.stock || {};
  const row = (t: string, v: string, key: string): BuiltRow => ({
    variant_type: t, variant_value: v, price_override: price(pr[key]), stock_quantity: stock(st[key]),
  });
  const first = cleanValues(choice.first || []);
  if (!levels.length || !first.length) return { rows: [], add_detail: null };
  if (levels.length === 1) return { rows: first.map((v) => row(levels[0], v, v)), add_detail: null };
  const second = choice.second || {};
  const pairs = first.map((a) => [a, cleanValues(second[a] || [])] as const).filter(([, bs]) => bs.length > 0);
  if (!pairs.length) return { rows: [], add_detail: null };
  const clash = pairs.map(([a]) => a).filter((a) => QUESTION_WORDS.has(a.toLowerCase()));
  if (pairs.length > 1 && clash.length) {
    return { rows: [], add_detail: null, problem: "first_value_is_a_question", value: clash[0] };
  }
  if (pairs.length === 1) {
    const [a, bs] = pairs[0];
    return { rows: bs.map((b) => row(levels[1], b, `${a}|${b}`)), add_detail: { label: levels[0], value: a } };
  }
  return { rows: pairs.flatMap(([a, bs]) => bs.map((b) => row(a, b, `${a}|${b}`))), add_detail: null };
}

const kindOf = (values: string[], kinds: { label: string; values: string[] }[]) => {
  const low = values.map((v) => v.toLowerCase());
  for (const k of kinds) {
    const ready = new Set((k.values || []).map((x) => String(x).toLowerCase()));
    if (low.length && low.every((v) => ready.has(v))) return String(k.label || "Option");
  }
  return "Option";
};

export interface Read {
  levels: string[]; first: string[]; second: Record<string, string[]>;
  price: Record<string, number>; stock: Record<string, number>; mixed: boolean;
}

/** rows -> choices. "mixed" = rows not saved by these rules: nothing is
 *  guessed, the steps start fresh. */
export function readRows(rows: Record<string, unknown>[], kinds: { label: string; values: string[] }[]): Read {
  const live = (rows || []).filter((r) => String(r.variant_type ?? "").trim().toLowerCase() !== "extra" && !r.archived_at);
  const empty = (mixed: boolean): Read => ({ levels: [], first: [], second: {}, price: {}, stock: {}, mixed });
  const types = cleanValues(live.map((r) => (String(r.variant_type ?? "") === "" ? "Option" : r.variant_type)));
  if (!types.length) return empty(false);
  const pr: Record<string, number> = {}, st: Record<string, number> = {};
  const keep = (key: string, r: Record<string, unknown>) => {
    const p = price(r.price_override); if (p !== null) pr[key] = p;
    const q = stock(r.stock_quantity); if (q !== null) st[key] = q;
  };
  if (types.length === 1) {
    const vals = cleanValues(live.map((r) => r.variant_value));
    for (const r of live) keep(one(r.variant_value), r);
    return { levels: types, first: vals, second: {}, price: pr, stock: st, mixed: false };
  }
  if (types.some((t) => QUESTION_WORDS.has(t.toLowerCase()))) return empty(true);
  const second: Record<string, string[]> = {};
  for (const t of types) {
    const mine = live.filter((r) => one(r.variant_type).toLowerCase() === t.toLowerCase());
    second[t] = cleanValues(mine.map((r) => r.variant_value));
    for (const r of mine) keep(`${t}|${one(r.variant_value)}`, r);
  }
  const allSecond = cleanValues(Object.values(second).flat());
  return { levels: [kindOf(types, kinds), kindOf(allSecond, kinds)], first: types, second, price: pr, stock: st, mixed: false };
}

export const kindsForReading = (t: ChoiceTemplate) => t.kinds.map((k) => ({ label: k.label, values: valuesOf(k) }));

const keyOf = (t: unknown, v: unknown) => `${String(t ?? "").trim().toLowerCase()}\u0000${String(v ?? "").trim().toLowerCase()}`;

/** The steps' rows into the editor's option drafts. An option the product
 *  already had KEEPS its draft - its id, its on / off, its code - with only
 *  the price and stock the steps set; one taken away simply goes (Save then
 *  sends it in remove_ids, as the ✕ does). */
export function draftsFromBuilt(had: OptionDraft[], rows: BuiltRow[]): OptionDraft[] {
  const left = new Map(had.map((d) => [keyOf(d.variant_type, d.variant_value), d]));
  return rows.map((r) => {
    const k = keyOf(r.variant_type, r.variant_value);
    const old = left.get(k);
    left.delete(k);
    const p = r.price_override === null ? "" : String(r.price_override);
    const s = r.stock_quantity === null ? "" : String(r.stock_quantity);
    return old ? { ...old, price: p, stock: s }
      : { variant_type: r.variant_type, variant_value: r.variant_value, price: p, stock: s, sku: "", on: true };
  });
}

/** The drafts as readRows takes them. */
export const rowsOfDrafts = (drafts: OptionDraft[]) => drafts
  .filter((d) => d.variant_type.trim() && d.variant_value.trim())
  .map((d) => ({ variant_type: d.variant_type, variant_value: d.variant_value,
    price_override: d.price?.trim() ? Number(d.price.replace(/,/g, "")) : null,
    stock_quantity: d.stock?.trim() ? parseInt(d.stock, 10) : null }));

/** "Red: S, M, L" - one line per first step. */
export function choiceLines(drafts: OptionDraft[]): string[] {
  const by = new Map<string, string[]>();
  for (const d of drafts) {
    if (!d.variant_type.trim() || !d.variant_value.trim()) continue;
    const k = d.variant_type.trim();
    by.set(k, [...(by.get(k) || []), d.variant_value.trim()]);
  }
  return [...by].map(([k, v]) => `${k}: ${v.join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────
// MIGRATION 153 - A PHOTO FOR EACH CHOICE (backend option_templates.py
// photo_keys / clean_choice_photos - the same rules, the same cases).
// ─────────────────────────────────────────────────────────────────────────

/** What a photo can belong to: the FIRST step the customer taps. */
export function photoKeys(rows: readonly { variant_type?: unknown; variant_value?: unknown }[]): string[] {
  const live = (rows || []).filter((r) => String(r.variant_type ?? "").trim().toLowerCase() !== "extra");
  const types = cleanValues(live.map((r) => r.variant_type));
  if (types.length > 1 && !types.some((t) => QUESTION_WORDS.has(t.toLowerCase()))) return types;
  return cleanValues(live.map((r) => r.variant_value));
}

/** Only choices the product HAS (written as the choice is) and photos it HAS. */
export function cleanChoicePhotos(photosFor: Record<string, unknown>, keys: string[], photos: string[]): Record<string, string> {
  const byLow = new Map(keys.map((k) => [k.toLowerCase(), k]));
  const own = (photos || []).map((p) => String(p || "").trim()).filter(Boolean);
  const out: Record<string, string> = {};
  for (const [k, u] of Object.entries(photosFor || {})) {
    const key = byLow.get(one(k).toLowerCase());
    const url = String(u ?? "").trim();
    if (key && own.includes(url) && !(key in out)) out[key] = url;
  }
  return out;
}

/** The product's saved choice_photos, read whichever way it arrives (an
 *  object, or JSON text from an older read). Anything else = none. */
export function choicePhotosOf(v: unknown): Record<string, string> {
  let o: unknown = v;
  if (typeof v === "string") { try { o = JSON.parse(v); } catch { return {}; } }
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  const out: Record<string, string> = {};
  for (const [k, u] of Object.entries(o as Record<string, unknown>)) {
    if (typeof u === "string" && one(k) && u.trim()) out[one(k)] = u.trim();
  }
  return out;
}

const canonPhotos = (m: Record<string, string>) =>
  JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]]));

/** What Save sends for choice_photos: undefined = nothing changed (not sent),
 *  null = take them all away, an object = the new set. `had` is what the
 *  fresh read said, `now` what the person has picked - both cleaned against
 *  the product's choices and photos AS THEY WILL BE SAVED. */
export function choicePhotosToSend(had: Record<string, string>, now: Record<string, string>): Record<string, string> | null | undefined {
  if (canonPhotos(had) === canonPhotos(now)) return undefined;
  return Object.keys(now).length ? now : null;
}
