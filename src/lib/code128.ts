// ─────────────────────────────────────────────────────────────────────────────
// CODE 128 — the barcode on the parcel label.
//
// WHY THIS IS WRITTEN OUT HERE AND NOT INSTALLED FROM npm.
//
// CLAUDE.md §4: adding a package to akhpal-admin/package.json is not enough.
// Vercel installs it, Sana's own node_modules does not get it, and the type
// check in DEPLOY.ps1 then STOPS her deploy with "Cannot find module ...".
// That already happened once, on 16 September 2026, with `firebase`.
//
// A Code 128 encoder is a lookup table and one checksum. It is smaller than
// the problem installing one would cause, it can never go out of date, and it
// has no licence, no supply chain and no update to chase.
//
// WHAT IT PRODUCES: a run-length list of bar widths, starting with a BAR.
// [2,1,2,2,2,2, ...] means 2 modules of bar, 1 of space, 2 of bar, and so on.
// The label draws those as plain <rect>s, so there is no image to load and
// nothing to go missing when the printer asks for the page.
//
// Checked against the reference implementation in Python's `python-barcode`
// for the whole printable alphabet - see tests/parcel-label.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** The 106 Code 128 symbols, then the stop pattern. 1 = bar, 0 = space. */
const SYMBOLS = "11011001100|11001101100|11001100110|10010011000|10010001100|10001001100|10011001000|10011000100|10001100100|11001001000|11001000100|11000100100|10110011100|10011011100|10011001110|10111001100|10011101100|10011100110|11001110010|11001011100|11001001110|11011100100|11001110100|11101101110|11101001100|11100101100|11100100110|11101100100|11100110100|11100110010|11011011000|11011000110|11000110110|10100011000|10001011000|10001000110|10110001000|10001101000|10001100010|11010001000|11000101000|11000100010|10110111000|10110001110|10001101110|10111011000|10111000110|10001110110|11101110110|11010001110|11000101110|11011101000|11011100010|11011101110|11101011000|11101000110|11100010110|11101101000|11101100010|11100011010|11101111010|11001000010|11110001010|10100110000|10100001100|10010110000|10010000110|10000101100|10000100110|10110010000|10110000100|10011010000|10011000010|10000110100|10000110010|11000010010|11001010000|11110111010|11000010100|10001111010|10100111100|10010111100|10010011110|10111100100|10011110100|10011110010|11110100100|11110010100|11110010010|11011011110|11011110110|11110110110|10101111000|10100011110|10001011110|10111101000|10111100010|11110101000|11110100010|10111011110|10111101110|11101011110|11110101110|11010000100|11010010000|11010011100".split("|");
const STOP = "11000111010";

/** Code 128 SET B covers every printable character from space to ~. */
const START_B = 104;

/**
 * Turn text into bar widths. Returns null when the text cannot be encoded,
 * so the label can simply leave the barcode out rather than crash - the order
 * number is printed underneath in words either way.
 */
export function code128Bars(text: string): number[] | null {
  const data = (text || "").trim();
  if (!data) return null;

  const values: number[] = [START_B];
  for (const ch of data) {
    const v = ch.charCodeAt(0) - 32;
    // SET B only. A tab, a newline or anything non-Latin cannot go in a
    // Code 128 B barcode, and guessing at it would print a barcode that
    // scans as something else.
    if (v < 0 || v > 94) return null;
    values.push(v);
  }

  // The check character: the start value, plus each data value times its
  // position, all modulo 103.
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += i * values[i];
  values.push(sum % 103);

  const bits = values.map((v) => SYMBOLS[v]).join("") + STOP;

  // Run lengths. Code 128 always starts with a bar, so the first run is a bar
  // and they alternate from there.
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === bits[i - 1]) run++;
    else { runs.push(run); run = 1; }
  }
  runs.push(run);
  return runs;
}

/** The same thing as the raw 1/0 string, which is what the test compares. */
export function code128Bits(text: string): string | null {
  const runs = code128Bars(text);
  if (!runs) return null;
  let out = "";
  let bar = true;
  for (const r of runs) { out += (bar ? "1" : "0").repeat(r); bar = !bar; }
  return out;
}
