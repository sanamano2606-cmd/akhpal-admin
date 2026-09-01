// Turn an array of objects into a CSV file and trigger a download.
//
// This file deliberately imports NOTHING. It is pure enough to be tested
// without a browser (see tests/csv.test.ts), and a formatting helper has no
// business deciding what message the operator sees - that is the page's job.
//
// EVERY export in this panel must come through here. There used to be a second,
// private copy of this logic on the Reports page, and the copy left out the
// formula guard below - so the one export that carried the most user-typed text
// (the audit log) was the one export with no protection.

/**
 * Escape a single cell.
 *
 * A-4: neutralise spreadsheet formula injection. A cell whose value begins
 * with = + - @ (or a tab/CR) can be executed as a formula when the exported
 * file is opened in Excel or Google Sheets - a real risk here because exports
 * include user-supplied fields like customer names and addresses. We prefix
 * such values with a single quote so the cell is treated as plain text.
 * Legitimate plain numbers (e.g. "-50" refunds) are left untouched so the
 * sheet still sums them correctly.
 *
 * Exported so it can be tested directly - see tests/csv.test.ts.
 */
export function csvCell(v: any): string {
  let s = String(v ?? "");
  const looksDangerous = /^[=+\-@\t\r]/.test(s);
  const isPlainNumber = s !== "" && !Number.isNaN(Number(s));
  if (looksDangerous && !isPlainNumber) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export type CsvColumn = { key: string; label: string };

/** Build the CSV text. Pure - no browser needed, so it is testable. */
export function buildCsv(rows: any[], columns?: CsvColumn[]): string {
  if (!rows || rows.length === 0) return "";
  const cols: CsvColumn[] =
    columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const header = cols.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((r) => cols.map((c) => csvCell(r[c.key])).join(","))
    .join("\n");
  return header + "\n" + body;
}

/** Save any text as a file. One place, so every download behaves the same. */
export function downloadText(filename: string, content: string, mime: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save data as a .json file. */
export function downloadJson(filename: string, data: any) {
  downloadText(filename, JSON.stringify(data ?? {}, null, 2), "application/json");
}

/** Save rows as a .csv file.
 *
 *  Returns FALSE when there was nothing to export. It used to raise a browser
 *  alert() instead - a grey system box that looks nothing like the rest of the
 *  panel and freezes the page until it is dismissed. Now the page shows its own
 *  toast, in its own words, like every other message in the panel. */
export function downloadCsv(
  filename: string,
  rows: any[],
  columns?: CsvColumn[]
): boolean {
  if (typeof document === "undefined") return false;
  const csv = buildCsv(rows, columns);
  if (!csv) return false;
  downloadText(filename, csv, "text/csv;charset=utf-8;");
  return true;
}
