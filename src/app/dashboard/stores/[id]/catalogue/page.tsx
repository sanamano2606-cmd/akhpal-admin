"use client";

/**
 * ADDING A WHOLE CATALOGUE - big lists, every option, stock, safe prices.
 * (Mock 184, approved by Sana 13 October 2026. Replaces Mock 107 v2's page;
 * the old one is kept in DELETE-AFTER-TESTING.)
 *
 *   "each product and its sizes, quantity, colours, mg, gm, etc fill auto in
 *    its related category and the options of an item auto fill in the that
 *    items options if available" - about 15,000 Health & Pharmacy items.
 *
 * FIVE STEPS
 *   1. List        - Add new products, or Update prices and stock; a file
 *                    (Excel or CSV, up to 20,000 rows), a paste, a blank sheet.
 *   2. Columns     - guessed for you, every one changeable. Option columns join
 *                    rows of one product. Money columns are never shown to
 *                    customers; TP / Trade / Cost is the PRIVATE buying price.
 *   3. Categories  - each word in his Category column ONCE, remembered.
 *   4. Check       - totals first, four tabs, 50 rows a page, search by name.
 *                    A bad row holds back only its own product.
 *   5. Save        - parts of about 500 rows, each in one transaction, with a
 *                    progress bar. Undo for 60 minutes. Rows to fix as Excel.
 *
 * The reading of the list is the SERVER's (backend/catalogue_engine.py) - the
 * same code the Partners app asks. This page only shows it. The screen's own
 * rules are in @/lib/catalogue-flow (tests/whole-catalogue-big-lists.test.ts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Lock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { signedInAsStaff } from "@/lib/staff-sign-in";
import { toast } from "@/lib/toast";
import { Badge, Button, Card, CardBody, CardHeader, LoadingState } from "@/components/ui";
import { parseCsv, parsePasted, type Sheet } from "@/lib/sheet-reader";
import {
  ROLE_GROUPS, blankSheetCsv, choicesFrom, leafGroups, wordsStillOpen,
  type CheckResult, type Leaf, type Mode, type Word,
} from "@/lib/catalogue-flow";
import { CheckStep } from "./parts-check";
import { SaveStep } from "./parts-save";

const EMPTY: Sheet = { columns: [], rows: [] };
const STEPS = ["List", "Columns", "Categories", "Check", "Save"] as const;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CataloguePage({ params }: { params: { id: string } }) {
  const shopId = params.id;
  // A Mall's own staff come back to THEIR Shop panel, not the admin store page
  // (they open this page at /shop/catalogue/{id}). Read after the page has
  // started, so the first drawing matches the server's.
  const [backHref, setBackHref] = useState(`/dashboard/stores/${shopId}`);
  useEffect(() => {
    // Back to the SAME store of the Shop panel (a mall login has several).
    if (signedInAsStaff()) setBackHref(`/shop?store=${encodeURIComponent(shopId)}`);
  }, [shopId]);
  // WHICH SHOP THIS IS FOR (fix 13, Sana 12 Oct 2026). The heading said only
  // "Add a whole catalogue". A failed read just leaves the name off.
  const [shopName, setShopName] = useState("");
  useEffect(() => {
    let alive = true;
    apiClient.getShopName(shopId).then((n) => { if (alive) setShopName(n); }).catch(() => { /* heading without the name */ });
    return () => { alive = false; };
  }, [shopId]);

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("add");
  const [sheet, setSheet] = useState<Sheet>(EMPTY);
  const [source, setSource] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);

  const [mapping, setMapping] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [examples, setExamples] = useState<string[]>([]);

  const [words, setWords] = useState<Word[]>([]);
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [needsCategory, setNeedsCategory] = useState(true);

  const [checked, setChecked] = useState<CheckResult | null>(null);
  const [problem, setProblem] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const take = async (s: Sheet, what: string, cut = false) => {
    if (s.columns.length === 0 || s.rows.length === 0) {
      toast("There are no rows in that — is the first row the column names?", "error");
      return;
    }
    setSheet(s);
    setSource(what);
    setTruncated(cut);
    setChecked(null);
    setProblem("");
    setBusy(true);
    try {
      const out = await apiClient.catalogueColumns(shopId, s.columns, s.rows);
      setMapping(out.mapping);
      setNotes(out.notes || []);
      setExamples(out.examples || []);
      setRoles(Object.fromEntries((out.roles || []).map((r) => [r.key, r.label])));
      setStep(2);
    } catch (e: any) {
      toast(e?.message || "The columns could not be read.", "error");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!/\.(xlsx|xlsm|csv|txt)$/.test(name)) {
      toast("Choose an Excel (.xlsx) or a .csv file.", "error");
      return;
    }
    setBusy(true);
    try {
      if (name.endsWith(".csv") || name.endsWith(".txt")) {
        const s = parseCsv(await file.text());
        setBusy(false);
        await take(s, `${file.name} · ${s.rows.length.toLocaleString()} rows, ${s.columns.length} columns`);
      } else {
        const out = await apiClient.catalogueReadSheet(file, shopId);
        setBusy(false);
        await take({ columns: out.columns, rows: out.rows },
          `${file.name} · ${out.total.toLocaleString()} rows, ${out.columns.length} columns`, out.truncated);
      }
    } catch (e: any) {
      toast(e?.message || "That sheet could not be read.", "error");
      setBusy(false);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // ── step 2 -> 3 (or straight to 4 for Update) ────────────────────────────
  const roleUsed = (key: string, at: number) => mapping.some((m, j) => j !== at && m === key);
  const setRole = (i: number, key: string) => {
    const next = [...mapping];
    next[i] = key;
    // One of the single jobs can be on ONE column only - the later choice wins
    // and the other goes back to "detail", where the person can see it.
    if (!["detail", "ignore"].includes(key)) {
      next.forEach((m, j) => { if (j !== i && m === key) next[j] = "detail"; });
    }
    setMapping(next);
  };
  const quickStop = useMemo(() => {
    if (!mapping.includes("name")) return "Choose which column is the product name.";
    if (mode === "add" && !mapping.includes("price")) return "Choose which column is the selling price.";
    if (mode === "update" && !mapping.some((m) => ["price", "stock", "buying"].includes(m))) {
      return "Updating needs a selling price, a stock or a buying price column.";
    }
    return "";
  }, [mapping, mode]);

  const runCheck = useCallback(async (picked: Record<string, string>) => {
    setBusy(true);
    setProblem("");
    try {
      const out = await apiClient.catalogueCheck(shopId, {
        columns: sheet.columns, rows: sheet.rows, mapping, mode, words: picked,
      });
      setChecked(out);
      setStep(4);
    } catch (e: any) {
      setProblem(e?.message || "The list could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [shopId, sheet, mapping, mode]);

  const toCategories = async () => {
    if (mode === "update") { await runCheck({}); return; }
    setBusy(true);
    try {
      const out = await apiClient.catalogueWords(shopId, sheet.columns, sheet.rows, mapping);
      setWords(out.words || []);
      setLeaves(out.leaves || []);
      setNeedsCategory(out.needs_category !== false);
      setChoices(choicesFrom(out.words || []));
      if (out.needs_category === false) {
        setBusy(false);
        await runCheck({});
        return;
      }
      setStep(3);
    } catch (e: any) {
      toast(e?.message || "The category words could not be read.", "error");
    } finally {
      setBusy(false);
    }
  };

  const toCheck = async () => {
    // Remember his words for the next list - quietly: the check never waits on it.
    apiClient.catalogueRememberWords(shopId, choices).catch(() => { /* remembered next time */ });
    await runCheck(choices);
  };

  const open = wordsStillOpen(words, choices);
  const groups = useMemo(() => leafGroups(leaves), [leaves]);
  const [showAllWords, setShowAllWords] = useState(false);

  const fixFile = async () => {
    if (!checked) return;
    try {
      download(await apiClient.catalogueFixFile(shopId, sheet.columns, sheet.rows, checked.problems),
        "rows-to-fix.xlsx");
    } catch (e: any) {
      toast(e?.message || "The file could not be made.", "error");
    }
  };

  const downloadBlank = () => download(new Blob([blankSheetCsv()], { type: "text/csv;charset=utf-8" }),
    "takal-products.csv");

  const startAgain = () => {
    setStep(1); setSheet(EMPTY); setChecked(null); setWords([]); setChoices({}); setMapping([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref}
              className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink">
          <ArrowLeft className="w-4 h-4" /> Back to the shop
        </Link>
        <h1 className="text-2xl font-bold text-takal-ink mt-2">
          Add a whole catalogue{shopName ? <> — <span className="text-takal-ink">{shopName}</span></> : null}
        </h1>
        <p className="text-sm text-takal-ink-soft mt-1">
          Any size of list - up to 20,000 rows. Nothing is saved until you have seen what will
          happen to every row.
        </p>
      </div>

      {/* the five steps */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {STEPS.map((t, i) => {
          const n = i + 1;
          const skipped = n === 3 && (mode === "update" || !needsCategory);
          return (
            <span key={t} className="inline-flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold border-2
                ${step > n || step === n ? "bg-takal-yellow border-takal-ink text-takal-ink"
                  : "bg-takal-disabled-bg border-takal-disabled-bg text-takal-disabled-text"}`}>
                {step > n ? "✓" : n}
              </span>
              <span className={step === n ? "font-bold text-takal-ink" : skipped ? "text-takal-disabled-text line-through" : "text-takal-ink-soft"}>
                {t}
              </span>
            </span>
          );
        })}
      </div>

      {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader title="1. Choose the list"
                      hint="Any size. Excel up to 20,000 rows, a CSV, or a paste from Excel." />
          <CardBody>
            <p className="text-xs font-bold tracking-wide text-takal-ink-soft mb-2">WHAT DO YOU WANT TO DO?</p>
            <div className="grid gap-3 md:grid-cols-2 mb-6">
              {([
                ["add", "➕ Add new products",
                  "Products already in the shop are left exactly as they are."],
                ["update", "🔄 Update prices and stock",
                  "The same list again: new prices, quantities and buying prices go onto the products already there. Nothing new is added; a name or a photo is never changed."],
              ] as [Mode, string, string][]).map(([m, title, words]) => (
                <button key={m} type="button" onClick={() => setMode(m)} data-mode={m}
                        className={`text-left rounded-lg p-4 border-2 transition
                          ${mode === m ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line bg-white hover:border-takal-ink-soft"}`}>
                  <p className="font-bold text-takal-ink">{title}</p>
                  <p className="text-sm text-takal-ink-soft mt-1">{words}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Choose Excel or CSV</p>
                <p className="text-sm text-takal-ink-soft mb-4">
                  .xlsx or .csv. The first row must be the column names.
                </p>
                <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.csv,.txt" className="hidden"
                       onChange={(e) => onFile(e.target.files?.[0])} />
                <Button variant="secondary" loading={busy} onClick={() => fileInput.current?.click()}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 inline" /> Choose a file
                </Button>
              </div>
              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Paste from Excel</p>
                <p className="text-sm text-takal-ink-soft mb-3">Copy the rows including the headings.</p>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
                          placeholder={"Product Name\tStrength\tMRP\nPanadol Tablet\t500 mg\t45"}
                          className="w-full border-2 border-takal-line rounded-lg p-2 text-sm font-mono mb-3 focus:border-takal-yellow focus:outline-none" />
                <Button variant="secondary" disabled={!paste.trim() || busy}
                        onClick={() => { const s = parsePasted(paste); take(s, `pasted · ${s.rows.length.toLocaleString()} rows`); }}>
                  Use these rows
                </Button>
              </div>
              <div className="rounded-lg border-2 border-takal-line p-4">
                <p className="font-bold text-takal-ink mb-1">Download a blank sheet</p>
                <p className="text-sm text-takal-ink-soft mb-4">
                  Takal&apos;s own headings - Strength, Pack, buying and selling price, stock,
                  barcode. Send it on WhatsApp.
                </p>
                <Button variant="secondary" onClick={downloadBlank}>
                  <Download className="w-4 h-4 mr-2 inline" /> Download
                </Button>
              </div>
            </div>
            <div className="mt-4 rounded-lg border-2 border-takal-ink bg-takal-yellow-soft p-4 text-sm text-takal-ink">
              <p className="font-bold text-base mb-1">Options? Put each one on its own row.</p>
              <p>Same <b>Name</b> on every row, the option in its own column (Size, Strength, Pack,
                Volume, Weight, Colour, Flavour or Scent), each row with its own <b>price</b> and
                <b> stock</b>. They become ONE product with options. No option column? &ldquo;Panadol
                500mg&rdquo; and &ldquo;Panadol 650mg&rdquo; are joined from the name too.</p>
              <p className="mt-2 text-takal-ink-soft">Big lists are saved in parts of 500, one after
                another, with a progress bar. A shop&apos;s own app may add 2,000 new products a day.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader title="2. What is in each column?"
                      hint={`${source} — guessed for you, change any. ${mode === "add" ? "Adding new products." : "Updating price, stock and buying price only."}`} />
          <CardBody>
            {truncated && (
              <div className="mb-4 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
                Only the first 20,000 rows were read. Split the file and upload the rest after this one.
              </div>
            )}
            {notes.length > 0 && (
              <div className="mb-4 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink space-y-1">
                {notes.map((n) => <p key={n}>⚠ {n}</p>)}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                    <th className="px-4 py-3">HIS COLUMN</th>
                    <th className="px-4 py-3">EXAMPLE</th>
                    <th className="px-4 py-3">TAKAL USES IT AS</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.columns.map((col, i) => (
                    <tr key={i} className={`border-t border-takal-line ${mapping[i] === "buying" ? "bg-takal-yellow-soft" : ""}`}>
                      <td className="px-4 py-3 font-medium text-takal-ink">
                        {col || <span className="text-takal-ink-soft">(no heading)</span>}
                      </td>
                      <td className="px-4 py-3 text-takal-ink-soft">{examples[i] || sheet.rows[0]?.[i] || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select value={mapping[i] ?? "detail"} onChange={(e) => setRole(i, e.target.value)}
                                  aria-label={`What ${col || "this column"} is`}
                                  className="border-2 border-takal-line rounded-lg px-3 py-2 focus:border-takal-yellow focus:outline-none">
                            {ROLE_GROUPS.map((g) => (
                              <optgroup key={g.title} label={g.title}>
                                {g.keys.map((k) => (
                                  <option key={k} value={k}>
                                    {roles[k] || k}{roleUsed(k, i) && !["detail", "ignore"].includes(k) ? " (in use)" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {mapping[i] === "buying" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-takal-ink">
                              <Lock className="w-3 h-3" /> never shown
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-takal-ink-soft">
              Two option kinds together (Strength + Pack, Colour + Size) become one option each:
              &ldquo;500 mg / Strip of 10&rdquo;. A column called Cost, TP, Trade or Purchase can never
              be shown to customers.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={toCategories} disabled={!!quickStop} loading={busy}>
                {mode === "add" ? "Next: categories" : "Check the list"}
              </Button>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              {quickStop && <span className="text-sm font-semibold text-takal-red">{quickStop}</span>}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader title="3. Where do these go?"
                      hint="Every word in his Category column is listed once. Pick the Takal sub-category once; it is remembered for the next list." />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-takal-page text-left text-xs font-bold text-takal-ink-soft">
                    <th className="px-4 py-3">HIS WORD</th>
                    <th className="px-4 py-3 text-right">ROWS</th>
                    <th className="px-4 py-3">TAKAL SUB-CATEGORY</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllWords ? words : words.slice(0, 40)).map((w) => (
                    <tr key={w.key} className={`border-t border-takal-line ${choices[w.key] ? "" : "bg-takal-orange-soft"}`}>
                      <td className="px-4 py-3 font-medium text-takal-ink">
                        {w.word || <span className="text-takal-ink-soft">(empty)</span>}
                        {w.why === "remembered" && choices[w.key] === w.suggestion && (
                          <span className="ml-2 text-[11px] font-bold text-takal-blue">REMEMBERED</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-takal-ink">{w.rows.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select value={choices[w.key] || ""} aria-label={`Sub-category for ${w.word || "rows with no word"}`}
                                onChange={(e) => setChoices({ ...choices, [w.key]: e.target.value })}
                                className="border-2 border-takal-line rounded-lg px-3 py-2 min-w-[16rem] focus:border-takal-yellow focus:outline-none">
                          <option value="">Choose…</option>
                          {groups.map((g) => g.group ? (
                            <optgroup key={g.group} label={g.group}>
                              {g.leaves.map((lf) => <option key={lf.id} value={lf.id}>{lf.name}{lf.needs_prescription ? " ℞" : ""}</option>)}
                            </optgroup>
                          ) : g.leaves.map((lf) => <option key={lf.id} value={lf.id}>{lf.name}{lf.needs_prescription ? " ℞" : ""}</option>))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-takal-ink-soft">
              {words.length.toLocaleString()} word{words.length === 1 ? "" : "s"} in this list
              {words.length > 40 && !showAllWords && <> - 40 shown. <button type="button" className="underline font-semibold text-takal-ink" onClick={() => setShowAllWords(true)}>Show all</button></>}
              . Words seen before are filled in already. ℞ = prescription medicine.
            </p>
            {open.length > 0 && (
              <div className="mt-3 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
                {open.length} word{open.length === 1 ? "" : "s"} still need{open.length === 1 ? "s" : ""} a sub-category:{" "}
                {open.slice(0, 6).map((w) => `${w.word || "(empty)"} (${w.rows.toLocaleString()} rows)`).join(", ")}
                {open.length > 6 ? " …" : ""}. Their rows go to &ldquo;Rows to fix&rdquo; until one is chosen.
              </div>
            )}
            {problem && <p className="mt-3 text-sm font-semibold text-takal-red">{problem}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={toCheck} loading={busy}>Check every row</Button>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {busy && step === 2 && mode === "update" && (
        <LoadingState label={`Checking ${sheet.rows.length.toLocaleString()} rows…`} />
      )}
      {problem && step === 2 && <p className="text-sm font-semibold text-takal-red">{problem}</p>}

      {/* ── STEP 4 ─────────────────────────────────────────────────────── */}
      {step === 4 && checked && (
        <CheckStep result={checked} leaves={leaves} onBack={() => setStep(mode === "add" && needsCategory ? 3 : 2)}
                   onSave={() => setStep(5)} onFixFile={fixFile} />
      )}

      {/* ── STEP 5 ─────────────────────────────────────────────────────── */}
      {step === 5 && checked && (
        <SaveStep shopId={shopId} result={checked} backHref={backHref} onFixFile={fixFile}
                  onStartAgain={startAgain} />
      )}

      {step !== 1 && (
        <p className="text-xs text-takal-ink-soft">
          <Badge tone="neutral">{mode === "add" ? "Adding new products" : "Updating price, stock, buying price"}</Badge>
        </p>
      )}
    </div>
  );
}
