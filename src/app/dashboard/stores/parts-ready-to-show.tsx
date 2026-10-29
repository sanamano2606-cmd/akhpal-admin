"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 216 - "READY TO SHOW" (approved by Sana 29 Oct 2026).
//
// "They Should move to separate portion from where i can confirm and show them
// to customers."
//
// READY            the hidden shops the show lock has nothing against. Each has
//                  its own "Show to customers" (Main Admin only - the server
//                  refuses anybody else), which asks once first. "Show all"
//                  goes through the same door one shop at a time, so each one
//                  is checked AGAIN at that moment; one that changed meanwhile
//                  stays here with the reason.
// PICTURES UNREAD  only the picture check is left. "Read pictures" opens the
//                  Review page, which reads them; the shop then moves up.
//
// The lists come from the server (routers/ready_to_show.py) - this file only
// draws them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";
import { ShopLogo } from "@/components/ShopLogo";
import { verticalEmoji, verticalLabel } from "@/lib/verticals";
import type { ReadyShop, ReadyToShow } from "@/lib/api-stores";
import { approvedDay, confirmTicks, readyTicks, showAllResult, unreadLine, liveMessageStart } from "@/lib/ready-to-show";

export function ReadyToShowSection({ data, loading, failed, isMain, onRefresh, onShown }: {
  data: ReadyToShow | null;
  loading: boolean;
  failed: boolean;
  isMain: boolean;
  /** Ask the server again (fresh = work it out now). */
  onRefresh: (fresh: boolean) => void;
  /** A shop went live: the page moves it to Live. */
  onShown: (ids: string[]) => void;
}) {
  const [ask, setAsk] = useState<ReadyShop | null>(null);
  const [askAll, setAskAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ready = data?.ready || [];
  const unread = data?.pictures_unread || [];

  const showOne = async (s: ReadyShop) => {
    setBusy(s.id);
    try {
      await apiClient.setShownToCustomers(s.id, true);
      toast(`${s.name} is live now. The vendor has been told.`, "success");
      onShown([s.id]);
    } catch (err) {
      // The door checked it again and found something: say what.
      toast(err instanceof Error ? err.message : "That did not work", "error");
      onRefresh(true);
    } finally {
      setBusy(null);
      setAsk(null);
    }
  };

  const showAll = async () => {
    setBusy("all");
    const done: { name: string; ok: boolean; why?: string }[] = [];
    const went: string[] = [];
    for (const s of ready) {
      try {
        await apiClient.setShownToCustomers(s.id, true);
        done.push({ name: s.name, ok: true });
        went.push(s.id);
      } catch (err) {
        done.push({ name: s.name, ok: false, why: err instanceof Error ? err.message : undefined });
      }
    }
    toast(showAllResult(done), went.length === done.length ? "success" : "error");
    setBusy(null);
    setAskAll(false);
    if (went.length) onShown(went);
    if (went.length !== done.length) onRefresh(true);
  };

  return (
    <div data-ready-to-show className="overflow-hidden rounded-2xl border border-takal-line bg-white">
      <div className="flex flex-wrap items-center gap-4 bg-takal-yellow px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-extrabold text-takal-ink">Ready to show to customers</h2>
          <p className="text-[13.5px] text-takal-ink">
            These shops have finished everything Takal asks for. Look once, then switch them on.
            Payout details are not needed to go live.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onRefresh(true)} disabled={loading}
            className="rounded-xl border-2 border-takal-ink bg-white px-3 py-2 text-[13.5px] font-bold text-takal-ink disabled:opacity-60">
            {loading ? "Checking…" : "Check again"}
          </button>
          {ready.length > 0 && (
            <button type="button" data-show-all onClick={() => setAskAll(true)}
              disabled={!isMain || busy !== null}
              title={isMain ? undefined : "Only the main admin can show shops to customers."}
              className="rounded-xl border-2 border-takal-ink bg-takal-ink px-4 py-2 text-[14px] font-bold text-takal-yellow disabled:cursor-not-allowed disabled:opacity-50">
              Show all {ready.length} to customers
            </button>
          )}
        </div>
      </div>

      {failed && !data && (
        <p className="border-t border-takal-line px-5 py-6 text-[14px] text-takal-red">
          The Ready to show list could not be read just now. Press Check again.
        </p>
      )}
      {loading && !data && <p className="border-t border-takal-line px-5 py-6 text-[14px] text-takal-ink-soft">Checking every hidden shop…</p>}
      {data && ready.length === 0 && (
        <p data-ready-empty className="border-t border-takal-line px-5 py-6 text-[14px] text-takal-ink-soft">
          No hidden shop has finished everything yet. The Takal Assistant reminds each vendor what is left.
        </p>
      )}

      {ready.map((s) => (
        <div key={s.id} data-ready-row={s.id}
          className="grid grid-cols-1 items-center gap-3 border-t border-takal-line px-5 py-4 lg:grid-cols-[minmax(240px,1.2fr)_minmax(280px,2fr)_auto]">
          <Shop s={s} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {readyTicks(s).map((t) => <span key={t} className="font-semibold text-takal-green">✓ {t}</span>)}
            {!s.payout_given && (
              <span className="rounded-md bg-takal-yellow-soft px-2 font-semibold text-[#8A6100]">No payout details yet - allowed</span>
            )}
          </div>
          <div className="flex gap-2 whitespace-nowrap">
            <Link href={`/dashboard/stores/${s.id}/review`}
              className="rounded-xl border-2 border-takal-ink bg-white px-4 py-2 text-[14px] font-bold text-takal-ink hover:bg-takal-page">
              Open review
            </Link>
            <button type="button" data-show-one={s.id} onClick={() => setAsk(s)}
              disabled={!isMain || busy !== null}
              title={isMain ? undefined : "Only the main admin can show shops to customers."}
              className="rounded-xl border-2 border-takal-yellow bg-takal-yellow px-4 py-2 text-[14px] font-bold text-takal-ink shadow-[0_1px_0_rgba(0,0,0,0.15)] transition hover:border-takal-ink hover:bg-takal-ink hover:text-takal-yellow disabled:cursor-not-allowed disabled:opacity-50">
              {busy === s.id ? "Switching on…" : "Show to customers"}
            </button>
          </div>
        </div>
      ))}

      {unread.length > 0 && (
        <>
          <div className="flex flex-wrap items-baseline gap-2 border-t-8 border-takal-page px-5 py-3">
            <b className="text-[15px] text-takal-ink">Almost ready - only the pictures are not read yet</b>
            <span className="text-[13px] text-takal-ink-soft">(Open the review: the panel reads them, then the shop moves up here.)</span>
          </div>
          {unread.map((s) => {
            const u = unreadLine(s);
            return (
              <div key={s.id} data-unread-row={s.id}
                className="grid grid-cols-1 items-center gap-3 border-t border-takal-line px-5 py-4 lg:grid-cols-[minmax(240px,1.2fr)_minmax(280px,2fr)_auto]">
                <Shop s={s} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {u.ticks.map((t) => <span key={t} className="font-semibold text-takal-green">✓ {t}</span>)}
                  <span className="font-semibold text-takal-orange">● {u.left}</span>
                </div>
                <Link href={`/dashboard/stores/${s.id}/review`}
                  className="justify-self-start whitespace-nowrap rounded-xl border-2 border-takal-ink bg-white px-4 py-2 text-[14px] font-bold text-takal-ink hover:bg-takal-page lg:justify-self-end">
                  Read pictures
                </Link>
              </div>
            );
          })}
        </>
      )}

      {!!data?.not_checked?.length && (
        <p className="border-t border-takal-line px-5 py-3 text-[12.5px] text-takal-ink-soft">
          Could not be checked just now: {data.not_checked.join(" · ")}. Press Check again.
        </p>
      )}

      <ConfirmDialog
        open={!!ask}
        busy={busy !== null}
        danger={false}
        onCancel={() => setAsk(null)}
        onConfirm={() => ask && showOne(ask)}
        title={`Show ${ask?.name || "this shop"} to customers?`}
        confirmLabel="Yes, show to customers"
        cancelLabel="Cancel"
        message={ask && (
          <span className="block text-[14px] leading-relaxed">
            Takal checks it again the moment you press Yes:
            <span className="my-2 block">
              {confirmTicks(ask).map((t) => <span key={t} className="block font-semibold text-takal-green">✓ {t}</span>)}
            </span>
            Customers will see it from now and can order. The vendor gets a message in Roman Urdu:{" "}
            <i>&ldquo;{liveMessageStart(ask.name)}…&rdquo;</i>
          </span>
        )}
      />
      <ConfirmDialog
        open={askAll}
        busy={busy !== null}
        danger={false}
        onCancel={() => setAskAll(false)}
        onConfirm={showAll}
        title={`Show ${ready.length} shop${ready.length === 1 ? "" : "s"} to customers?`}
        confirmLabel={`Yes, show all ${ready.length}`}
        cancelLabel="Cancel"
        message={
          <span className="block text-[14px] leading-relaxed">
            Takal checks each one again just before it goes live:
            <span className="my-2 block">{ready.map((s) => <span key={s.id} className="block font-semibold">• {s.name}</span>)}</span>
            A shop that changed in the meantime (for example, a new picture with a phone number) is NOT switched on
            and stays in this list with the reason.
          </span>
        }
      />
    </div>
  );
}

function Shop({ s }: { s: ReadyShop }) {
  const type = String(s.vendor_type || "");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ShopLogo url={s.image_url} name={s.name} sign={verticalEmoji(type)} />
      <div className="min-w-0">
        <Link href={`/dashboard/stores/${s.id}`} className="block truncate text-[16px] font-bold text-takal-ink hover:underline">{s.name}</Link>
        <span className="text-[12.5px] text-takal-ink-soft">
          <span className="mr-1.5 rounded-md bg-[#F1F1F1] px-1.5 py-px font-semibold text-takal-ink">{verticalLabel(type)}</span>
          {[s.owner_name, approvedDay(s.approved_at)].filter(Boolean).join(" · ")}
        </span>
      </div>
    </div>
  );
}
