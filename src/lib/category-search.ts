/**
 * FINDING A CATEGORY BY TYPING.  (Mock 134, approved 1 October 2026 - audit SM14.)
 *
 * A grocery Mall can have hundreds of categories, and the old box was one long
 * list ("Men > T-shirts", ...). Now the person types a word or two and sees
 * only what matches.
 *
 * The rule: EVERY word typed must appear somewhere in the category's full
 * path, in any order, any case. "wash powder" finds "Cleaning › Washing
 * powder"; "clean wash" finds it too. The order of the list is kept, so
 * "Cleaning" things stay together.
 */
export type CategoryOption = { id: string; label: string };

/** The words a person typed, cleaned: lower case, no empty bits. */
export function wordsOf(query: string): string[] {
  return (query || "").toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

/** Every option whose label holds EVERY typed word. Nothing typed = all. */
export function filterCategories(options: CategoryOption[], query: string): CategoryOption[] {
  const words = wordsOf(query);
  if (!words.length) return options;
  return options.filter((o) => {
    const l = o.label.toLowerCase();
    return words.every((w) => l.includes(w));
  });
}

/** The label cut into pieces, with the typed words marked - so the list can
 *  show WHY each line matched. Overlapping words are merged. */
export function highlightParts(label: string, query: string): { text: string; hit: boolean }[] {
  const words = wordsOf(query);
  if (!words.length || !label) return [{ text: label, hit: false }];
  const lower = label.toLowerCase();
  const hit = new Array(label.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(w, from);
      if (i < 0) break;
      for (let k = i; k < i + w.length; k++) hit[k] = true;
      from = i + 1;
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < label.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === hit[i]) last.text += label[i];
    else out.push({ text: label[i], hit: hit[i] });
  }
  return out;
}

/** "Men > T-shirts" as people read it: "Men › T-shirts". */
export const pathLabel = (parts: string[]) => parts.filter(Boolean).join(" › ");
