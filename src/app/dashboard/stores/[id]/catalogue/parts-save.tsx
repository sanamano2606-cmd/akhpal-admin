"use client";

/**
 * Step 5 of a whole catalogue: SAVE - in parts, with progress, then one clear
 * answer. (Mock 184, Sana 13 Oct 2026.)
 *
 * Parts of about 500 rows, each saved in ONE transaction by the server
 * (import_catalogue_part, migration 133): a part is either all in or not in.
 * If the internet drops at part 10, "Save again" carries on from part 10 -
 * a name already in the shop is skipped, so nothing is ever added twice.
 * Undo takes the whole upload back for 60 minutes.
 *
 * Mock 186: every part says whether a person ticked "I know these sell at a
 * loss" (confirm_loss) - the server works the loss out again and refuses an
 * unconfirmed one. "Leave out the N" sends the list without them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import {
  NO_TOTALS, addPart, doneLines, partBody, partsOf, productsToSave, timeLeft,
  type CheckResult, type SaveTotals,
} from "@/lib/catalogue-flow";

export function SaveStep({ shopId, result, backHref, onFixFile, onStartAgain, confirmLoss = false, leaveOutLosses = false }: {
  shopId: string;
  result: CheckResult;
  backHref: string;
  onFixFile: () => void;
  onStartAgain: () => void;
  confirmLoss?: boolean;
  leaveOutLosses?: boolean;
}) {
  const r = result;
  const add = r.mode === "add";
  const products = useMemo(() => productsToSave(r, leaveOutLosses), [r, leaveOutLosses]);
  const parts = useMemo(() => partsOf(products), [products]);
  const [next, setNext] = useState(0);              // the next part to send
  const [totals, setTotals] = useState<SaveTotals>(NO_TOTALS);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState("");      // why it stopped, if it did
  const [done, setDone] = useState(false);
  const [msSoFar, setMsSoFar] = useState(0);
  const [undone, setUndone] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const started = useRef(false);
  const [pics, setPics] = useState<{ done: number; total: number; failed: number; still_going: boolean } | null>(null);

  const productsSent = useMemo(
    () => parts.slice(0, next).reduce((n, p) => n + p.length, 0), [parts, next]);

  const run = useCallback(async (from: number) => {
    setRunning(true);
    setStopped("");
    let t = totals;
    let spent = msSoFar;
    for (let i = from; i < parts.length; i++) {
      const t0 = Date.now();
      try {
        const out = await apiClient.catalogueSavePart(shopId, r.mode, partBody(products, parts[i]), confirmLoss);
        t = addPart(t, out);
        spent += Date.now() - t0;
        setTotals(t);
        setMsSoFar(spent);
        if (out?.stopped_by_limit) {
          // The daily allowance ran out inside this part. The part is not
          // finished: tomorrow's Save starts at it again and skips what went in.
          setNext(i);
          setStopped(out.message || "Today's allowance of new products is used up.");
          setRunning(false);
          return;
        }
        setNext(i + 1);
      } catch (e: any) {
        setNext(i);
        setStopped(`${e?.message || "This part could not be saved."} Press "Save again" - it carries on from part ${i + 1}, and nothing is added twice.`);
        setRunning(false);
        return;
      }
    }
    setRunning(false);
    setDone(true);
    toast(add ? `${t.added.toLocaleString()} products added` : `${t.updated.toLocaleString()} products updated`, "success");
  }, [shopId, r, products, parts, totals, msSoFar, add, confirmLoss]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run(0);
  }, [run]);

  // The pictures, fetched in the background after the products are in.
  useEffect(() => {
    if (!done || totals.pictures === 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const ask = async () => {
      try {
        const out = await apiClient.getCataloguePictureProgress(shopId);
        if (!alive) return;
        setPics(out);
        if (out.still_going) timer = setTimeout(ask, 5000);
      } catch {
        if (alive) timer = setTimeout(ask, 10000);
      }
    };
    ask();
    return () => { alive = false; clearTimeout(timer); };
  }, [done, totals.pictures, shopId]);

  const undo = async () => {
    if (!totals.ids.length) return;
    setUndoing(true);
    try {
      const out = await apiClient.catalogueUndo(shopId, totals.ids);
      toast(out?.message || "Taken back.", "success");
      if (Array.isArray(out?.kept) && out.kept.length) toast(`Kept: ${out.kept.slice(0, 5).join("; ")}`, "info");
      setUndone(true);
    } catch (e: any) {
      toast(e?.message || "Could not take it back.", "error");
    } finally {
      setUndoing(false);
    }
  };

  const total = products.length;
  const pct = total ? Math.round((productsSent / total) * 100) : 100;

  return (
    <Card>
      <CardHeader title={done ? "✔ Done" : "5. Saving…"}
                  hint={done ? "One clear answer." : "Keep this page open."} />
      <CardBody>
        {!done && (
          <div className="rounded-lg border-2 border-takal-ink p-4">
            <p className="font-bold text-takal-ink">
              {add ? "Saving" : "Updating"} {productsSent.toLocaleString()} of {total.toLocaleString()} products
            </p>
            <div className="mt-3 h-4 w-full rounded-full bg-takal-page overflow-hidden border border-takal-line">
              <div className="h-full bg-takal-yellow border-r-2 border-takal-ink transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-takal-ink">
              Part {Math.min(next + 1, parts.length)} of {parts.length}.{" "}
              {running ? timeLeft(msSoFar, next, parts.length - next) : ""}
              {running ? " Keep this page open." : ""}
            </p>
            {stopped && (
              <div className="mt-3 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink">
                <p className="font-semibold">{stopped}</p>
                <p className="mt-1 text-takal-ink-soft">
                  {totals.added.toLocaleString()} added and {totals.updated.toLocaleString()} updated so far are saved.
                </p>
                <div className="mt-3">
                  <Button onClick={() => run(next)} loading={running}>Save again - from part {next + 1}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="rounded-lg border-2 border-takal-green bg-takal-green-soft p-4">
            <ul className="space-y-1 text-takal-ink">
              {doneLines(r.mode, totals, r).map((line, i) => (
                <li key={line} className={i === 0 ? "font-bold text-base" : "text-sm"}>
                  {i === 0 ? "✔ " : "· "}{line}
                </li>
              ))}
            </ul>
            {totals.optionsNotFound.length > 0 && (
              <details className="mt-2 text-sm text-takal-ink">
                <summary className="cursor-pointer">Options not found</summary>
                <ul className="mt-1 text-xs text-takal-ink-soft">
                  {totals.optionsNotFound.slice(0, 30).map((o) => <li key={o}>{o}</li>)}
                </ul>
              </details>
            )}
            {totals.pictures > 0 && (
              <p className="mt-3 text-sm text-takal-ink">
                Photos: {totals.pictures.toLocaleString()} links are being fetched in the background - the
                products are already on sale.
                {pics && pics.total > 0 && <> {pics.done.toLocaleString()} done{pics.failed ? `, ${pics.failed} could not be fetched` : ""}.</>}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {r.counts.problem_rows > 0 && (
                <Button variant="secondary" onClick={onFixFile}>
                  <Download className="w-4 h-4 mr-2 inline" /> Rows to fix (Excel)
                </Button>
              )}
              {add && totals.ids.length > 0 && (undone ? (
                <Badge tone="neutral"><Check className="w-3 h-3 mr-1 inline" /> Taken back</Badge>
              ) : (
                <Button variant="secondary" onClick={undo} loading={undoing}>Undo this upload</Button>
              ))}
              <Button variant="secondary" onClick={onStartAgain}>Another list</Button>
              <Link href={backHref} className="text-sm font-medium text-takal-ink underline underline-offset-4">
                Open the shop
              </Link>
            </div>
            {add && totals.ids.length > 0 && !undone && (
              <p className="mt-2 text-xs text-takal-ink-soft">
                Undo is possible for one hour. A product that has already been ordered is kept.
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
