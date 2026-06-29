// Turn an array of objects into a CSV file and trigger a download.

export function downloadCsv(filename: string, rows: any[], columns?: { key: string; label: string }[]) {
  if (typeof document === "undefined") return;
  if (!rows || rows.length === 0) {
    alert("Nothing to export.");
    return;
  }
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
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
