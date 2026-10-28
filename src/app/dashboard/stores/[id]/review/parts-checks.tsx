"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE REVIEW PAGE'S OWN CHECKS  (Mock 215, Sana 28 Oct 2026)
//
//   * RiskPanel     - the one colour for the shop (item 9) and the lines behind it
//   * ContactCard   - every phone number / website found, in words or on a
//                     picture; Approve stays locked while any is left
//   * SameShopCard  - other shops with the same phone, owner or bank account (item 1)
//   * MessagesNotes - every WhatsApp message sent (kept), and office notes (item 8)
//   * WaLangSwitch / WaPreview - English · اردو · Roman for WhatsApp only
//   * usePictureScan - reads every picture in this browser, one at a time (items 11, 4)
// The rules themselves are in lib/review-rules.ts; the server holds the lock.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
// Urdu in Nastaliq - the script it is read in (the shelf manager's own font,
// served from the panel; fetched only when Urdu is on screen).
import { urduFont } from "../../catalogue/urdu-font";
import { apiClient } from "@/lib/api-client";
import { checkPicture, qualityWords, type PictureCheck } from "@/lib/picture-check";
import { CONTACT_WORDS, westernDigits, type ContactHit } from "@/lib/contact-info";
import { WA_LANGS, type WaLang } from "@/lib/whatsapp-words";
import type { Found, RiskLevel, RiskLine } from "@/lib/review-rules";
import type { SameShop, ShopMessage, ShopReviewPage } from "@/lib/shop-review";

const when = (at?: string | null) => {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? ""
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
};

const TONE: Record<RiskLevel, { box: string; dot: string; chip: string }> = {
  red: { box: "border-takal-red bg-[#FFF1F2]", dot: "bg-takal-red", chip: "bg-takal-red text-white" },
  amber: { box: "border-[#E8A400] bg-[#FFF8E1]", dot: "bg-[#E8A400]", chip: "bg-[#FFC72C] text-black" },
  green: { box: "border-takal-green bg-takal-green-soft", dot: "bg-takal-green", chip: "bg-takal-green text-white" },
};

/** The badge beside the shop's name. */
export function RiskBadge({ level, title }: { level: RiskLevel; title: string }) {
  return (
    <span data-risk={level} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-black tracking-wide ${TONE[level].chip}`}>
      <span className="h-2 w-2 rounded-full bg-white/90" /> {title}
    </span>
  );
}

/** Words with every phone number / website in them marked red. */
export function Marked({ text, hits }: { text: string; hits: ContactHit[] }) {
  const t = String(text || "");
  if (!hits.length) return <>{t}</>;
  // Find each hit in the words as they are written (Urdu digits too).
  const plain = westernDigits(t);
  const spans: [number, number][] = [];
  for (const h of hits) {
    const at = plain.toLowerCase().indexOf(h.text.toLowerCase());
    if (at >= 0) spans.push([at, at + h.text.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let i = 0;
  spans.forEach(([a, b], k) => {
    if (a < i) return;
    out.push(t.slice(i, a));
    out.push(<mark key={k} className="rounded bg-[#FFD6DA] px-0.5 font-bold text-takal-red">{t.slice(a, b)}</mark>);
    i = b;
  });
  out.push(t.slice(i));
  return <>{out}</>;
}

export function RiskPanel({ level, title, lines, progress, scanning, paused, onPause, onResume }: {
  level: RiskLevel; title: string; lines: RiskLine[];
  progress: { done: number; total: number }; scanning: boolean; paused: boolean;
  onPause: () => void; onResume: () => void;
}) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 100;
  return (
    <div data-risk-panel className={`rounded-xl border-[1.5px] px-4 py-3 ${TONE[level].box}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${TONE[level].dot}`} />
        <b className="text-[14px] text-takal-ink">Takal check: {title}</b>
        <span className="text-[12px] text-takal-ink-soft">- read by the panel itself; you still decide</span>
        <span className="ml-auto flex items-center gap-2 text-[12px]">
          {progress.total > 0 && progress.done < progress.total && (
            <>
              <span className="font-bold text-takal-ink">{scanning && !paused ? "Reading pictures…" : "Paused"} {progress.done} of {progress.total}</span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white"><span className="block h-full bg-black" style={{ width: `${pct}%` }} /></span>
              <button type="button" onClick={paused ? onResume : onPause}
                className="rounded-md border border-black bg-white px-2 py-0.5 text-[11.5px] font-bold">{paused ? "Go on" : "Pause"}</button>
            </>
          )}
        </span>
      </div>
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {lines.map((l, k) => (
          <li key={k} className="flex items-center gap-2 text-[12.5px] text-takal-ink">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${l.ok ? "bg-takal-green" : l.level === "red" ? "bg-takal-red" : "bg-[#E8A400]"}`}>{l.ok ? "✓" : "!"}</span>
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContactCard({ finds, canMark = true, marked, onSee, onMarkFix, onNotContact }: {
  finds: Found[];
  /** A waiting shop: each find can be marked Needs fix here. */
  canMark?: boolean;
  /** Things already marked Needs fix - their button says so. */
  marked: (key: string) => boolean;
  onSee: (f: Found) => void;
  onMarkFix: (f: Found) => void;
  onNotContact: (f: Found) => void;
}) {
  if (!finds.length) return null;
  return (
    <div data-contact-card className="overflow-hidden rounded-xl border-[1.5px] border-takal-red bg-white">
      <div className="flex flex-wrap items-center gap-2 bg-takal-red px-4 py-2.5 text-white">
        <b className="inline-flex items-center gap-1.5 text-[14px]"><PhoneOff className="h-4 w-4" /> Phone number or website found - this shop cannot be approved</b>
        <span className="text-[12px] opacity-90">Takal rule: customers order through Takal, not by phone. Nobody can approve it until these are removed.</span>
      </div>
      <div className="divide-y divide-[#F3D3D6]">
        {finds.map((f, k) => (
          <div key={`${f.key}-${f.url || f.field}-${k}`} data-find={f.where} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            {f.url ? (
              <button type="button" onClick={() => onSee(f)} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-takal-red">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-takal-red text-center text-[9.5px] font-bold text-white">see</span>
              </button>
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F2] text-[22px]">✎</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-takal-ink">
                {f.label} <span className="font-semibold text-takal-ink-soft">· {f.where === "picture" ? "on the picture" : `in the ${f.field || "words"}`}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {f.hits.map((h, i) => (
                  <span key={i} className="rounded-full bg-[#FFD6DA] px-2 py-0.5 text-[11.5px] font-bold text-takal-red">
                    {h.kind === "phone" ? "📞" : h.kind === "website" ? "🌐" : h.kind === "email" ? "✉" : "💬"} {CONTACT_WORDS[h.kind]}: {h.text}
                  </span>
                ))}
              </div>
              {f.excerpt && <div className="mt-1 line-clamp-2 text-[12px] text-takal-ink-soft">“<Marked text={f.excerpt} hits={f.hits} />”</div>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {!canMark ? null : marked(f.key)
                ? <span data-find-marked className="rounded-lg bg-takal-orange-soft px-3 py-1 text-[12px] font-bold text-[#B23E10]">✓ In the fix list</span>
                : <button type="button" data-mark-find onClick={() => onMarkFix(f)}
                    className="rounded-lg border-[1.5px] border-[#B23E10] bg-takal-orange px-3 py-1 text-[12px] font-bold text-black hover:shadow-[0_2px_0_#000]">
                    ! Needs fix - remove it
                  </button>}
              {f.where === "picture" && (
                <button type="button" data-not-contact onClick={() => onNotContact(f)}
                  className="text-[11px] font-semibold text-takal-ink-soft underline hover:text-takal-ink">
                  I looked - this is not a phone number
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_WORDS: Record<string, string> = {
  approved: "live", hidden: "approved, hidden", pending: "waiting", rejected: "REJECTED", suspended: "suspended",
};

export function SameShopCard({ twins }: { twins: SameShop[] }) {
  if (!twins.length) return null;
  return (
    <div data-same-shop className="rounded-xl border-[1.5px] border-[#E8A400] bg-[#FFF8E1] px-4 py-3">
      <b className="text-[13.5px] text-takal-ink">⚠ The same as {twins.length === 1 ? "another shop" : `${twins.length} other shops`}?</b>
      <span className="ml-2 text-[12px] text-takal-ink-soft">A second branch is fine - a shop Takal turned down coming back is not.</span>
      <ul className="mt-1.5 space-y-1">
        {twins.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <Link href={`/dashboard/stores/${t.id}`} className="font-bold text-takal-ink underline">{t.name}</Link>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.status === "rejected" ? "bg-takal-red text-white" : "bg-white text-takal-ink"}`}>{STATUS_WORDS[t.status] || t.status}</span>
            <span className="text-takal-ink">{t.why.join(" · ")}</span>
            {t.rejected_reason && <span className="text-takal-red">- rejected because: {t.rejected_reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WaLangSwitch({ lang, onChange, small }: { lang: WaLang; onChange: (l: WaLang) => void; small?: boolean }) {
  return (
    <div data-wa-lang role="radiogroup" aria-label="WhatsApp language"
      className="inline-flex overflow-hidden rounded-lg border-[1.5px] border-black bg-white">
      {WA_LANGS.map((l) => (
        <button key={l.key} type="button" role="radio" aria-checked={lang === l.key} onClick={() => onChange(l.key)}
          className={`${small ? "px-2 py-0.5 text-[11.5px]" : "px-3 py-1 text-[12.5px]"} font-bold ${lang === l.key ? "bg-takal-yellow text-black" : "text-takal-ink-soft hover:bg-takal-page"} ${l.key === "ur" ? urduFont.className : ""}`}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** The message exactly as WhatsApp will open with it. */
export function WaPreview({ lang, text, number }: { lang: WaLang; text: string; number?: string | null }) {
  return (
    <div data-wa-preview className="rounded-xl bg-[#E9E2D8] p-3">
      <div className="mb-1.5 text-[11.5px] font-bold text-[#54656F]">WhatsApp {number ? `to 0${String(number).slice(2)}` : ""} · {lang === "ur" ? "اردو" : lang === "roman" ? "Roman Urdu" : "English"}</div>
      <div dir={lang === "ur" ? "rtl" : "ltr"}
        className={`max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg rounded-tl-none bg-[#D9FDD3] px-3 py-2 text-[13px] leading-relaxed text-[#111B21] shadow-sm ${lang === "ur" ? `${urduFont.className} text-right text-[14px] leading-[2.3]` : ""}`}>
        {text}
      </div>
    </div>
  );
}

const KIND_WORDS: Record<ShopMessage["kind"], string> = {
  whatsapp: "WhatsApp", sent_back: "Sent back + WhatsApp", what_is_left: "WhatsApp - what is left", note: "Note",
};

export function MessagesNotes({ messages, notes, onAddNote }: {
  messages: ShopMessage[]; notes: ShopMessage[]; onAddNote: (text: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"messages" | "notes">("messages");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = tab === "messages" ? messages : notes;
  return (
    <section data-messages className="mb-3 overflow-hidden rounded-xl border border-takal-line bg-white">
      <div className="flex items-center gap-1 bg-takal-page px-3 py-2">
        {(["messages", "notes"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 text-[13px] font-bold ${tab === t ? "bg-black text-takal-yellow" : "text-takal-ink hover:bg-white"}`}>
            {t === "messages" ? `Messages sent (${messages.length})` : `Office notes (${notes.length})`}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] text-takal-ink-soft">
          {tab === "messages" ? "Every WhatsApp message to this shop, as it was sent" : "Only the office sees these - never the vendor"}
        </span>
      </div>
      {tab === "notes" && (
        <div className="flex gap-2 border-b border-[#EFEFEF] px-3 py-2.5">
          <input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note for the office - e.g. Called the owner, he will send the shop board photo tomorrow"
            className="min-w-0 flex-1 rounded-lg border border-[#D0D0D0] px-3 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-takal-yellow" />
          <button type="button" disabled={busy || draft.trim().length < 2}
            onClick={async () => { setBusy(true); if (await onAddNote(draft.trim())) setDraft(""); setBusy(false); }}
            className="rounded-lg border-[1.5px] border-black bg-takal-yellow px-3 py-1.5 text-[13px] font-bold disabled:opacity-50">
            {busy ? "Saving…" : "Add note"}
          </button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-takal-ink-soft">{tab === "messages" ? "No WhatsApp message sent yet." : "No notes yet."}</p>
      ) : (
        <ul className="divide-y divide-[#EFEFEF]">
          {list.map((m) => (
            <li key={m.id} className="px-4 py-2">
              <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center gap-2 text-left">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.kind === "note" ? "bg-takal-blue-soft text-takal-blue" : "bg-takal-green-soft text-takal-green"}`}>
                  {KIND_WORDS[m.kind]}{m.lang ? ` · ${m.lang === "ur" ? "اردو" : m.lang === "roman" ? "Roman" : "English"}` : ""}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[12.5px] text-takal-ink ${m.lang === "ur" ? `${urduFont.className} leading-[2]` : ""}`} dir={m.lang === "ur" ? "rtl" : "ltr"}>
                  {m.text.split("\n").filter(Boolean).slice(m.kind === "note" ? 0 : 1, m.kind === "note" ? 1 : 2).join(" ")}
                </span>
                <span className="shrink-0 text-[11.5px] text-takal-ink-soft">{m.by_name ? `${m.by_name} · ` : ""}{when(m.at)}</span>
              </button>
              {open === m.id && (
                <div dir={m.lang === "ur" ? "rtl" : "ltr"}
                  className={`mt-2 whitespace-pre-wrap rounded-lg bg-[#F6F6F2] px-3 py-2 text-[12.5px] text-takal-ink ${m.lang === "ur" ? `${urduFont.className} text-right leading-[2.3]` : ""}`}>
                  {m.text}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** READ EVERY PICTURE, one at a time, logo first (items 11 + 4). What it reads
 *  is sent to the server in small batches, so the lock holds for everybody
 *  and a second reviewer does not read them again. */
export function usePictureScan(id: string, page: ShopReviewPage | null, start: boolean) {
  const [local, setLocal] = useState<Record<string, PictureCheck>>({});
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  const pending = useRef<PictureCheck[]>([]);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const flush = useCallback(async () => {
    const batch = pending.current.splice(0);
    if (!batch.length) return;
    try { await apiClient.savePictureChecks(id, batch); } catch { pending.current.unshift(...batch); }
  }, [id]);

  useEffect(() => {
    if (!start || !page?.pictures?.list?.length || busy.current) return;
    const saved = page.pictures.checks || {};
    const todo = page.pictures.list.filter((p) => !saved[p.url]);
    if (!todo.length) return;
    busy.current = true;
    setRunning(true);
    (async () => {
      for (const p of todo) {
        while (pausedRef.current) await new Promise((r) => setTimeout(r, 300));
        const c = await checkPicture(p.url, p.key === "logo");
        if (c.failed) continue;           // tried again next time the page opens
        setLocal((was) => ({ ...was, [p.url]: c }));
        pending.current.push({ ...c, key: p.key } as PictureCheck);
        if (pending.current.length >= 5) await flush();
      }
      await flush();
      setRunning(false);
    })();
  }, [start, page, flush]);

  return { local, setLocal, paused, setPaused, running };
}

export { qualityWords };
