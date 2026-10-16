"use client";

/**
 * MOCK 198, BOARD 3 - AN ITEM IS NOT AVAILABLE, the office's parts
 * (approved by Sana, 15 Oct 2026: "Approved. please built exactly as mocks").
 *
 *   NeedsCallCard   the red card on Orders -> Needs a call: call her, what is
 *                   missing, and the three answers after the call
 *   ItemStory       the order's history, with times and names
 *   ItemChangeBox   on an order's own page: the waiting note, the history,
 *                   and "Mark an item not available" (the shop's own window)
 *
 * The rules live in lib/item-change.ts and are tested there.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Phone, Clock, X, Plus, Check, Minus, Tag } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-errors";
import { money, orderLabel } from "@/lib/format";
import { toast } from "@/lib/toast";
import { verticalLabel } from "@/lib/verticals";
import { Button, ConfirmDialog, Modal } from "@/components/ui";
import {
  areaOf, boldParts, clock, hhmm, isWaiting, itemChangeReady, missingChip, officeMayMark,
  phoneForCall, secondsLeft, storyOf, telHref, WAIT_MINUTES, type StoryLine,
} from "@/lib/item-change";

// Board 3: each step is a ring with a dot of the same colour inside; "told in
// the app" is the yellow one, ringed in ink so it shows on white.
const DOT: Record<StoryLine["dot"], { ring: string; fill: string }> = {
  grey: { ring: "border-slate-300", fill: "bg-slate-300" },
  green: { ring: "border-takal-green", fill: "bg-takal-green" },
  red: { ring: "border-takal-red", fill: "bg-takal-red" },
  yellow: { ring: "border-takal-ink", fill: "bg-takal-yellow" },
  blue: { ring: "border-takal-blue", fill: "bg-takal-blue" },
};

/** "a **b** c" with the bold parts bold. */
function Words({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
    </>
  );
}

/** "on_the_way_to_restaurant" -> "On the way to restaurant" (board 3: "Accepted · waiting"). */
function statusWords(status: any): string {
  const w = String(status ?? "").replace(/_/g, " ").trim();
  return w ? w[0].toUpperCase() + w.slice(1) : "";
}

/** A product's small photo, or a soft square when it has none. */
function Thumb({ url }: { url?: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg border border-takal-line object-cover" />
  ) : (
    <span className="h-10 w-10 flex-shrink-0 rounded-lg border border-takal-line bg-takal-page" aria-hidden />
  );
}

// ── THE HISTORY ────────────────────────────────────────────────────────────

export function ItemStory({ order, history, waiting }: { order: any; history: any[]; waiting: boolean }) {
  const lines = useMemo(() => storyOf(order, history), [order, history]);
  return (
    <div className="rounded-2xl border border-takal-line bg-white p-5" data-testid="item-story">
      <div className="text-[17px] font-bold text-takal-ink">History of {orderLabel(order, order?.order_id || order?.id)}</div>
      <ol className="relative isolate mt-3">
        {lines.map((l, i) => (
          <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
            {i < lines.length - 1 || waiting ? (
              <span className="absolute left-[7px] top-4 h-full w-px bg-takal-line" aria-hidden />
            ) : null}
            <span className={`relative z-[1] mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white ${DOT[l.dot].ring}`}>
              <span className={`rounded-full ${l.dot === "yellow" ? "h-2.5 w-2.5" : "h-1.5 w-1.5"} ${DOT[l.dot].fill}`} />
            </span>
            <span className="w-11 flex-shrink-0 pt-px text-[13px] font-semibold text-takal-ink-soft">{hhmm(l.at)}</span>
            <span className="text-[14px] leading-snug text-takal-ink"><Words text={l.text} /></span>
          </li>
        ))}
        {waiting ? (
          <li className="relative flex gap-3">
            <span className="relative z-[1] mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            </span>
            <span className="w-11 flex-shrink-0 text-[13px] text-takal-ink-soft">…</span>
            <span className="text-[14px] text-takal-ink-soft">Your call and her answer are written here</span>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

// ── WHAT IS MISSING (the small box) ────────────────────────────────────────

function MissingBox({ row }: { row: any }) {
  const m = row?.money || {};
  return (
    <div className="rounded-xl border border-takal-line bg-takal-page p-4">
      <div className="text-[12px] font-black uppercase tracking-wider text-takal-ink-soft">What is missing</div>
      <div className="mt-2 space-y-2">
        {(row?.missing || []).map((x: any, i: number) => {
          const chip = missingChip(x);
          return (
            <div key={i} className="flex items-center gap-3">
              <Thumb url={x.image} />
              <span className="min-w-0 flex-1 text-[15px] leading-snug text-takal-ink">{x.name}</span>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold ${
                chip.tone === "red" ? "bg-takal-red-soft text-takal-red" : "bg-takal-yellow-soft text-[#8A5300]"}`}>
                {chip.text}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-takal-line pt-3 text-[15px]">
        <span className="text-takal-ink">Total now</span>
        <span>
          <b>{money(m.total_now)}</b>{" "}
          {m.total_before != null && Number(m.total_before) !== Number(m.total_now) ? (
            <s className="text-takal-ink-soft">{money(m.total_before)}</s>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ── THE RED CARD ───────────────────────────────────────────────────────────

/** Three answers after the call. `onDone` reloads the list. */
function Answers({ orderId, total, onDone }: { orderId: string; total: any; onDone: () => void }) {
  const [busy, setBusy] = useState<"" | "keep" | "more_time" | "cancel">("");
  const [askCancel, setAskCancel] = useState(false);
  const send = async (answer: "keep" | "more_time" | "cancel") => {
    setBusy(answer);
    try {
      const r = (await apiClient.answerItemChange(orderId, answer)) as any;
      toast(r?.message || "Saved", "success");
      onDone();
    } catch (err) {
      toast(errorMessage(err, "her answer"), "error");
    } finally {
      setBusy("");
      setAskCancel(false);
    }
  };
  return (
    <div>
      <div className="text-[12px] font-black uppercase tracking-wider text-takal-ink-soft">After the call — what did she say?</div>
      <div className="mt-2 flex flex-wrap gap-3">
        <Button size="lg" loading={busy === "keep"} disabled={!!busy} onClick={() => send("keep")}
          icon={<Check className="h-4 w-4" />} className="!border-takal-ink" data-testid="answer-keep">
          Keep the rest · {money(total)}
        </Button>
        <Button size="lg" variant="secondary" loading={busy === "more_time"} disabled={!!busy}
          onClick={() => send("more_time")} icon={<Plus className="h-4 w-4" />} className="!border-takal-ink"
          data-testid="answer-more">
          She will add items · {WAIT_MINUTES} more min
        </Button>
        <Button size="lg" variant="secondary" disabled={!!busy} onClick={() => setAskCancel(true)}
          className="!border-takal-red !text-takal-red hover:!bg-takal-red-soft" data-testid="answer-cancel">
          Cancel whole order · no strike
        </Button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-takal-ink-soft">
        No answer on the phone either? Choose <b className="text-takal-ink">Keep the rest</b> — she can still refuse at the
        door, or cancel later without a strike. Every press is written in the order&apos;s history with your name.
      </p>
      <ConfirmDialog
        open={askCancel}
        onCancel={() => setAskCancel(false)}
        onConfirm={() => send("cancel")}
        busy={busy === "cancel"}
        title="Cancel the whole order?"
        message="She asked to cancel on the phone. The order ends with no strike for her, the shop is told, and anything she paid is given back."
        confirmLabel="Yes, cancel it - no strike"
        cancelLabel="No, go back"
      />
    </div>
  );
}

export function NeedsCallCard({ row, onDone }: { row: any; onDone: () => void }) {
  const id = String(row?.order_id || row?.id || "");
  const kind = [verticalLabel(row?.store_kind), row?.price_mode === "fixed" ? "fixed prices" : ""]
    .filter((x) => x && x !== "—").join(" · ");
  const who = [row?.customer_name, areaOf(row?.delivery_address)].filter(Boolean).join(" · ");
  const tel = telHref(row?.customer_phone);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" data-testid="needs-call-row">
      <div className="overflow-hidden rounded-2xl border-2 border-takal-red/40 bg-white shadow-[0_8px_30px_rgba(214,40,57,0.12)]">
        <div className="flex items-center justify-between gap-3 bg-takal-red px-5 py-3 text-white">
          <span className="flex items-center gap-2 text-[16px] font-bold">
            <Phone className="h-5 w-5 flex-shrink-0" /> The customer did not answer about a missing item
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-0.5 text-[13px] font-bold text-takal-red">
            <Clock className="h-3.5 w-3.5" /> {row?.minutes_waiting ?? 0} min
          </span>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[24px] font-black text-takal-ink">{orderLabel(row, id)}</span>
            <span className="text-[16px] text-takal-ink">{[row?.store_name, kind].filter(Boolean).join(" · ")}</span>
            <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-[12px] font-bold text-takal-green">
              {statusWords(row?.status)} · waiting
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="rounded-xl border border-takal-line bg-takal-page p-4">
              <div className="text-[12px] font-black uppercase tracking-wider text-takal-ink-soft">Call her</div>
              <div className="mt-1 text-[16px] font-semibold text-takal-ink">{who || "—"}</div>
              <div className="whitespace-nowrap text-[28px] font-black tabular-nums leading-tight text-takal-ink" data-testid="call-phone">
                {phoneForCall(row?.customer_phone) || "No phone number"}
              </div>
              {tel ? (
                <a href={tel}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-takal-green px-4 py-2.5 text-[15px] font-bold text-white hover:brightness-110">
                  <Phone className="h-4 w-4" /> Call now
                </a>
              ) : null}
            </div>
            <MissingBox row={row} />
          </div>
          <Answers orderId={id} total={row?.money?.total_now} onDone={onDone} />
        </div>
      </div>
      <ItemStory order={row} history={row?.history || []} waiting />
    </div>
  );
}

// ── ON THE ORDER'S OWN PAGE ────────────────────────────────────────────────

/** The office's "What is missing?" window - the shop's window, with HER money
 *  shown too (the office answers her questions on the phone). */
function MissingWindow({
  open, onClose, orderId, items, onSaved,
}: { open: boolean; onClose: () => void; orderId: string; items: any[]; onSaved: () => void }) {
  const lines = (items || []).filter((it) => it && it.id);
  const [choice, setChoice] = useState<Record<string, "all" | "some" | "none">>({});
  const [some, setSome] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  // Each product's photo, as on the shop's window (board 1). The order's own
  // item-change view carries them; if it cannot be read the soft square shows.
  const [photos, setPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const v = (await apiClient.getItemChange(orderId)) as any;
        const m: Record<string, string> = {};
        for (const l of [...(v?.lines_now || []), ...(v?.missing || [])]) {
          if (l?.menu_item_id && l?.image) m[String(l.menu_item_id)] = String(l.image);
        }
        if (alive) setPhotos(m);
      } catch {
        if (alive) setPhotos({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, orderId]);

  const qty = (it: any) => Math.max(1, Number(it.quantity) || 1);
  const have = (it: any) => {
    const c = choice[it.id] || "all";
    if (c === "none") return 0;
    if (c === "some") return Math.min(Math.max(1, some[it.id] ?? qty(it) - 1), Math.max(1, qty(it) - 1));
    return qty(it);
  };
  const body = lines.filter((it) => have(it) < qty(it)).map((it) => ({ line_id: String(it.id), have: have(it) }));
  const key = JSON.stringify(body);

  useEffect(() => {
    if (!open) return;
    setProblem("");
    if (!body.length) {
      setPreview(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.markItemsMissing(orderId, body, true);
        if (alive) setPreview(r);
      } catch (err) {
        if (alive) {
          setPreview(null);
          setProblem(errorMessage(err, "the new figures"));
        }
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open, orderId]);

  const save = async () => {
    setSaving(true);
    setProblem("");
    try {
      const r = (await apiClient.markItemsMissing(orderId, body)) as any;
      toast(r?.message || "The customer has been asked.", "success");
      onSaved();
      onClose();
    } catch (err) {
      setProblem(errorMessage(err, "this change"));
    } finally {
      setSaving(false);
    }
  };

  const c = preview?.customer;
  return (
    <Modal open={open} onClose={onClose} size="lg" title="What is missing?"
      hint="Choose what the shop cannot give. The customer is asked before the shop packs; packing is locked for 10 minutes."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Back</Button>
          <Button onClick={save} loading={saving} disabled={!body.length} data-testid="missing-send">
            Tell the customer
          </Button>
        </div>
      }>
      <div className="space-y-3">
        {lines.map((it) => {
          const c0 = choice[it.id] || "all";
          const q = qty(it);
          return (
            <div key={it.id} className="flex gap-3 rounded-xl border border-takal-line p-3" data-testid={`missing-line-${it.id}`}>
              <Thumb url={photos[String(it.menu_item_id)]} />
              <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-takal-ink">
                {it.item_name || it.product_name || "Item"}
                {it.variant_label ? <span className="font-normal text-takal-ink-soft"> · {it.variant_label}</span> : null}
                <span className="font-normal text-takal-ink-soft"> · ordered {q}</span>
              </div>
              {c0 === "some" && q > 1 ? (
                <div className="mt-2 flex items-center overflow-hidden rounded-lg border-2 border-takal-ink">
                  <button className="px-3 py-1.5" aria-label="One fewer"
                    onClick={() => {
                      const n = (some[it.id] ?? q - 1) - 1;
                      if (n <= 0) setChoice({ ...choice, [it.id]: "none" });
                      else setSome({ ...some, [it.id]: n });
                    }}><Minus className="h-4 w-4" /></button>
                  <span className="flex-1 border-x-2 border-takal-ink bg-takal-yellow-soft py-1.5 text-center text-[14px] font-black text-[#8A5300]">
                    Have {have(it)} of {q}
                  </span>
                  <button className="px-3 py-1.5" aria-label="One more"
                    onClick={() => {
                      const n = (some[it.id] ?? q - 1) + 1;
                      if (n >= q) setChoice({ ...choice, [it.id]: "all" });
                      else setSome({ ...some, [it.id]: n });
                    }}><Plus className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-takal-page p-1" role="radiogroup">
                  {(["all", "some", "none"] as const).map((v) => {
                    const on = c0 === v;
                    const off = v === "some" && q < 2;
                    return (
                      <button key={v} role="radio" aria-checked={on} disabled={off}
                        data-testid={`seg-${v}-${it.id}`}
                        onClick={() => {
                          setChoice({ ...choice, [it.id]: v });
                          if (v === "some") setSome({ ...some, [it.id]: q - 1 });
                        }}
                        className={`rounded-md py-1.5 text-[13px] font-bold ${
                          on && v === "none" ? "bg-takal-red text-white"
                          : on ? "bg-white text-takal-ink shadow"
                          : off ? "text-slate-400" : "text-takal-ink-soft hover:text-takal-ink"}`}>
                        {on && v === "none" ? "None left" : v === "all" ? "All there" : v === "some" ? "Some" : "None"}
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          );
        })}

        {body.length ? (
          <div className="grid gap-3 rounded-xl bg-takal-ink p-4 text-white sm:grid-cols-2" data-testid="missing-figures">
            <div>
              <div className="text-[12px] text-slate-300">She pays</div>
              <div className="text-[18px] font-black">
                {c ? <><s className="mr-2 text-[13px] font-semibold text-slate-400">{money(c.total_before)}</s>{money(c.total_after)}</> : "…"}
              </div>
              {c && Number(c.discount_before) > 0 ? (
                <div className="text-[12px] text-slate-300">Promo {money(c.discount_before)} → {money(c.discount_after)}</div>
              ) : null}
            </div>
            <div>
              <div className="text-[12px] text-slate-300">The shop gets · pieces</div>
              <div className="text-[18px] font-black text-takal-yellow">
                {preview ? <><s className="mr-2 text-[13px] font-semibold text-slate-400">{money(preview.shop_gets_before)}</s>{money(preview.shop_gets_after)}</> : "…"}
              </div>
              {preview ? <div className="text-[12px] text-slate-300">{preview.pieces_before} → {preview.pieces_after} pieces</div> : null}
            </div>
          </div>
        ) : null}
        {preview?.all_missing ? (
          <p className="rounded-lg bg-takal-red-soft px-3 py-2 text-[13px] font-bold text-takal-red">
            Nothing is left, so the order will end and the customer is told.
          </p>
        ) : null}
        {preview?.out_of_stock?.length ? (
          <p className="flex items-start gap-2 rounded-lg bg-takal-red-soft px-3 py-2 text-[13px] font-bold text-takal-red">
            <Tag className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {preview.out_of_stock.join(", ")} will show Out of stock in the shop until it adds stock.
          </p>
        ) : null}
        {problem ? <p className="text-[13px] font-bold text-takal-red" data-testid="missing-problem">{problem}</p> : null}
      </div>
    </Modal>
  );
}

/**
 * On the order's page: while she chooses - a note and how long is left; once
 * the time is up - a link to Needs a call; anything that changed - the
 * history; and the office's own "Mark an item not available".
 */
export function ItemChangeBox({
  orderId, order, items, onChanged,
}: { orderId: string; order: any; items: any[]; onChanged: () => void }) {
  const [view, setView] = useState<any>(null);
  const [failed, setFailed] = useState("");
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  const asked = String(order?.missing_asked_at ?? "").trim() !== "";
  const waiting = isWaiting(order);

  useEffect(() => {
    if (!itemChangeReady(order) || !asked) return;
    let alive = true;
    (async () => {
      try {
        const v = await apiClient.getItemChange(orderId);
        if (alive) setView(v);
      } catch (err) {
        if (alive) setFailed(errorMessage(err, "what changed on this order"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, asked, order?.waiting_for_customer_until, order?.customer_answer, order]);

  // The clock on the waiting note. Only while she is choosing.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  if (!itemChangeReady(order)) return null;
  const left = secondsLeft(order);
  return (
    <div className="space-y-3" data-testid="item-change-box">
      {waiting ? (
        left > 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-takal-orange-soft px-4 py-3 text-[14px] text-takal-ink">
            <Clock className="h-4 w-4 text-takal-orange" />
            <span><b>Waiting for the customer to choose</b> — {clock(left)} left. The shop cannot pack until she answers;
              after {WAIT_MINUTES} minutes it goes to Needs a call.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-takal-red-soft px-4 py-3 text-[14px] text-takal-ink">
            <Phone className="h-4 w-4 text-takal-red" />
            <span><b>She did not answer in {WAIT_MINUTES} minutes.</b> Phone her from Needs a call.</span>
            <Link href="/dashboard/orders/needs-call" className="font-bold text-takal-red underline">Open Needs a call →</Link>
          </div>
        )
      ) : null}
      {officeMayMark(order) && (items || []).some((it) => it?.id) ? (
        <button onClick={() => setOpen(true)} data-testid="office-not-available"
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-takal-red bg-white px-3 py-1 text-[13px] font-bold text-takal-red hover:bg-takal-red-soft">
          <X className="h-3.5 w-3.5" /> Mark an item not available
        </button>
      ) : null}
      {failed ? <p className="text-[13px] text-takal-red">{failed}</p> : null}
      {view?.history?.length ? (
        <ItemStory order={{ ...order, ...view, store_name: view.store_name || order?.restaurant_name }}
          history={view.history} waiting={waiting} />
      ) : null}
      <MissingWindow open={open} onClose={() => setOpen(false)} orderId={orderId} items={items}
        onSaved={onChanged} />
    </div>
  );
}
