// Turn an array of objects into a CSV file and trigger a download.

export function downloadCsv(filename: string, rows: any[], columns?: { key: string; label: string }[]) {
  if (typeof document === "undefined") return;
  if (!rows || rows.length === 0) {
    alert("Nothing to export.");
    return;
  }
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  // A-4: neutralise spreadsheet formula injection. A cell whose value begins
  // with = + - @ (or a tab/CR) can be executed as a formula when the exported
  // file is opened in Excel or Google Sheets — a real risk here because exports
  // include user-supplied fields like customer names and addresses. We prefix
  // such values with a single quote so the cell is treated as plain text.
  // Legitimate plain numbers (e.g. "-50" refunds) are left untouched so the
  // sheet still sums them correctly.
  const esc = (v: any) => {
    let s = String(v ?? "");
    const looksDangerous = /^[=+\-@\t\r]/.test(s);
    const isPlainNumber = s !== "" && !Number.isNaN(Number(s));
    if (looksDangerous && !isPlainNumber) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = cols.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(",")).join("\n");
  const csv = header + "\n" + body;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
