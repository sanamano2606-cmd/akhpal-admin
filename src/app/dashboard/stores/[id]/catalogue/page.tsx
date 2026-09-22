"use client";

/**
 * ADDING A WHOLE CATALOGUE.  (Mock 107 v2, approved by Sana 22 Sep 2026.)
 *
 * WHY VERSION ONE WAS REPLACED
 * It took a .csv only, demanded Takal's own column names, and reported the
 * mistakes AFTER everything had been written to the shop. Every part of that
 * is wrong for the job Ilyas does: a shopkeeper hands over an Excel file, or a
 * price list pasted into WhatsApp, with columns called "Item" and "Rate".
 *
 * THREE STEPS
 *   1. Choose the list  - a file, a paste, or a blank sheet to send him.
 *   2. Match the columns - his words to ours, once, by dropdown.
 *   3. Check and upload  - every row with what will happen to it, BEFORE
 *      anything is saved. Then one hour to take it all back.
 *
 * The rules all live in @/lib/sheet-reader, away from this screen, so they can
 * be checked on their own - and are, in tests/add-a-whole-catalogue.test.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, FileSpreadsheet, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  Badge, Button, Card, CardBody, CardHeader, LoadingState,
} from "@/components/ui";
import {
  DETAIL, IGNORE, OUR_FIELDS,
  checkRows, guessMapping, parseCsv, parsePasted, toServerCsv, whyNotImport,
  type RowVerdict, type Sheet,
} from "@/lib/sheet-reader";

const EMPTY: Sheet = { columns: [], rows: [] };

/** The blank sheet the office sends a shopkeeper on WhatsApp. Our own column
 *  names, so it needs no matching at all when it comes back. */
function blankSheetCsv(): string {
  const head = OUR_FIELDS.map((f) => f.key).join(",");
  return [
    head,
    "Chapli Kabab (1 kg),1600,Food,Fresh Swat style,0,0,",
    "Chicken Karahi,1450,Food,,20,0,",
    ",,,,,,",
  ].join("\n");
}

export default function CataloguePage({ params }: { params: { id: string } }) {
  const shopId = params.id;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sheet, setSheet] = useState<Sheet>(EMPTY);
  const [source, setSource] = useState("");
  const [mapping, setMapping] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  const [existing, setExisting] = useState<string[]>([]);
  const [namesReady, setNamesReady] = useState(false);

  const [result, setResult] = useState<
    { created: number; ids: string[]; failed: { row: number; error: string }[] } | null
  >(null);
  const [undone, setUndone] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  // What the shop already sells. Read once, when the page opens, so the
  // preview in step 3 can be honest about which rows are already there.
  const loadNames = useCallback(async () => {
    try {
      const out: any = await apiClient.getShopProductNames(shopId);
      setExisting(Array.isArray(out?.names) ? out.names : []);
    } catch {
      // The preview is then less complete, and says so. It is NOT a reason to
      // stop: the server refuses duplicates itself, whatever the browser knew.
      setExisting([]);
    } finally {
      setNamesReady(true);
    }
  }, [shopId]);

  useEffect(() => { loadNames(); }, [loadNames]);

  const take = (s: Sheet, what: string) => {
    if (s.columns.length === 0 || s.rows.length === 0) {
      toast("There are no rows in that — is the first row the column names?",
            "error");
      return;
    }
    setSheet(s);
    setSource(what);
    setMapping(guessMapping(s.columns));
    setResult(null);
    setUndone(false);
    setStep(2);
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    setBusy(true);
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
        const out = await apiClient.readSheetFile(file);
        if (out.truncated) {
          toast(`Only the first ${out.max_rows} rows were read.`, "info");
        }
        take({ columns: out.columns, rows: out.rows },
             `${file.name} · ${out.total} rows`);
      } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const text = await file.text();
        const s = parseCsv(text);
        take(s, `${file.name} · ${s.rows.length} rows`);
      } else {
        toast("Choose an Excel (.xlsx) or a .csv file.", "error");
      }
    } catch (e: any) {
      toast(e?.message || "That sheet could not be read.", "error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const verdicts: RowVerdict[] = useMemo(
    () => (step === 3 ? checkRows(sheet, mapping, existing) : []),
    [step, sheet, mapping, existing],
  );

  const counts = useMemo(() => {
    const c = { good: 0, warn: 0, busy: 0 };
    for (const v of verdicts) c[v.tone]++;
    return c;
  }, [verdicts]);

  const stop = whyNotImport(mapping);

  const upload = async () => {
    setBusy(true);
    try {
      const out = await apiClient.bulkImportProducts(
        shopId, toServerCsv(sheet, mapping));
      setResult({
        created: out.created,
        ids: out.created_ids || [],
        failed: out.failed || [],
      });
      toast(`${out.created} product${out.created === 1 ? "" : "s"} added`,
            "success");
      await loadNames();
    } catch (e: any) {
      toast(e?.message || "Nothing was saved. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!result?.ids.length) return;
    setBusy(true);
    try {
      const out: any = await apiClient.undoCatalogueUpload(shopId, result.ids);
      toast(out?.message || "Taken back.", "success");
      if (Array.isArray(out?.kept) && out.kept.length) {
        toast(`Kept: ${out.kept.join("; ")}`, "info");
      }
      setUndone(true);
      await loadNames();
    } catch (e: any) {
      toast(e?.message || "Could not take it back.", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadBlank = () => {
    const blob = new Blob([blankSheetCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "takal-products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/stores/${shopId}`}
              className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
          <ArrowLeft className="w-4 h-4" /> Back to the shop
        </Link>
        <h1 className="text-2xl font-bold text-takal-ink mt-2">Add a whole catalogue</h1>
        <p className="text-sm text-takal-ink-soft mt-1">
          Use whichever list the shopkeeper already has. Nothing is saved until
          you have seen what will happen to every row.
        </p>
      </div>

      {/* the three steps */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {["Choose the list", "Match the columns", "Check and upload"].map((t, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const on = step >= n;
          return (
            <span key={t} className="inline-flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold
                ${on ? "bg-takal-yellow text-takal-ink" : "bg-takal-disabled-bg text-takal-disabled-text"}`}>
                {n}
              </span>
              <span className={step === n ? "font-bold text-takal-ink" : "text-takal-ink-soft"}>
                {t}
              </span>
            </span>
          );
        })}
      </div>

      {/* ── STEP 1 ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader title="1. Choose the list"
                      hint="Three ways in. Use whichever the shopkeeper already has." />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Upload a file</p>
                <p className="text-sm text-takal-ink-soft mb-4">
                  Excel (.xlsx) or .csv. The first row must be the column names.
                </p>
                <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.csv,.txt"
                       className="hidden"
                       onChange={(e) => onFile(e.target.files?.[0])} />
                <Button variant="secondary" loading={busy}
                        onClick={() => fileInput.current?.click()}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 inline" /> Choose a file
                </Button>
              </div>

              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Paste from Excel</p>
                <p className="text-sm text-takal-ink-soft mb-3">
                  Copy the rows including the headings. Nothing to save first.
                </p>
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={4}
                  placeholder={"Item\tRate\nChapli Kabab\t1600"}
                  className="w-full border-2 border-takal-line rounded-lg p-2 text-sm font-mono mb-3 focus:border-takal-yellow focus:outline-none"
                />
                <Button variant="secondary" disabled={!paste.trim()}
                        onClick={() => take(parsePasted(paste), "pasted rows")}>
                  Use these rows
                </Button>
              </div>

              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Download a blank sheet</p>
                <p className="text-sm text-takal-ink-soft mb-4">
                  Already has Takal&apos;s own column names, so it needs no
                  matching when it comes back. Send it on WhatsApp.
                </p>
                <Button variant="secondary" onClick={downloadBlank}>
                  <Download className="w-4 h-4 mr-2 inline" /> Download
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── STEP 2 ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="2. Match the columns"
            hint={`${source} — his sheet says what it says; match it once here instead of asking him to redo it.`}
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                    <th className="px-4 py-3">HIS COLUMN</th>
                    <th className="px-4 py-3">FIRST ROW</th>
                    <th className="px-4 py-3">BECOMES</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.columns.map((col, i) => (
                    <tr key={i} className="border-t border-takal-line">
                      <td className="px-4 py-3 font-medium text-takal-ink">
                        {col || <span className="text-takal-ink-soft">(no heading)</span>}
                      </td>
                      <td className="px-4 py-3 text-takal-ink-soft">
                        {sheet.rows[0]?.[i] || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapping[i] ?? DETAIL}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[i] = e.target.value;
                            // One of OUR fields can only be used once. Silently
                            // letting two columns be "price" would make the
                            // later one win with nothing on screen to say so.
                            if (OUR_FIELDS.some((f) => f.key === e.target.value)) {
                              next.forEach((m, j) => {
                                if (j !== i && m === e.target.value) next[j] = DETAIL;
                              });
                            }
                            setMapping(next);
                          }}
                          className="border-2 border-takal-line rounded-lg px-3 py-2 focus:border-takal-yellow focus:outline-none"
                        >
                          {OUR_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? " *" : ""}
                            </option>
                          ))}
                          <option value={DETAIL}>Keep as a product detail</option>
                          <option value={IGNORE}>Ignore this column</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={() => setStep(3)} disabled={!!stop}>
                See what will happen
              </Button>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              {stop && <span className="text-sm text-takal-orange">{stop}</span>}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── STEP 3 ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader
            title="3. Check and upload"
            hint={result ? "Done." : "Nothing is saved yet."}
          />
          <CardBody>
            {!namesReady ? (
              <LoadingState label="Reading what this shop already sells…" />
            ) : (
              <>
                {!result && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge tone="good">{counts.good} will be added</Badge>
                      {counts.busy > 0 && (
                        <Badge tone="busy">{counts.busy} already there or repeated</Badge>
                      )}
                      {counts.warn > 0 && (
                        <Badge tone="warn">{counts.warn} need a look</Badge>
                      )}
                      <Badge tone="neutral">0 will be duplicated</Badge>
                    </div>

                    <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border border-takal-line rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                            <th className="px-4 py-3">ROW</th>
                            <th className="px-4 py-3">NAME</th>
                            <th className="px-4 py-3">PRICE</th>
                            <th className="px-4 py-3">WHAT HAPPENS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verdicts.map((v) => (
                            <tr key={v.row}
                                className={`border-t border-takal-line ${
                                  v.tone === "warn" ? "bg-takal-orange-soft" : ""}`}>
                              <td className="px-4 py-3 text-takal-ink-soft">{v.row}</td>
                              <td className="px-4 py-3 text-takal-ink">
                                {v.name || <span className="text-takal-red">— missing —</span>}
                              </td>
                              <td className="px-4 py-3 text-takal-ink">
                                {v.price || <span className="text-takal-red">— missing —</span>}
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={v.tone}>{v.what}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <Button onClick={upload} loading={busy}
                              disabled={counts.good === 0}>
                        <Upload className="w-4 h-4 mr-2 inline" />
                        Upload {counts.good} product{counts.good === 1 ? "" : "s"}
                      </Button>
                      <Button variant="secondary" onClick={() => setStep(2)}>
                        Back to the columns
                      </Button>
                      <span className="text-sm text-takal-ink-soft">
                        Nothing has been saved yet.
                      </span>
                    </div>
                  </>
                )}

                {result && (
                  <div className="rounded-lg border border-takal-green bg-takal-green-soft p-4">
                    <p className="font-bold text-takal-ink">
                      {result.created} product{result.created === 1 ? "" : "s"} added.
                    </p>
                    {result.failed.length > 0 && (
                      <ul className="mt-2 text-sm text-takal-ink-soft space-y-1">
                        {result.failed.slice(0, 8).map((f) => (
                          <li key={f.row}>Row {f.row}: {f.error}</li>
                        ))}
                        {result.failed.length > 8 && (
                          <li>…and {result.failed.length - 8} more.</li>
                        )}
                      </ul>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {undone ? (
                        <Badge tone="neutral">
                          <Check className="w-3 h-3 mr-1 inline" /> Taken back
                        </Badge>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={undo} loading={busy}
                                  disabled={result.ids.length === 0}>
                            Undo this upload
                          </Button>
                          <span className="text-sm text-takal-ink-soft">
                            Possible for one hour. A product that has already
                            been ordered is kept.
                          </span>
                        </>
                      )}
                      <Link href={`/dashboard/stores/${shopId}`}
                            className="text-sm font-medium text-takal-ink underline underline-offset-4">
                        Open the shop
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
