/**
 * STORES › PRODUCT SORTING › SORTING LIST - the screen's own rules, with no
 * screen attached. (Mock 210-5, approved by Sana 27 October 2026.)
 *
 * A line says: a product whose name starts with "TRIKAT" (or has the word
 * "FEEDER" anywhere) belongs on THIS shelf, with or without a prescription.
 * The server keeps the list (migration 150, sorting_words.py) and does every
 * move. This file only reads a pharmacist's sheet into rows, turns the
 * person's choices back into lines, and writes the "not yet sorted" sheet.
 *
 * Nothing here guesses a shelf: a row the server could not place waits for a
 * person to choose one.
 *
 * Checked in tests/mock-210-sorting-list.test.ts.
 */
import type { Sheet } from "./sheet-reader";

export type Match = "starts" | "word";

export const MATCH_CHOICES: { key: Match; label: string; hint: string }[] = [
  { key: "starts", label: "Name starts with", hint: "for medicine brands - TRIKAT TAB, TRIKAT MR … all match" },
  { key: "word", label: "Word anywhere", hint: "for kinds of things - any name with FEEDER in it" },
];

export const matchLabel = (m: string) => MATCH_CHOICES.find((c) => c.key === m)?.label || m;

/** The same cleaning the server does (shelf_memory.key), near enough for the
 *  screen: lower case, letters/numbers/% kept, everything else a space. */
export function cleanWord(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A line's word is fine to save: 2 to 80 letters, once cleaned. */
export function wordProblem(word: string): string {
  const w = cleanWord(word);
  if (w.length < 2) return "Type at least 2 letters.";
  if (w.length > 80) return "At most 80 letters.";
  return "";
}

// ── "Also remember" in Find & move (Mock 210-4) ─────────────────────────────

/** Does this name start with the word, as a whole word? ("trikat" starts
 *  "TRIKAT MR TAB" but not "TRIKATONE".) */
export function startsWithWord(name: string, word: string): boolean {
  const n = cleanWord(name);
  const w = cleanWord(word);
  return !!w && (n === w || n.startsWith(`${w} `));
}

/**
 * The word Find & move offers to remember, or "" when it should not offer.
 * Offered only when the search is a real name (3+ letters with a letter in
 * it) AND every ticked product's name starts with it - so the line is exactly
 * what the person just did, never a broader rule than they meant.
 */
export function wordToRemember(search: string, tickedNames: string[]): string {
  const w = cleanWord(search);
  if (w.replace(/\s/g, "").length < 3 || !/\p{L}/u.test(w) || w.length > 80) return "";
  if (!tickedNames.length || !tickedNames.every((n) => startsWithWord(n, w))) return "";
  return w;
}

/** The line's prescription mark from the move's choice: Yes / No as said;
 *  "Keep as it is" -> yes if ANY ticked product has it (the safe side). */
export function rxForLine(choice: "keep" | "yes" | "no", tickedRx: boolean[]): boolean {
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return tickedRx.some(Boolean);
}

// ── reading the pharmacist's sheet ──────────────────────────────────────────

export interface SheetRowIn { name: string; shelf: string; rx: string }

export interface SheetColumns { name: number; shelf: number; what: number; rx: number }

const NAME_W = /(product|item|medicine|brand|name)/i;
const SHELF_W = /(shelf|category|department)/i;
const WHAT_W = /(what it is|used for|\buse\b|\btype\b|\bkind\b|\bfor\b)/i;
const RX_W = /(prescription|presc|\brx\b)/i;

/**
 * Which column is which. Our own "not yet sorted" sheet says
 *   product name · what it is · shelf · needs prescription yes/no
 * and a pharmacist's own sheet says whatever it says - so the headings are
 * read loosely; with no heading that fits, the order name, shelf, rx is used.
 */
export function guessSheetColumns(columns: string[]): SheetColumns {
  const find = (re: RegExp, not: number[] = []) =>
    columns.findIndex((c, i) => !not.includes(i) && re.test(String(c || "")));
  let rx = find(RX_W);
  let shelf = find(SHELF_W, [rx]);
  let name = find(NAME_W, [rx, shelf]);
  let what = find(WHAT_W, [rx, shelf, name]);
  if (name < 0) name = 0;
  if (shelf < 0 && what < 0) shelf = columns.length > 1 ? (name === 1 ? 0 : 1) : -1;
  if (rx < 0 && columns.length > 2) {
    const spare = [0, 1, 2].find((i) => ![name, shelf, what].includes(i));
    rx = spare === undefined ? -1 : spare;
  }
  if (what === name || what === shelf) what = -1;
  return { name, shelf, what, rx };
}

/** The sheet as rows for the server's check. The shelf is the "shelf" column,
 *  or - when the pharmacist left that empty - the "what it is" column. Rows
 *  with neither a name nor an answer are left out entirely. */
export function sheetRows(sheet: Sheet, cols: SheetColumns = guessSheetColumns(sheet.columns)): SheetRowIn[] {
  const at = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  return sheet.rows
    .map((r) => ({ name: at(r, cols.name), shelf: at(r, cols.shelf) || at(r, cols.what), rx: at(r, cols.rx) }))
    .filter((r) => r.name || r.shelf || r.rx);
}

// ── the check, and the person's choices, back into lines ────────────────────

export type RowState = "understood" | "not_found" | "empty" | "two_answers";

export interface CheckedRow {
  row: number; name: string; said: string; word: string;
  category_id: string | null; shelf: string | null; where: string;
  rx: boolean | null; state: RowState;
}

export interface LineOut { word: string; match: Match; category_id: string; rx: boolean | null }

/** A row the person must answer before it can be added. */
export const waitsForAPerson = (r: CheckedRow) =>
  !!r.word && (r.state === "not_found" || r.state === "two_answers");

/**
 * The lines to add. One line per brand word:
 *  * a shelf the person CHOSE for that word always wins;
 *  * otherwise the server's understood answer;
 *  * a word with two different answers, or with any row the server could
 *    not place, waits for a person (left out until one is chosen);
 *  * an empty row is left out.
 * The mark: yes if any of the word's rows said yes, no if one said no and none
 * yes, otherwise "not said" (the server then uses the shelf's safe default).
 */
export function linesToAdd(rows: CheckedRow[], chosen: Record<string, string>): LineOut[] {
  const byWord = new Map<string, CheckedRow[]>();
  for (const r of rows) {
    if (!r.word) continue;
    const list = byWord.get(r.word) || [];
    list.push(r);
    byWord.set(r.word, list);
  }
  const out: LineOut[] = [];
  byWord.forEach((list, word) => {
    const picked = chosen[word];
    let cid = picked || "";
    if (!cid) {
      // Any row of this word the server could not read, or two rows that
      // disagree: the word waits for a person - never half an answer.
      if (list.some(waitsForAPerson)) return;
      cid = list.find((r) => r.state === "understood" && r.category_id)?.category_id || "";
    }
    if (!cid) return;
    const said = list.map((r) => r.rx);
    const rx = said.includes(true) ? true : said.includes(false) ? false : null;
    out.push({ word, match: "starts", category_id: cid, rx });
  });
  return out;
}

/** The four numbers above the check table. */
export function checkCounts(rows: CheckedRow[], chosen: Record<string, string>) {
  const lines = linesToAdd(rows, chosen);
  const waiting = new Set(rows.filter((r) => waitsForAPerson(r) && !chosen[r.word]).map((r) => r.word));
  return {
    lines: lines.length,
    waiting: waiting.size,
    empty: rows.filter((r) => r.state === "empty").length,
  };
}

// ── "Download the not yet sorted" ───────────────────────────────────────────

const cell = (v: string | number) => {
  const s = String(v ?? "");
  // A leading = + - @ would run as a formula in Excel: written as text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const PHARMACIST_HEADINGS = [
  "product name", "what it is (pharmacist fills in)", "shelf (pharmacist fills in)",
  "needs prescription yes/no", "how many in Takal", "pile now",
];

/** The sheet the pharmacist fills in - the same headings the upload reads. */
export function pileNamesCsv(names: { name: string; count: number; pile?: string | null }[]): string {
  const lines = [PHARMACIST_HEADINGS.map(cell).join(",")];
  for (const n of names) lines.push([n.name, "", "", "", n.count, n.pile || ""].map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** The Yes/No a new line starts on: the shelf's own mark, or Yes on any
 *  Medicines shelf (the safe default, D2). The person can always change it -
 *  except on a shelf that itself needs a prescription. */
export function startingRx(shelf: { rx?: boolean; label?: string } | null | undefined): boolean {
  if (!shelf) return false;
  return !!shelf.rx || /(^| › )Medicines( › |$)/.test(shelf.label || "");
}
