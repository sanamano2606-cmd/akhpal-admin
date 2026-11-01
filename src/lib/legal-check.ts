// ─────────────────────────────────────────────────────────────────────────────
// MOCK 224 - THE LEGAL CHECK (approved by Sana, 1 Nov 2026).
//
// Sana: "Flag Any products that can be caused Legal Actions" -> "when a store
// get ready and when new products added" -> "Once the Product Hide by admin or
// Assistant so the Vendor could not be Open it again through app" ->
// "editable list Change and add another name" -> "Approved".
//
// The words the Takal Assistant hides AND locks products for (server:
// backend/legal_check.py, migration 155). This file is the page's arithmetic
// only - adding and removing a word, telling a changed list from the saved
// one, the reasons an admin picks for "Hide and lock". Nothing here talks to
// the server. Tests: tests/mock-224-legal-check.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface LegalGroup {
  key: string;
  icon: string;
  name: string;
  /** The Roman Urdu sentence the vendor is told. */
  why: string;
  words: string[];
  on: boolean;
  /** Shop types this group never checks - "pharmacy" for adult products. */
  skip_types: string[];
  /** "medicine": no words, Takal's own medicine check decides. */
  auto?: "medicine";
}

export interface LegalHit {
  id: string; name: string; shop: string; restaurant_id: string;
  group: string; icon: string; group_name: string; word: string;
  is_available: boolean; hidden_by_takal: boolean;
}

export interface LegalPreview {
  checked: number;
  would_hide: LegalHit[];
  already_off: LegalHit[];
  already_locked: number;
  skipped_safe: { name: string; safe: string }[];
  skipped_safe_count: number;
  per_group: Record<string, number>;
  per_word: Record<string, Record<string, number>>;
}

export interface LegalLists {
  switched_on: boolean;
  groups: LegalGroup[];
  safe_phrases: string[];
  changed_at?: string;
  swept_at?: string | null;
  waiting_for_the_assistant?: boolean;
  today?: LegalPreview | null;
  is_main_admin?: boolean;
}

/** The server's own rule for a word: letters and digits, any case, the
 *  marks between them do not count ("E-Cig" = "e cig"). */
export function normWord(w: string): string {
  return String(w || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export const MAX_WORD_CHARS = 40;

/** Adds a word unless it is empty, too long or already there (any case).
 *  Returns the same list when nothing changes. */
export function addWord(words: string[], typed: string): string[] {
  const w = String(typed || "").replace(/\s+/g, " ").trim();
  if (!w || !normWord(w) || w.length > MAX_WORD_CHARS) return words;
  if (words.some((x) => normWord(x) === normWord(w))) return words;
  return [...words, w];
}

export const removeWord = (words: string[], w: string) => words.filter((x) => x !== w);

/** Why a word cannot be added, in words the Main Admin can act on - or "". */
export function wordProblem(words: string[], typed: string): string {
  const w = String(typed || "").replace(/\s+/g, " ").trim();
  if (!w) return "";
  if (!normWord(w)) return "A word needs letters or numbers.";
  if (w.length > MAX_WORD_CHARS) return `At most ${MAX_WORD_CHARS} letters.`;
  if (words.some((x) => normWord(x) === normWord(w))) return `"${w}" is already in the list.`;
  return "";
}

/** Has anything changed since the lists were read? (Save changes lights up.) */
export function listsChanged(a: { groups: LegalGroup[]; safe_phrases: string[] },
                             b: { groups: LegalGroup[]; safe_phrases: string[] }): boolean {
  return JSON.stringify([a.groups, a.safe_phrases]) !== JSON.stringify([b.groups, b.safe_phrases]);
}

/** "catches 2 today" - from the preview of the lists on screen. */
export function catches(p: LegalPreview | null | undefined, key: string): number {
  return Number(p?.per_group?.[key] || 0);
}

/** "·1" beside a word that catches something. */
export function wordCatches(p: LegalPreview | null | undefined, key: string, word: string): number {
  return Number(p?.per_word?.[key]?.[word] || 0);
}

/** A new, empty group - switched OFF until it has a word, so saving never
 *  stops on a half-made group. */
export function newGroup(existing: LegalGroup[]): LegalGroup {
  let n = existing.length + 1;
  const keys = new Set(existing.map((g) => g.key));
  while (keys.has(`group_${n}`)) n += 1;
  return { key: `group_${n}`, icon: "⚖️", name: "New group", why: "Takal ke qanooni usool ke khilaf",
    words: [], on: false, skip_types: [] };
}

// ── Hide and lock (a person, on a store's Products tab) ─────────────────────
/** The reasons on the dialog, each with the Roman Urdu sentence it starts. */
export const HIDE_REASONS: { key: string; label: string; words: string }[] = [
  { key: "legal", label: "⚖️ Qanooni masla (legal)", words: "Qanooni masla - yeh cheez Takal par nahi bik sakti." },
  { key: "replica", label: "Replica brand", words: "Kisi brand ki naqal (replica) - brand qanooni karwai kar sakta hai." },
  { key: "picture", label: "Galat tasveer", words: "Tasveer is product ki nahi hai ya kisi aur website se li gayi hai." },
  { key: "price", label: "Galat qeemat", words: "Qeemat galat likhi hai." },
  { key: "other", label: "Other…", words: "" },
];

export const HIDE_REASON_MIN = 3;
export const HIDE_REASON_MAX = 300;

/** The reason as it will be sent, or "" when it cannot be sent yet. */
export function hideReasonToSend(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length >= HIDE_REASON_MIN && t.length <= HIDE_REASON_MAX ? t : "";
}
