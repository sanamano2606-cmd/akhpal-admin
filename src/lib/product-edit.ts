// ─────────────────────────────────────────────────────────────────────────────
// EDITING ONE PRODUCT - SEND ONLY WHAT THE PERSON CHANGED.  (Audit 203.)
//
// The ✏️ editor used to send EVERY box on every Save: the name, the price, the
// stock, the description, every option, every photo. Two things went wrong:
//
//   * It started from the LIST ROW, which can be minutes old. If the shop had
//     changed the stock in the Partners app since, Save quietly put the old
//     number back.
//   * An emptied box could never clear anything. "Stock" emptied was simply not
//     sent, so the product stayed at 5 for ever; an option's price emptied was
//     not sent either, so it kept its own price.
//
// Now the editor reads the product FRESH, keeps that as "what was loaded", and
// on Save sends only the boxes that differ from it. An emptied box sends null,
// which the server reads as "clear it" (stock = not counted, option price =
// uses the product price). These plain functions hold the rules, so the screen
// and the tests use the same ones.
// ─────────────────────────────────────────────────────────────────────────────

import { isExtra, usedExtras, usedSizes, type ExtraRow, type SizeRow } from "./product-sizes.ts";

// ── The product's own boxes ─────────────────────────────────────────────────

/** "  Panadol   500mg " -> "Panadol 500mg" - how a name is compared. */
export const tidyName = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** What the fresh read says, in the same shape the editor builds on Save.
 *  Example: { name: "Panadol", price: 120, stock: null, ... }. */
export function productBaseline(full: any): Record<string, unknown> {
  return {
    name: tidyName(full?.name),
    description: String(full?.description ?? "").trim(),
    price: numOrNull(full?.price),
    discount_percent: numOrNull(full?.discount_percent) ?? 0,
    stock: numOrNull(full?.stock),
    is_available: full?.is_available !== false,
    category_id: full?.category_id ? String(full.category_id) : "",
    preparation_time: numOrNull(full?.preparation_time),
    specs: full?.specs ?? null,
    video_url: String(full?.video_url ?? "").trim() || null,
  };
}

function same(a: unknown, b: unknown): boolean {
  const empty = (v: unknown) => v === null || v === undefined;
  if (empty(a) && empty(b)) return true;
  if (empty(a) || empty(b)) return false;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return a === b;
}

/** Only the keys of `after` whose value is not the same as in `before`.
 *  Example: before { stock: 5, name: "Tea" }, after { stock: null, name: "Tea" }
 *  -> { stock: null } ("not counted"). */
export function onlyChanged(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(after)) {
    if (v === undefined) continue;
    if (!same(before[k], v)) out[k] = v;
  }
  return out;
}

/** The stock box: empty = null ("not counted"), else a whole number.
 *  Returns a problem in words when it is neither. */
export function stockFromBox(text: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const t = String(text ?? "").trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, reason: "Stock must be a whole number, or empty for not counted" };
  return { ok: true, value: Number(t) };
}

/** Preparation time in minutes: empty = null (the shop's usual time), else
 *  0 to 1440 (one day) - the server's own limit. */
export function prepFromBox(text: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const t = String(text ?? "").trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d+$/.test(t) || Number(t) > 1440) {
    return { ok: false, reason: "Preparation time is whole minutes, from 0 to 1440" };
  }
  return { ok: true, value: Number(t) };
}

/** Is the photo list the same as what was loaded? Same pictures, same order. */
export function samePhotos(loaded: string[], now: string[]): boolean {
  const a = loaded.map((u) => u.trim()).filter(Boolean);
  const b = now.map((u) => u.trim()).filter(Boolean);
  return a.length === b.length && a.every((u, i) => u === b[i]);
}

// ── Key details (specs) ─────────────────────────────────────────────────────
// Stored by the server as JSON text: {"Brand": "Panadol", "Barcode": "123"}.

export const MAX_SPECS = 30;
const MAX_SPEC_KEY = 60;
const MAX_SPEC_VALUE = 500;

export interface SpecRow {
  key: string;
  value: string;
  /** The value exactly as it was read, so an untouched one goes back as it was. */
  orig?: unknown;
}

const shown = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** The details as rows. `editable` is false when the text is not a plain
 *  list of name -> value (bad JSON, a list, a value that is itself a list):
 *  then the editor only shows it and never sends it, so nothing is lost. */
export function specsFromText(raw: unknown): { rows: SpecRow[]; editable: boolean } {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return { rows: [], editable: true };
  }
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return { rows: [], editable: false }; }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { rows: [], editable: false };
  const rows: SpecRow[] = [];
  for (const [key, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== null && typeof v === "object") return { rows: [], editable: false };
    rows.push({ key, value: shown(v), orig: v });
  }
  return { rows, editable: true };
}

const usedSpecs = (rows: SpecRow[]) => rows.filter((r) => r.key.trim() !== "" || r.value.trim() !== "");

/** What still stops a save, in words - or null. */
export function specsProblem(rows: SpecRow[]): string | null {
  const used = usedSpecs(rows);
  if (used.length > MAX_SPECS) return `Up to ${MAX_SPECS} key details - remove ${used.length - MAX_SPECS}`;
  const seen = new Set<string>();
  for (const r of used) {
    const k = r.key.trim();
    if (!k) return "Type a name for every key detail (for example Brand)";
    if (k.length > MAX_SPEC_KEY) return `"${k.slice(0, 20)}…" is too long - a detail name is ${MAX_SPEC_KEY} letters at most`;
    if (r.value.trim().length > MAX_SPEC_VALUE) return `The value of ${k} is too long - ${MAX_SPEC_VALUE} letters at most`;
    if (seen.has(k)) return `Two key details are both called ${k}`;
    seen.add(k);
  }
  return null;
}

/** The text to send: JSON in the rows' order, or null when there are none
 *  (null clears the details on the server). An untouched value goes back
 *  exactly as it was read (a number stays a number). */
export function specsToText(rows: SpecRow[]): string | null {
  const used = usedSpecs(rows);
  if (used.length === 0) return null;
  const obj: Record<string, unknown> = {};
  for (const r of used) {
    obj[r.key.trim()] = r.orig !== undefined && r.value === shown(r.orig) ? r.orig : r.value.trim();
  }
  return JSON.stringify(obj);
}

/** Did the person change the details at all? (Same names, same values, same
 *  order, ignoring empty rows.) */
export function specsChanged(loaded: SpecRow[], now: SpecRow[]): boolean {
  const a = usedSpecs(loaded);
  const b = usedSpecs(now);
  if (a.length !== b.length) return true;
  return a.some((r, i) => r.key.trim() !== b[i].key.trim() || r.value !== b[i].value);
}

// ── Options (sizes, colours, extras) ────────────────────────────────────────

/** One option as the server keeps it (GET /menu/{id}/variants). */
export interface LoadedOption {
  id: string;
  variant_type: string;
  variant_value: string;
  sku?: string | null;
  stock_quantity?: number | null;
  price_override?: number | null;
  is_available?: boolean;
}

/** One option as the editor shows it. A box the editor does not show for
 *  this kind of option (a size has no stock box) is left `undefined` and is
 *  then never sent - the server leaves it alone. */
export interface OptionDraft {
  id?: string;
  variant_type: string;
  variant_value: string;
  stock?: string;
  price?: string;
  sku?: string;
  on: boolean;
}

/** What makes an option THE SAME option on the server: type and value,
 *  capitals and outer spaces ignored ("Size / M" = " size / m "). */
export const optionKey = (type: unknown, value: unknown) =>
  `${String(type ?? "").trim().toLowerCase()}\u0000${String(value ?? "").trim().toLowerCase()}`;

/** The general options grid's rows from the server's options. */
export function draftsFromOptions(rows: LoadedOption[]): OptionDraft[] {
  return (rows || []).map((v) => ({
    id: v.id ? String(v.id) : undefined,
    variant_type: String(v.variant_type ?? ""),
    variant_value: String(v.variant_value ?? ""),
    stock: v.stock_quantity != null ? String(v.stock_quantity) : "",
    price: v.price_override != null ? String(Number(v.price_override)) : "",
    sku: String(v.sku ?? ""),
    on: v.is_available !== false,
  }));
}

/** A restaurant's size rows as options. A size has no stock or code box, so
 *  those are left alone. An empty price = "uses the product price". */
export function sizeDrafts(rows: SizeRow[]): OptionDraft[] {
  return usedSizes(rows).map((r) => ({
    id: r.id, variant_type: "Size", variant_value: r.name, price: r.price, on: !r.off,
  }));
}

/** A restaurant's extra rows as options: what each one ADDS is its price. */
export function extraDrafts(rows: ExtraRow[]): OptionDraft[] {
  return usedExtras(rows).map((r) => ({
    id: r.id, variant_type: "Extra", variant_value: r.name, price: r.adds, on: !r.off,
  }));
}

const usedDrafts = (drafts: OptionDraft[]) =>
  drafts.filter((d) => d.variant_type.trim() !== "" || d.variant_value.trim() !== ""
    || (d.stock ?? "").trim() !== "" || (d.price ?? "").trim() !== "" || (d.sku ?? "").trim() !== "");

/** What still stops a save in the general grid, in words - or null. */
export function optionsProblem(drafts: OptionDraft[]): string | null {
  const seen = new Set<string>();
  for (const d of usedDrafts(drafts)) {
    const t = d.variant_type.trim();
    const v = d.variant_value.trim();
    if (!t || !v) return "Every option needs both a kind (Size) and a value (M)";
    const k = optionKey(t, v);
    if (seen.has(k)) return `Two options are both ${t} ${v}`;
    seen.add(k);
    const s = (d.stock ?? "").trim();
    if (s !== "" && !/^\d+$/.test(s)) return `Stock of ${t} ${v} must be a whole number, or empty for not counted`;
    const p = (d.price ?? "").trim();
    if (p !== "" && !(/^\d+(\.\d+)?$/.test(p))) return `Price of ${t} ${v} must be a number, or empty for the product price`;
    if ((d.sku ?? "").trim().length > 64) return `The code of ${t} ${v} is too long - 64 letters at most`;
  }
  return null;
}

export type OptionsBody = {
  variants: Record<string, unknown>[];
  remove_ids?: string[];
  drop_choices?: true;
};

/**
 * What PUT /menu/{id}/variants is sent - or `null` when nothing changed, and
 * then the call is skipped.
 *
 *   * Every option that is ON is sent (type and value, as the key) - the
 *     server takes an ON option left out as "removed".
 *   * Beside the key, only the boxes that changed. An emptied price box sends
 *     price_override null ("uses the product price"); an emptied stock box
 *     sends stock_quantity null ("not counted").
 *   * An option that is OFF and untouched is not sent at all (the server keeps
 *     it as it is). One that is OFF and changed carries is_available false, so
 *     an older server that switches a sent option on cannot do that.
 *   * An option the person deleted - on or off - goes in remove_ids.
 *   * `dropChoices` (a restaurant dish set to One price): drop_choices true,
 *     which removes every choice; extras stay.
 *   * `fixedPrice`: the option's own price is locked in the editor, and the
 *     loaded price is sent back unchanged with every existing option, because
 *     a fixed-price store's server reads a missing price as a price change.
 *
 * Example: loaded M (stock 5, own price 900); the person empties both boxes
 * -> { variants: [{ variant_type: "Size", variant_value: "M",
 *      stock_quantity: null, price_override: null }] }.
 */
export function optionChanges(
  loaded: LoadedOption[],
  drafts: OptionDraft[],
  opts: { fixedPrice?: boolean; dropChoices?: boolean } = {},
): OptionsBody | null {
  const byId = new Map<string, LoadedOption>();
  const byKey = new Map<string, LoadedOption>();
  for (const o of loaded || []) {
    if (o.id) byId.set(String(o.id), o);
    const k = optionKey(o.variant_type, o.variant_value);
    if (!byKey.has(k)) byKey.set(k, o);
  }
  const claimed = new Set<string>();
  const variants: Record<string, unknown>[] = [];
  const remove = new Set<string>();
  let changed = false;

  const stockOf = (s: string) => (s.trim() === "" ? null : Number(s.trim()));
  const priceOf = (s: string) => (s.trim() === "" ? null : Number(s.trim()));

  for (const d of usedDrafts(drafts)) {
    const type = d.variant_type.trim();
    const value = d.variant_value.trim();
    if (!type || !value) continue;
    const key = optionKey(type, value);
    let match = d.id ? byId.get(d.id) : undefined;
    if (!match) {
      const k = byKey.get(key);
      if (k && !claimed.has(String(k.id))) match = k;
    }
    if (match && optionKey(match.variant_type, match.variant_value) !== key) {
      // Renamed: the server knows an option by its name, so the new name is
      // a NEW option and the old one is taken off.
      remove.add(String(match.id));
      claimed.add(String(match.id));
      match = undefined;
      // ...unless the new name is one the product already has: that one is
      // then the option being changed.
      const k = byKey.get(key);
      if (k && !claimed.has(String(k.id))) { match = k; remove.delete(String(k.id)); }
    }
    const entry: Record<string, unknown> = { variant_type: type, variant_value: value };
    if (!match) {
      if (d.stock !== undefined && d.stock.trim() !== "") entry.stock_quantity = stockOf(d.stock);
      if (d.price !== undefined && d.price.trim() !== "" && !opts.fixedPrice) entry.price_override = priceOf(d.price);
      if (d.sku !== undefined && d.sku.trim() !== "") entry.sku = d.sku.trim();
      if (!d.on) entry.is_available = false;
      variants.push(entry);
      changed = true;
      continue;
    }
    claimed.add(String(match.id));
    let touched = false;
    if (d.stock !== undefined) {
      const now = stockOf(d.stock);
      if (!same(match.stock_quantity ?? null, now)) { entry.stock_quantity = now; touched = true; }
    }
    if (opts.fixedPrice) {
      entry.price_override = match.price_override ?? null;
    } else if (d.price !== undefined) {
      const now = priceOf(d.price);
      if (!same(match.price_override ?? null, now)) { entry.price_override = now; touched = true; }
    }
    if (d.sku !== undefined && d.sku.trim() !== String(match.sku ?? "").trim()) {
      entry.sku = d.sku.trim();
      touched = true;
    }
    const wasOn = match.is_available !== false;
    if (wasOn !== d.on) { entry.is_available = d.on; touched = true; }
    else if (!d.on && touched) entry.is_available = false;
    if (touched) changed = true;
    // Off and untouched: not sent - the server keeps it exactly as it is.
    if (d.on || touched) variants.push(entry);
  }

  let drop = false;
  for (const o of loaded || []) {
    const id = String(o.id || "");
    if (!id || claimed.has(id)) continue;
    // One price: drop_choices removes every choice, so only extras are named.
    if (opts.dropChoices && !isExtra(o)) { drop = true; continue; }
    remove.add(id);
  }
  if (remove.size) changed = true;
  if (drop) changed = true;
  if (!changed) return null;
  const body: OptionsBody = { variants };
  if (remove.size) body.remove_ids = Array.from(remove);
  if (drop) body.drop_choices = true;
  return body;
}

/** What the product's options are after a save went through, so a second
 *  press of Save compares with THAT and does not send the same change again.
 *  `saved` = the rows the server answered with (each with its id). Kept:
 *  every option that was not sent, not removed and not dropped (a switched-off
 *  one left alone). Null when the server's answer has no rows - then read again. */
export function optionsAfterSave(loaded: LoadedOption[], body: OptionsBody, saved: unknown): LoadedOption[] | null {
  if (!Array.isArray(saved)) return null;
  const sent = new Set(body.variants.map((v) => optionKey(v.variant_type, v.variant_value)));
  const removed = new Set(body.remove_ids || []);
  const kept = (loaded || []).filter((o) =>
    !removed.has(String(o.id)) && !sent.has(optionKey(o.variant_type, o.variant_value))
    && !(body.drop_choices && !isExtra(o)));
  return [...kept, ...(saved as LoadedOption[]).filter((o) => o && o.id)];
}

// ── What the server answered when a NEW product was refused ─────────────────

/** A fixed-price store's "sells below its buying price" (409 with losses).
 *  Example: { name: "Panadol", loss_each: 20 } -> 20. Null = not that. */
export function lossOf(err: unknown): { name: string; lossEach: number } | null {
  const e = err as { status?: number; detail?: { losses?: { name?: string; loss_each?: number }[] } };
  if (e?.status !== 409 || !Array.isArray(e?.detail?.losses) || e.detail!.losses!.length === 0) return null;
  const l = e.detail!.losses![0];
  return { name: String(l?.name ?? ""), lossEach: Math.round(Number(l?.loss_each) || 0) };
}

/** "This shop already has ..." (409, a name the shop already has). */
export function isSameName(err: unknown): boolean {
  const e = err as { status?: number; detail?: unknown };
  return e?.status === 409 && !lossOf(err);
}

/** The id the server named in X-Existing-Product-Id, if it could be read. */
export function existingIdOf(err: unknown): string | null {
  const id = (err as { existingProductId?: unknown })?.existingProductId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** A write whose answer never came back: it may or may not have happened.
 *  (The panel's own words - lib/api-core.ts - and no status.) */
export function answerWasLost(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return !e?.status && /may or may not have gone through/i.test(String(e?.message ?? ""));
}

/** The database's way of comparing two names (migration 133): a no-break space
 *  is a space, runs of space are one, ends trimmed, capitals do not count. */
export function sameCatalogueName(a: unknown, b: unknown): boolean {
  const key = (s: unknown) => String(s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return key(a) !== "" && key(a) === key(b);
}

// ── The kind of shop ────────────────────────────────────────────────────────

/** Shops that cook - they have a preparation time. */
export const cooksFood = (vendorType: string) => vendorType === "restaurant" || vendorType === "bakery";

/** Shops whose products may carry a size guide. */
export const wearsSizes = (vendorType: string) => vendorType === "clothing_store" || vendorType === "jewelry_accessories";
