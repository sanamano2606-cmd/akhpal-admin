"use client";

/**
 * SETTINGS > TIDY UP REMOVED PRODUCTS - Mock 203, APPROVED by Sana on
 * 20 October 2026 ("Do 7 Approved"). Audit 204, fix 7.
 *
 * Four states, as the mock: 1 normal (Remove is greyed until a check),
 * 2 after "Check first" (the list + the backup note), 3 the red second
 * question, 4 done (green). Main Admin only: the card hides itself from a
 * sub-admin, and the server refuses them as well (app_guard "__super__").
 * The rules and words: lib/tidy-removed.ts.
 */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, ConfirmDialog } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { getMyPerms } from "@/lib/perms";
import { toast } from "@/lib/toast";
import { checkLines, confirmTitle, mayRemove, type TidyCheck } from "@/lib/tidy-removed";

export function TidyRemovedProducts() {
  const [isSuper, setIsSuper] = useState(false);
  const [check, setCheck] = useState<TidyCheck | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "remove">("");
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    setIsSuper(getMyPerms().isSuper);
  }, []);
  if (!isSuper) return null;

  const runCheck = async () => {
    try {
      setBusy("check");
      setDone("");
      setCheck(await apiClient.checkRemovedProducts());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not check", "error");
    } finally {
      setBusy("");
    }
  };

  const runRemove = async () => {
    if (!check) return;
    try {
      setBusy("remove");
      const r = await apiClient.tidyRemovedProducts(check.products);
      setAsking(false);
      setCheck(null);
      setDone(r.message);
      toast(r.message, "success");
    } catch (e) {
      setAsking(false);
      toast(e instanceof Error ? e.message : "Nothing was removed", "error");
    } finally {
      setBusy("");
    }
  };

  const ready = mayRemove(check);

  return (
    <Card>
      <CardHeader
        title="Tidy up removed products"
        hint="Products that were removed and never ordered still keep their pictures in storage."
      />
      <CardBody className="space-y-3">
        {done ? (
          <div className="rounded-[10px] border border-takal-green bg-takal-green-soft px-3.5 py-2.5 text-sm font-semibold text-takal-green">
            ✓ {done}
          </div>
        ) : check ? (
          <>
            <div className="overflow-hidden rounded-[10px] border border-takal-line">
              {checkLines(check).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-[#F0F0F0] px-3.5 py-2 text-sm last:border-0">
                  <span className="text-takal-ink-soft">{label}</span>
                  <b className="text-right text-takal-ink">{value}</b>
                </div>
              ))}
            </div>
            <div className="rounded-[10px] border border-takal-yellow-dark bg-takal-yellow-soft px-3.5 py-2.5 text-[13px] leading-5 text-takal-ink">
              The product rows are <b>copied to a backup list first</b>. The picture files cannot be brought back once removed.
            </div>
          </>
        ) : (
          <p className="text-sm text-takal-ink-soft">
            This finds products that were <b className="text-takal-ink">removed</b> and are on{" "}
            <b className="text-takal-ink">no order</b>, and erases them with their pictures. A product on any order is{" "}
            <b className="text-takal-ink">never touched</b>. Press <b className="text-takal-ink">Check first</b> -
            nothing is changed by checking.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={runCheck}
            disabled={busy !== ""}
            className={`px-4 py-2 rounded-lg font-medium text-sm disabled:bg-slate-300 ${
              check ? "bg-white border border-takal-line text-takal-ink hover:bg-takal-yellow-soft"
                    : "bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink"}`}
          >
            {busy === "check" ? "Checking…" : check ? "Check again" : "Check first"}
          </button>
          {!done && (
            <button
              onClick={() => setAsking(true)}
              disabled={!ready || busy !== ""}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-takal-red text-white hover:outline hover:outline-2 hover:outline-black disabled:bg-slate-300 disabled:text-slate-600"
            >
              Remove them for good
            </button>
          )}
          {check && check.products === 0 && (
            <span className="rounded-full bg-takal-green-soft px-2 py-0.5 text-xs font-bold text-takal-green">Nothing left to tidy</span>
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onConfirm={runRemove}
        busy={busy === "remove"}
        title={confirmTitle(check?.products ?? 0)}
        message={<>They were removed by their shops and are on no order. Their rows are kept in the backup list; <b>their pictures cannot come back.</b></>}
        confirmLabel={`Yes, remove ${(check?.products ?? 0).toLocaleString("en-US")}`}
      />
    </Card>
  );
}
