"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 237 PIECE 1 - "NEEDS ME TODAY" (approved by Sana 10 Nov 2026; "GO 237").
//
// The yellow box at the top of Stores -> All Stores. Four tiles - Ready to
// switch on, Sent fixes back, Pictures to look at, Quiet shops - and the
// shops behind the one that is open (the first 5, then "See all").
//
//   READY      "Show to customers" - the Main Admin only (the server refuses
//              anybody else), asked once first. The same door as Ready to show.
//   FIXES      "Review again" opens the shop's Review page.
//   PICTURES   "Look at them" opens the shop's Review page, which shows them.
//   QUIET      Call, WhatsApp (the Assistant's own words, already written -
//              you press Send in WhatsApp), "I called" (an office note -
//              nothing is sent to the vendor), Open. Takal never calls a shop
//              by itself (Sana's decision 5).
//
// The numbers come from the server (routers/needs_today.py), asked AFTER the
// shop list is drawn, so the list is never slower. A part the server could not
// read says so on its tile; it never shows a quiet 0.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { refreshReadyToShowCount } from "@/lib/hooks/useReadyToShowCount";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";
import { verticalLabel } from "@/lib/verticals";
import { whatsappLink } from "@/lib/vendor-queue";
import {
  FIRST_ROWS, TILES, calledLine, clock, fixesLine, picturesLine, quietLine, readyLine, telLink,
  tileCount, tileLine, type NeedsKind, type NeedsToday, type QuietRow, type ReadyRow,
} from "@/lib/needs-today";

const TONE: Record<NeedsKind, { num: string; icon: string }> = {
  ready: { num: "text-takal-green", icon: "bg-takal-green-soft" },
  fixes: { num: "text-takal-blue", icon: "bg-takal-blue-soft" },
  pictures: { num: "text-[#C2410C]", icon: "bg-takal-orange-soft" },
  quiet: { num: "text-takal-purple", icon: "bg-takal-purple-soft" },
};

const BTN = "inline-flex items-center gap-1 rounded-lg border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold whitespace-nowrap";

export function NeedsMeToday({ start, isMain, onShown }: {
  /** The shop list is drawn: ask the server now. */
  start: boolean;
  isMain: boolean;
  /** A shop went live from here: the page moves it to Live. */
  onShown: (ids: string[]) => void;
}) {
  const [data, setData] = useState<NeedsToday | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<NeedsKind | null>(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<ReadyRow | null>(null);
  const asked = useRef(false);

  const load = async (fresh = false) => {
    setLoading(true);
    try {
      const d = (await apiClient.getNeedsToday(fresh)) as NeedsToday;
      setData(d);
      setFailed(false);
      // The first tile with something in it opens by itself, once.
      setOpen((was) => was ?? TILES.find((t) => (tileCount(t.key, d) || 0) > 0)?.key ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!start || asked.current) return;
    asked.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const choose = (k: NeedsKind) => { setOpen(open === k ? null : k); setAll(false); };

  const show = async (s: ReadyRow) => {
    setBusy(s.id);
    try {
      await apiClient.setShownToCustomers(s.id, true);
      toast(`${s.name} is live now. The vendor has been told.`, "success");
      setData((d) => d && { ...d, ready: d.ready.filter((x) => x.id !== s.id) });
      onShown([s.id]);
    } catch (err) {
      // The door checked it again and found something: say what.
      toast(err instanceof Error ? err.message : "That did not work", "error");
      void load(true);
    } finally {
      setBusy(null);
      setAsk(null);
      void refreshReadyToShowCount();
    }
  };

  const whatsapp = async (r: QuietRow) => {
    // Opened NOW, while the click still counts - a window opened after the
    // words arrive would be stopped by the browser.
    const w = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const out = await apiClient.getQuietWhatsapp(r.id) as { phone: string; text: string };
      const link = whatsappLink(out.phone || r.phone, out.text);
      if (!link) {
        w?.close();
        toast("This shop has no mobile number WhatsApp can use. Use Call instead.", "error");
        return;
      }
      if (w) w.location.href = link; else window.open(link, "_blank");
      // The words are kept in the shop's messages - a note of the press, not
      // a claim that it was sent: Send is pressed in WhatsApp.
      apiClient.recordWhatsappSent(r.id, { kind: "what_is_left", lang: "roman", text: out.text })
        .catch(() => { /* WhatsApp still opened; only the note of it is missing */ });
    } catch (err) {
      w?.close();
      toast(err instanceof Error ? err.message : "WhatsApp could not be opened", "error");
    }
  };

  const called = async (r: QuietRow) => {
    setBusy(r.id);
    try {
      const out = await apiClient.recordCall(r.id) as { called_at: string | null; called_by: string | null };
      // Only what the server kept is shown as kept.
      if (out?.called_at) {
        setData((d) => d && { ...d, quiet: d.quiet.map((x) => (x.id === r.id
          ? { ...x, called_at: out.called_at, called_by: out.called_by } : x)) });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "The call was not saved", "error");
    } finally {
      setBusy(null);
    }
  };

  const rowsOf = <T,>(list: T[]) => (all ? list : list.slice(0, FIRST_ROWS));

  const head = (title: string, note: string) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-2 pt-3">
      <b className="text-[14.5px] text-takal-ink">{title}</b>
      <span className="min-w-0 flex-1 text-[13px] text-takal-ink-soft">{note}</span>
      <button type="button" onClick={() => setOpen(null)} className={`${BTN} border-takal-line bg-white text-takal-ink`}>Close ▲</button>
    </div>
  );

  const name = (id: string, n: string, type?: string, extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/dashboard/stores/${id}`} className="text-[14.5px] font-extrabold text-takal-ink hover:underline">{n}</Link>
      <span className="rounded-md bg-takal-page px-2 py-0.5 text-xs font-semibold text-takal-ink-soft">{verticalLabel(type)}</span>
      {extra}
    </div>
  );

  const bar = (n: number) => (
    <div className="mt-1.5 flex gap-[3px]" aria-label={`${Math.min(n, 5)} of 5 products`}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={`h-1.5 w-[22px] rounded ${i < n ? "bg-takal-green" : "bg-takal-line"}`} />)}
    </div>
  );

  const row = (key: string, left: React.ReactNode, words: string, acts: React.ReactNode) => (
    <div key={key} data-needs-row={key}
      className="mb-2 grid grid-cols-1 items-center gap-2 rounded-xl border border-takal-line bg-white px-3 py-2.5 hover:bg-takal-yellow-soft xl:grid-cols-[minmax(0,2.2fr)_minmax(0,2.6fr)_auto] xl:gap-3.5">
      <div className="min-w-0">{left}</div>
      <div className="text-[13px] text-takal-ink">{words}</div>
      <div className="flex flex-wrap justify-start gap-1.5 xl:justify-end">{acts}</div>
    </div>
  );

  const seeAll = (n: number, what: string) => (n > FIRST_ROWS && !all ? (
    <div className="flex justify-center pt-1">
      <button type="button" onClick={() => setAll(true)} className="text-[13.5px] font-bold text-takal-blue hover:underline">
        See all {n} {what} ›
      </button>
    </div>
  ) : null);

  const empty = (words: string) => (
    <p className="mb-2 rounded-xl bg-takal-page px-4 py-4 text-center text-[13.5px] text-takal-ink-soft">✓ {words}</p>
  );

  const body = () => {
    if (!data || !open) return null;
    if (data.failed?.includes(open)) {
      return <div className="border-t border-takal-line px-4 pb-3">{head(TILES.find((t) => t.key === open)!.label, "")}
        <p className="mb-2 text-[13.5px] text-takal-red">This part could not be read just now. Press Check again.</p></div>;
    }
    if (open === "ready") {
      return (
        <div className="border-t border-takal-line px-4 pb-3">
          {head("Ready to switch on", "Every step is done and checked. \"Show to customers\" puts the shop live at once - only the Main Admin has it.")}
          {data.ready.length === 0 && empty("No shop is waiting for your switch.")}
          {rowsOf(data.ready).map((r) => row(r.id, <>{name(r.id, r.name, r.vendor_type)}{bar(r.products_on_sale ?? 0)}</>, readyLine(r), <>
            <Link href={`/dashboard/stores/${r.id}`} className={`${BTN} border-takal-line bg-white text-takal-ink`}>Open</Link>
            <button type="button" data-needs-show={r.id} onClick={() => setAsk(r)} disabled={!isMain || busy !== null}
              title={isMain ? "Puts the shop live for customers now" : "Only the main admin can show shops to customers."}
              className={`${BTN} border-takal-ink bg-takal-yellow text-takal-ink disabled:cursor-not-allowed disabled:opacity-50`}>
              Show to customers
            </button>
          </>))}
          {seeAll(data.ready.length, "shops")}
        </div>
      );
    }
    if (open === "fixes") {
      return (
        <div className="border-t border-takal-line px-4 pb-3">
          {head("Sent fixes back", "The vendor pressed \"Send for review again\". Look again - each line he changed is already ticked.")}
          {data.fixes.length === 0 && empty("Nothing waiting. When a vendor sends his fixes back, the shop comes here at once.")}
          {rowsOf(data.fixes).map((r) => row(r.id, name(r.id, r.name, r.vendor_type), fixesLine(r),
            <Link href={`/dashboard/stores/${r.id}/review`} className={`${BTN} border-takal-ink bg-takal-yellow text-takal-ink`}>Review again</Link>))}
          {seeAll(data.fixes.length, "shops")}
        </div>
      );
    }
    if (open === "pictures") {
      return (
        <div className="border-t border-takal-line px-4 pb-3">
          {head("Pictures to look at", "The picture reader was not sure. You decide on the Review page: \"Not a phone number\", or blur it. Newest first.")}
          {data.pictures.length === 0 && empty("Nothing to look at.")}
          {rowsOf(data.pictures).map((r) => row(r.id, <>{name(r.id, r.name, r.vendor_type)}
            <div className="mt-1.5 flex gap-1.5">
              {r.pictures.slice(0, 5).map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" loading="lazy" className="h-9 w-9 rounded-md border border-takal-line object-cover" />
              ))}
            </div></>, picturesLine(r),
            <Link href={`/dashboard/stores/${r.id}/review`} className={`${BTN} border-takal-ink bg-takal-yellow text-takal-ink`}>Look at them</Link>))}
          {seeAll(data.pictures.length, "shops")}
        </div>
      );
    }
    return (
      <div className="border-t border-takal-line px-4 pb-3">
        {head("Quiet shops", "Closest to going live first. Takal does not call them by itself - call when you want to.")}
        {data.quiet.length === 0 && empty("Every hidden shop added something in the last week.")}
        {rowsOf(data.quiet).map((r) => {
          const tel = telLink(r.phone);
          const done = calledLine(r.called_at);
          return row(r.id, <>{name(r.id, r.name, r.vendor_type)}{bar(r.on_sale)}</>, quietLine(r), <>
            {done && <span data-needs-called={r.id} title={r.called_by ? `By ${r.called_by}` : undefined}
              className="rounded-md bg-takal-green-soft px-2 py-1 text-[12px] font-bold text-takal-green">{done}</span>}
            {tel ? <a href={tel} className={`${BTN} border-takal-line bg-white text-takal-ink`}>📞 Call</a>
              : <span title="No phone number saved" className={`${BTN} cursor-not-allowed border-takal-line bg-white text-takal-disabled-text`}>📞 Call</span>}
            <button type="button" onClick={() => whatsapp(r)} title="Opens WhatsApp with what is left already written - you press Send"
              className={`${BTN} border-takal-green bg-takal-green-soft text-takal-green`}>WhatsApp</button>
            <button type="button" data-needs-i-called={r.id} onClick={() => called(r)} disabled={busy !== null}
              title="Keeps &quot;Called&quot; on this shop's notes - nothing is sent to the vendor"
              className={`${BTN} border-takal-line bg-white text-takal-ink disabled:opacity-50`}>
              {busy === r.id ? "Saving…" : "✓ I called"}
            </button>
            <Link href={`/dashboard/stores/${r.id}`} className={`${BTN} border-takal-line bg-white text-takal-ink`}>Open</Link>
          </>);
        })}
        {seeAll(data.quiet.length, "quiet shops")}
      </div>
    );
  };

  return (
    <section data-needs-today className="mb-4 overflow-hidden rounded-2xl border-2 border-takal-ink bg-white shadow-[0_3px_0_#111]">
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-takal-ink bg-takal-yellow px-5 py-3">
        <h2 className="text-[18px] font-extrabold text-takal-ink">Needs me today</h2>
        {/* Round school-book letters (Naskh), never the slanted style; Windows draws
            Urdu in Segoe UI, which is Naskh too - no font file is added. */}
        <span lang="ur" dir="rtl" className="text-[15px] text-takal-ink"
          style={{ fontFamily: '"Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif' }}>آج کے کام</span>
        <span className="ml-auto text-[12.5px] font-semibold text-takal-ink">
          {failed && !data ? "Could not be read just now" : loading && !data ? "Checking…" : data ? `Checked at ${clock(data.checked_at)}` : ""}
        </span>
        <button type="button" onClick={() => load(true)} disabled={loading}
          className="rounded-lg border-[1.5px] border-takal-ink bg-white px-3 py-1 text-[12.5px] font-bold text-takal-ink disabled:opacity-60">
          {loading ? "Checking…" : "Check again"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 py-3.5 xl:grid-cols-4">
        {TILES.map((t) => {
          const n = tileCount(t.key, data);
          const on = open === t.key;
          const bad = data?.failed?.includes(t.key);
          return (
            <button key={t.key} type="button" data-needs-tile={t.key} aria-pressed={on} onClick={() => choose(t.key)}
              className={`relative flex flex-col items-start justify-start rounded-2xl px-3.5 py-3 text-left transition ${on ? "border-[2.5px] border-takal-ink shadow-[0_3px_0_#111]" : "border-[1.5px] border-takal-line hover:border-takal-ink-soft"} ${n === 0 ? "bg-takal-page" : "bg-white"}`}>
              <span aria-hidden className={`absolute right-3 top-3 grid h-[34px] w-[34px] place-items-center rounded-[10px] text-[17px] ${TONE[t.key].icon}`}>{t.icon}</span>
              <b className={`block text-[30px] font-extrabold leading-tight ${n ? TONE[t.key].num : "text-takal-disabled-text"}`}>
                {bad ? "–" : n ?? "…"}
              </b>
              <span className="block pr-10 text-[14.5px] font-extrabold text-takal-ink">{t.label}</span>
              <span className="block text-[12.5px] text-takal-ink-soft">{tileLine(t.key, data)}</span>
            </button>
          );
        })}
      </div>
      {body()}
      <ConfirmDialog open={!!ask} onCancel={() => setAsk(null)} onConfirm={() => ask && show(ask)}
        title={`Show ${ask?.name || "this shop"} to customers?`}
        message="It goes live at once and its vendor is told. Everything is checked again first."
        confirmLabel="Yes, show it" danger={false} busy={busy !== null} />
    </section>
  );
}
