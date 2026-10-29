"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW A NEW SHOP.  (Mock 207-2 / 207-3 / 207-4, approved by Sana 23 Oct 2026)
//
// "when a new Vendor get register ... I want to review that Vendors In Admin
// Panel but Its Not Easy And Simple and If there is any Issue in Pictures
// uploaded or any other details ... how can i tell that Vendor."
//
// ONE page: owner, shop details, logo, location, every product photo, money.
// Each thing has ✓ OK / ! Needs fix; Needs fix opens ready reasons (the vendor
// reads these exact words) and a box for your own words. The black WHAT TO
// FIX list builds itself. Then:
//   * Send back for changes - the shop STAYS waiting; the vendor is told in
//     the Partners app and, if ticked, WhatsApp opens with the list written
//   * Approve - only when nothing is marked Needs fix; it stays HIDDEN from
//     customers until the main admin switches on Show to customers
//   * Reject - as before
// The server decides every rule (backend/routers/shop_review.py); this page
// only draws them. On a tablet or phone the list becomes a black bar at the
// bottom (Mock 207-3).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";
import { getMyPerms } from "@/lib/perms";
import { verticalEmoji } from "@/lib/verticals";
import { hoursInWords } from "@/lib/shop-hours";
import { ConfirmDialog, ErrorState, Modal } from "@/components/ui";
import { RejectReasonDialog, SHOP_REASONS } from "@/components/RejectReasonDialog";
import {
  REVIEW_SECTIONS, productKey, reasonsFor, fixedKeysFor, licenceMayBeMarkedOk, productsMayBeMarkedOk, PRODUCTS_LINE, PRODUCTS_NEEDED, fixesFromMarks, fixesMissingAReason, checkedCount,
  whatsappLink, REASON_MAX, WORDS_MAX,
  type ReviewMark, type ShopReviewPage, type ReviewProduct,
} from "@/lib/shop-review";
import { LICENCE_STATE, licenceDate } from "@/lib/shop-licence";
// MOCK 215 (Sana 28 Oct 2026): pictures whole, the phone-number lock, the
// shop's colour, the same-shop warning, messages kept, office notes, and the
// WhatsApp message in English / اردو / Roman.
import { PictureViewer, type FoundBox } from "@/components/PictureViewer";
import { allChecks, contactFinds, contactLock, findsFor, pictureProgress, riskOf, type Found } from "@/lib/review-rules";
import { rememberWaLang, savedWaLang, sendBackMessage, type WaLang } from "@/lib/whatsapp-words";
import type { SavedPictureCheck, ShopMessage } from "@/lib/shop-review";
import {
  ContactCard, Marked, MessagesNotes, RiskBadge, RiskPanel, SameShopCard, WaLangSwitch, WaPreview, qualityWords, usePictureScan,
} from "./parts-checks";

/** The ready reason for a phone number / website, by where it was found. */
function reasonForFind(f: Found): string {
  if (f.key === "logo") return "Has a phone number or website on it";
  if (f.key.startsWith("product:")) return f.where === "picture" ? "Phone number or website on the photo" : "Phone number or website in the description";
  if (f.key === "shop.name") return "Has a phone number or city in the name";
  return "Has a phone number or website - remove it";
}

const day = (at?: string | null) => {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? ""
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
};

function Pill({ on, kind, onClick, small }: { on: boolean; kind: "ok" | "fix"; onClick: () => void; small?: boolean }) {
  const base = `whitespace-nowrap rounded-full border-[1.5px] font-bold transition ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-[12.5px]"}`;
  const look = kind === "ok"
    ? (on ? "border-takal-green bg-takal-green text-white" : "border-[#BDBDBD] bg-white text-[#333] hover:border-takal-green hover:bg-takal-green-soft hover:text-takal-green")
    : (on ? "border-[#B23E10] bg-takal-orange text-black" : "border-[#BDBDBD] bg-white text-[#333] hover:border-takal-orange hover:bg-takal-orange-soft hover:text-[#B23E10]");
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${base} ${look}`}>
      {kind === "ok" ? "✓ OK" : "! Needs fix"}
    </button>
  );
}

function ReasonBox({ m, chips, onChange, onDone }: {
  m: ReviewMark; chips: string[]; onChange: (m: ReviewMark) => void; onDone: () => void;
}) {
  return (
    <div className="mx-4 mb-3 rounded-xl border-[1.5px] border-takal-orange bg-takal-orange-soft p-3 sm:ml-[160px]">
      <p className="mb-2 text-[12px] font-bold text-takal-ink">What is wrong? Pick one (the vendor sees these words)</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const on = m.reason === c;
          return (
            <button key={c} type="button" aria-pressed={on}
              onClick={() => onChange({ ...m, state: "fix", reason: on ? undefined : c })}
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${on ? "bg-black text-takal-yellow" : "border border-[#D0D0D0] bg-[#EFEFEF] text-[#333] hover:bg-white"}`}>
              {on ? "✓ " : ""}{c}
            </button>
          );
        })}
      </div>
      <input
        defaultValue={m.words || ""}
        maxLength={m.reason ? WORDS_MAX : REASON_MAX}
        onBlur={(e) => { if ((e.target.value || "") !== (m.words || "")) onChange({ ...m, state: "fix", words: e.target.value }); }}
        placeholder={chips.length ? "Extra words for the vendor (optional)" : "Write what is wrong (the vendor reads this)"}
        className="mt-2 w-full rounded-lg border border-[#D0D0D0] bg-white px-3 py-1.5 text-[13px] text-takal-ink outline-none focus:ring-2 focus:ring-takal-yellow"
      />
      <div className="mt-1.5 flex items-center gap-3">
        <span className="text-[11.5px] text-takal-ink-soft">{m.reason ? "Optional - example: Please send the logo from your sign board." : "Pick a reason or write your own."}</span>
        <button type="button" onClick={onDone} className="ml-auto text-[12px] font-bold text-takal-ink underline">Done</button>
      </div>
    </div>
  );
}

function ItemRow({ label, k, m, waiting, open, onMark, onOpen, box, children }: {
  label: string; k: string; m: ReviewMark | undefined; waiting: boolean; open: boolean;
  onMark: (st: "ok" | "fix") => void; onOpen: () => void; box: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div data-review-item={k} className="border-t border-[#EFEFEF]">
      <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3.5">
        <div className="w-[130px] shrink-0 text-[12px] text-takal-ink-soft">{label}</div>
        <div className="min-w-0 flex-1 text-[13.5px] font-medium text-takal-ink">{children}</div>
        {waiting && (
          <div className="flex shrink-0 gap-1.5">
            <Pill on={m?.state === "ok"} kind="ok" onClick={() => onMark("ok")} />
            <Pill on={m?.state === "fix"} kind="fix" onClick={() => onMark("fix")} />
          </div>
        )}
      </div>
      {waiting && m?.state === "fix" && open && box}
      {waiting && m?.state === "fix" && !open && (
        <button type="button" onClick={onOpen}
          className="mx-4 mb-2.5 rounded-lg bg-takal-orange-soft px-3 py-1 text-left text-[12px] font-semibold text-[#B23E10] sm:ml-[160px]">
          ! {m.reason || m.words || "Choose what is wrong"} <span className="underline">change</span>
        </button>
      )}
    </div>
  );
}

function Section({ title, n, children, right }: { title: string; n: number; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-takal-line bg-white">
      <div className="flex items-center gap-2 bg-takal-page px-4 py-2.5">
        <b className="text-[14.5px] text-takal-ink">{n} · {title}</b>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      {children}
    </section>
  );
}

export default function ShopReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [data, setData] = useState<ShopReviewPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<ReviewProduct[]>([]);
  const [marks, setMarks] = useState<Record<string, ReviewMark>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "failed">("");
  const [checklist, setChecklist] = useState<any>(null);
  const [isMain, setIsMain] = useState(false);
  const [ask, setAsk] = useState<null | "send" | "approve" | "reject">(null);
  const [busy, setBusy] = useState(false);
  const [useWhatsapp, setUseWhatsapp] = useState(true);
  const [refused, setRefused] = useState("");
  // Mock 215-1: every picture opens whole, with ‹ › through the product's
  // photos and red boxes round anything found on it.
  const [view, setView] = useState<{ list: string[]; start: number; title: string; note?: string } | null>(null);
  const setBigPic = (url: string | null, title = "") => setView(url ? { list: [url], start: 0, title } : null);
  // Mock 215-3: WhatsApp in English / اردو / Roman - remembered in this browser.
  const [waLang, setWaLangState] = useState<WaLang>("en");
  const [showWa, setShowWa] = useState(false);
  const [extraMsgs, setExtraMsgs] = useState<ShopMessage[]>([]);
  const [extraNotes, setExtraNotes] = useState<ShopMessage[]>([]);
  const [cleared, setCleared] = useState<Record<string, SavedPictureCheck>>({});
  const dirty = useRef(false);

  useEffect(() => setIsMain(getMyPerms().isSuper), []);
  useEffect(() => setWaLangState(savedWaLang()), []);
  const setWaLang = (l: WaLang) => { setWaLangState(l); rememberWaLang(l); };

  const load = useCallback(async (p = 1, keepMarks = false) => {
    try {
      setLoading(true);
      setError("");
      const d = await apiClient.getShopReview(id, p);
      setData(d);
      setPage(p);
      setProducts((was) => (p === 1 ? d.products : [...was, ...d.products.filter((x) => !was.some((w) => w.id === x.id))]));
      if (!keepMarks) setMarks(d.review?.marks || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "The shop could not be read");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    // The server's own checklist (what is THERE). Its own read: if it fails,
    // the page still works and the server checks it again on Approve.
    apiClient.getShopChecklist(id).then(setChecklist).catch(() => setChecklist(null));
  }, [id]);

  const status = data?.shop?.status || "";
  const waiting = status === "pending";
  // THE REVIEW WORKS FOR APPROVED AND LIVE SHOPS TOO (Sana, 29 Oct 2026: "The
  // review can be done from admin panel of the approved store and live
  // stores"). Marking and Send back work for all three; Approve and Reject
  // only for a waiting shop.
  const reviewable = waiting || status === "hidden" || status === "approved";

  // ── MOCK 215: the pictures are read in this browser while you review ──
  // A shop approved before the rule but still hidden is checked too: Show to
  // customers is locked by the same rule (Mock 215).
  const checking = reviewable;
  const scan = usePictureScan(id, data, checking);
  const localChecks = useMemo(() => ({ ...scan.local, ...cleared }), [scan.local, cleared]);
  const finds = useMemo(() => contactFinds(data, localChecks), [data, localChecks]);
  const lock = contactLock(data, localChecks);
  const risk = riskOf(data, localChecks);
  const progress = pictureProgress(data, localChecks);
  const checksNow = allChecks(data, localChecks);
  const boxesNow = useMemo(() => {
    const o: Record<string, FoundBox[]> = {};
    for (const [u, c] of Object.entries(checksNow)) if (c?.boxes?.length && !(c as SavedPictureCheck).not_contact) o[u] = c.boxes;
    return o;
  }, [checksNow]);

  // THE TICKS ARE SAVED AS YOU GO (a refresh, or a second admin, sees them).
  useEffect(() => {
    if (!dirty.current || !reviewable) return;
    setSaving("saving");
    const t = setTimeout(async () => {
      try {
        await apiClient.saveShopReviewMarks(id, marks);
        dirty.current = false;
        setSaving("saved");
      } catch {
        setSaving("failed");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [marks, id, reviewable]);

  const setMark = (key: string, m: ReviewMark | null) => {
    dirty.current = true;
    setMarks((was) => {
      const now = { ...was };
      if (m) now[key] = m; else delete now[key];
      return now;
    });
  };
  const mark = (key: string, state: "ok" | "fix") => {
    const was = marks[key];
    if (was?.state === state) { setMark(key, null); if (state === "fix") setOpenKey(null); return; }
    setMark(key, state === "ok" ? { state: "ok" } : { state: "fix", reason: was?.reason, words: was?.words });
    setOpenKey(state === "fix" ? key : openKey === key ? null : openKey);
  };

  const keyLabel = (key: string) => {
    if (key.startsWith("product:")) {
      const p = products.find((x) => productKey(x.id) === key);
      return `${p?.name || "A product"} - photo and details`;
    }
    return data?.keys?.[key]?.label || key;
  };
  const fixedKeys = fixedKeysFor(data);
  const allKeys = [...fixedKeys, ...products.map((p) => productKey(p.id))];
  const total = fixedKeys.length + (data?.products_total ?? products.length);
  const checked = checkedCount(fixedKeys, marks)
    + Object.keys(marks).filter((k) => k.startsWith("product:") && (marks[k].state === "ok" || marks[k].state === "fix")).length;
  const fixes = useMemo(() => fixesFromMarks(marks), [marks]);
  const noReason = fixesMissingAReason(marks);
  const unchecked = allKeys.filter((k) => !marks[k]);
  // Mock 208-4: a pharmacy is never approved until its licence is marked OK.
  // The server holds the same lock (shop_licence.approval_problem).
  const licenceLocked = !!data?.licence?.needs_licence && marks.licence?.state !== "ok";

  const markRestOk = () => {
    dirty.current = true;
    setMarks((was) => {
      const now = { ...was };
      for (const k of allKeys) {
        if (k === "licence" && !licenceMayBeMarkedOk(data)) continue;
        // Not "OK" while the shop has fewer products than it needs.
        if (k === PRODUCTS_LINE && !productsMayBeMarkedOk(data)) continue;
        if (!now[k]) now[k] = { state: "ok" };
      }
      return now;
    });
  };

  // ── Send back ─────────────────────────────────────────────────────────────
  const sendBack = async () => {
    // A window opened in the click itself - a browser blocks one opened later.
    const wa = useWhatsapp && data?.whatsapp?.number ? window.open("about:blank", "_blank") : null;
    try {
      setBusy(true);
      const res = await apiClient.sendShopBack(id, fixes);
      // English: the server's own words, as always. اردو / Roman: written here
      // from the same list (lib/whatsapp-words.ts).
      const text = waLang === "en" && waiting ? (res?.whatsapp?.text || "")
        : sendBackMessage(waLang, data?.owner?.full_name || "", data?.shop?.name || "", (res?.fixes || []).map((f) => ({
            label: f.label, reason: f.reason, words: f.words, vendor_can_fix: f.vendor_can_fix })), !waiting);
      const link = whatsappLink(res?.whatsapp?.number, text);
      if (wa) {
        if (link) {
          wa.location.href = link;
          // Kept: the shop's message history (Mock 215-3).
          apiClient.recordWhatsappSent(id, { kind: "send_back", lang: waLang, text }).catch(() => {});
          setExtraMsgs((m) => [{ id: `m-${Date.now()}`, kind: "sent_back", lang: waLang, text, by_name: "You", at: new Date().toISOString() }, ...m]);
        } else wa.close();
      }
      toast(`Sent back to ${data?.shop?.name || "the shop"} - the vendor was told in the app${wa && link ? ". WhatsApp opened in a new tab." : "."}`, "success");
      setAsk(null);
      dirty.current = false;
      await load(1);
    } catch (err) {
      if (wa) wa.close();
      toast(err instanceof Error ? err.message : "Could not send it back", "error");
    } finally {
      setBusy(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = async (anyway = false) => {
    try {
      setBusy(true);
      setRefused("");
      await apiClient.approveRestaurant(id, anyway);
      toast("Approved - it stays hidden from customers until you switch on Show to customers", "success");
      router.push(`/dashboard/stores/${id}`);
    } catch (err) {
      setRefused(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    try {
      setBusy(true);
      await apiClient.rejectRestaurant(id, reason);
      toast("Store rejected", "success");
      router.push("/dashboard/stores?status=rejected");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reject", "error");
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  if (error && !data) return <ErrorState message={error} onRetry={() => load(1)} />;
  if (!data) return <p className="p-6 text-sm text-takal-ink-soft">Reading the shop…</p>;

  const s = data.shop;
  const o = data.owner;
  const review = data.review;
  const lic = data.licence;
  const L = lic?.needs_licence ? 1 : 0;   // the licence is section 3 for a pharmacy
  const steps: any[] = checklist?.steps || [];

  // ── one row and its reason box: module-level components (ItemRow,
  //    ReasonBox below) so typing in a box never loses its place when the
  //    page draws again.
  const reasonBox = (k: string) => (
    <ReasonBox key={`reason-${k}`} m={marks[k] || { state: "fix" }} chips={reasonsFor(k)}
      onChange={(m) => setMark(k, m)} onDone={() => setOpenKey(null)} />
  );
  // Called as a FUNCTION, not drawn as <Row>: a component made inside the
  // page is a new kind of thing on every draw, and React would rebuild the
  // row - and lose the reason box being typed in - each time.
  const row = (k: string, children: React.ReactNode) => (
    <ItemRow key={k} label={keyLabel(k)} k={k} m={marks[k]} waiting={reviewable} open={openKey === k}
      onMark={(st) => mark(k, st)} onOpen={() => setOpenKey(k)} box={reasonBox(k)}>
      {children}
    </ItemRow>
  );

  const sectionNote = (keys: string[]) => {
    const fix = keys.filter((k) => marks[k]?.state === "fix").length;
    const ok = keys.filter((k) => marks[k]?.state === "ok").length;
    return fix ? <span className="rounded-full bg-takal-orange-soft px-2 py-0.5 text-[11.5px] font-bold text-[#B23E10]">{fix} to fix</span>
      : <span className="text-[12px] text-takal-ink-soft">{ok} of {keys.length} OK</span>;
  };

  const logoFinds = findsFor("logo", finds);
  const logoCheck = s.image_url ? checksNow[s.image_url] : undefined;
  const logo = s.image_url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={s.image_url} alt="" onClick={() => setView({ list: [s.image_url], start: 0, title: `${s.name} - logo`,
        note: logoFinds.length ? `Found: ${logoFinds.flatMap((f) => f.hits.map((h) => h.text)).join(" · ")}` : undefined })}
        className={`h-16 w-16 cursor-zoom-in rounded-full object-cover ${logoFinds.length ? "border-[3px] border-takal-red" : "border border-takal-line"}`} />
    : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-takal-page text-2xl">{verticalEmoji(s.vendor_type)}</span>;
  const mapsLink = s.latitude && s.longitude ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : null;

  // ── Mock 215 helpers ──────────────────────────────────────────────────────
  /** The send-back message in the chosen language, from the marks as they are. */
  const waText = () => sendBackMessage(waLang, o.full_name || "", s.name || "", fixes.map((f) => ({
    label: keyLabel(f.key), reason: f.reason, words: f.words,
    vendor_can_fix: data.keys?.[f.key]?.where !== "office" })), !waiting);
  const photosOf = (p: ReviewProduct) => (p.photos?.length ? p.photos : p.image_url ? [p.image_url] : []);
  const seeProduct = (p: ReviewProduct, at = 0) => setView({ list: photosOf(p), start: at, title: p.name });
  const seeFind = (f: Found) => {
    if (!f.url) return;
    const prod = f.key.startsWith("product:") ? products.find((x) => productKey(x.id) === f.key) : null;
    const list = prod ? photosOf(prod) : [f.url];
    setView({ list, start: Math.max(0, list.indexOf(f.url)), title: f.label, note: `Found: ${f.hits.map((h) => h.text).join(" · ")}` });
  };
  const markFind = (f: Found) => {
    // The words: only what was found - a number reads the same in every language.
    setMark(f.key, { state: "fix", reason: reasonForFind(f), words: f.hits.map((h) => h.text).join(" · ") });
    setOpenKey(null);
  };
  const notContact = async (f: Found) => {
    if (!f.url) return;
    const was = checksNow[f.url];
    try {
      await apiClient.clearPictureCheck(id, f.url);
      setCleared((c) => ({ ...c, [f.url!]: { ...(was as SavedPictureCheck), url: f.url!, hits: was?.hits || [], boxes: was?.boxes || [], quality: was?.quality || null,
        not_contact: { by: "you", at: new Date().toISOString() } } }));
      toast("Marked as not a phone number - your name and the time are kept", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Not saved - try again", "error");
    }
  };
  const addNote = async (text: string) => {
    try {
      const r = await apiClient.addShopNote(id, text);
      setExtraNotes((n) => [r?.note || { id: `n-${Date.now()}`, kind: "note", text, by_name: "You", at: new Date().toISOString() }, ...n]);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "The note was not saved", "error");
      return false;
    }
  };

  // ── the black list ────────────────────────────────────────────────────────
  const fixList = () => (
    <div data-fix-list className="overflow-hidden rounded-xl border-[1.5px] border-black bg-white">
      <div className="bg-black px-4 py-2.5 text-[14px] font-black tracking-wide text-takal-yellow">WHAT TO FIX ({fixes.length})</div>
      <div className="px-4 pb-4 pt-1">
        {fixes.length === 0 && (
          <p className="py-3 text-[12.5px] text-takal-ink-soft">Nothing marked <b>Needs fix</b>. Mark a thing to send it back, or approve.</p>
        )}
        {fixes.map((f, i) => (
          <div key={f.key} className="flex gap-2.5 border-b border-[#EFEFEF] py-2.5">
            <b className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-takal-orange text-[11px]">{i + 1}</b>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-takal-ink">{keyLabel(f.key)}</div>
              <div className={`text-[12.5px] font-bold ${f.reason.length < 3 ? "text-takal-red" : "text-[#B23E10]"}`}>
                {f.reason || "Choose what is wrong"}
              </div>
              {f.words && <div className="text-[12px] text-takal-ink-soft">{f.words}</div>}
            </div>
            <button type="button" onClick={() => { setOpenKey(f.key); document.querySelector(`[data-review-item="${f.key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              className="self-start text-[12px] text-takal-ink underline">Edit</button>
          </div>
        ))}
        {unchecked.length > 0 && reviewable && (
          <p className="mt-2.5 rounded-lg border border-[#F7B79C] bg-takal-orange-soft px-3 py-2 text-[12.5px] text-takal-ink">
            <b>{unchecked.length} not checked yet</b>{unchecked.length <= 3 ? `: ${unchecked.map(keyLabel).join(", ")}` : ""}
          </p>
        )}
        {data.whatsapp?.number && (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-[12.5px] text-takal-ink">
              <input type="checkbox" checked={useWhatsapp} onChange={(e) => setUseWhatsapp(e.target.checked)} className="h-4 w-4 accent-black" />
              Also open WhatsApp with this list
            </label>
            {useWhatsapp && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <WaLangSwitch lang={waLang} onChange={setWaLang} small />
                {fixes.length > 0 && (
                  <button type="button" data-wa-see onClick={() => setShowWa((v) => !v)} className="text-[12px] font-bold text-takal-ink underline">
                    {showWa ? "Hide the message" : "See the message"}
                  </button>
                )}
              </div>
            )}
            {useWhatsapp && showWa && fixes.length > 0 && (
              <div className="mt-2"><WaPreview lang={waLang} text={waText()} number={data.whatsapp?.number} /></div>
            )}
          </div>
        )}
        <button type="button" data-send-back disabled={!reviewable || fixes.length === 0 || noReason.length > 0 || busy}
          onClick={() => setAsk("send")}
          className="mt-3 w-full rounded-xl border-[1.5px] border-[#B23E10] bg-takal-orange px-3 py-3 text-[14px] font-bold text-black transition hover:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:border-[#BDBDBD] disabled:bg-[#D9D9D9] disabled:text-[#8A8A8A] disabled:shadow-none">
          Send back for changes{fixes.length ? ` (${fixes.length})` : ""}
        </button>
        <p className="mt-1.5 text-center text-[11.5px] text-takal-ink-soft">
          {noReason.length ? "Say what is wrong for every thing marked Needs fix." : <>The shop stays {waiting ? "in Waiting" : status === "hidden" ? "approved and hidden" : "live"}. This is <b className="text-takal-ink">not</b> a rejection.</>}
        </p>
        {/* APPROVE IS ALWAYS OPEN for a waiting shop (Sana, 29 Oct 2026). What
            is missing keeps it HIDDEN instead - listed under the button. */}
        <button type="button" data-approve disabled={!waiting || busy}
          onClick={() => { setRefused(""); setAsk("approve"); }}
          className="mt-3 w-full rounded-xl border-[1.5px] border-black bg-takal-yellow px-3 py-2.5 text-[14px] font-bold text-black transition hover:bg-takal-yellow-dark hover:shadow-[0_3px_0_#000] disabled:cursor-not-allowed disabled:border-[#BDBDBD] disabled:bg-[#D9D9D9] disabled:text-[#8A8A8A] disabled:shadow-none">
          Approve
        </button>
        {lock && reviewable && status !== "approved" && (
          <p data-approve-lock role="note" className={`mt-2 rounded-lg border-l-4 px-3 py-2 text-[12px] font-semibold ${finds.length ? "border-takal-red bg-[#FFF1F2] text-takal-red" : "border-black bg-takal-yellow-soft text-takal-ink"}`}>
            {finds.length ? "🔒 " : "⏳ "}{lock}
          </p>
        )}
        {waiting || status === "hidden" ? (
          (data.show_check?.problems?.length || 0) > 0 || fixes.length > 0 || licenceLocked ? (
            <div data-show-lock className="mt-2 rounded-lg border-l-4 border-black bg-takal-yellow-soft px-3 py-2 text-[12px] text-takal-ink">
              <b>Hidden from customers until this is done</b> (payout details not needed):
              <ul className="mt-1 list-disc pl-4">
                {(data.show_check?.problems || []).map((p) => <li key={p}>{p}</li>)}
                {fixes.length > 0 && <li>{fixes.length} marked Needs fix here</li>}
                {licenceLocked && <li>The pharmacy licence marked OK</li>}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-center text-[11.5px] text-takal-ink-soft">Ready - it stays hidden from customers until you switch it on.</p>
          )
        ) : null}
        <button type="button" disabled={!waiting || busy} onClick={() => setAsk("reject")}
          className="mt-3 w-full rounded-xl border-[1.5px] border-takal-red bg-white px-3 py-2 text-[12.5px] font-bold text-takal-red hover:bg-takal-red-soft disabled:opacity-50">
          Reject shop
        </button>
      </div>
    </div>
  );

  const waLink = whatsappLink(data.whatsapp?.number, data.whatsapp?.text || "");
  // The list already sent back, in the chosen language (Mock 215-3).
  const listText = waLang === "en" && waiting ? (data.whatsapp?.text || "")
    : sendBackMessage(waLang, o.full_name || "", s.name || "", review.fixes.filter((f) => !f.done).map((f) => ({
        label: f.label, reason: f.reason, words: f.words, vendor_can_fix: f.vendor_can_fix })), !waiting);
  const listLink = whatsappLink(data.whatsapp?.number, listText);

  return (
    <div className="space-y-3 pb-24 lg:pb-4">
      <div className="flex items-center gap-1 text-[13px] text-takal-ink-soft">
        <Link href="/dashboard/stores?status=pending" className="inline-flex items-center hover:text-takal-ink">
          <ChevronLeft className="h-4 w-4" /><b className="text-takal-ink">Waiting for approval</b>
        </Link>
        <span>/ {s.name}</span>
        <span className="ml-auto text-[12px]">
          {saving === "saving" ? "Saving…" : saving === "saved" ? "✓ Saved" : saving === "failed" ? <span className="font-bold text-takal-red">Not saved - change a tick to try again</span> : ""}
        </span>
      </div>

      {!waiting && (
        <div className="rounded-xl border-l-4 border-takal-blue bg-takal-blue-soft px-4 py-3 text-[13px] text-takal-ink">
          {reviewable
            ? <>This shop is {status === "hidden" ? "approved - hidden from customers" : "live"}. You can still check it and send it back for fixes - it stays {status === "hidden" ? "hidden" : "live"} while the vendor fixes them.{" "}</>
            : <>This shop is {status}. There is nothing to review.{" "}</>}
          <Link href={`/dashboard/stores/${id}`} className="font-bold underline">Open the store page ›</Link>
        </div>
      )}

      {/* THE HEADER */}
      <div className="rounded-xl border border-takal-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          {logo}
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-bold text-takal-ink">{s.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full border-[1.5px] border-black bg-takal-yellow px-2.5 py-0.5 text-[12px] font-bold">{s.vendor_type_name || s.vendor_type}</span>
              {s.address && <span className="rounded-full bg-[#EFEFEF] px-2.5 py-0.5 text-[12px] font-bold text-[#333]">{String(s.address).split(",").slice(-2).join(",").trim()}</span>}
              <span className="rounded-full bg-takal-blue-soft px-2.5 py-0.5 text-[12px] font-bold text-takal-blue">
                {s.submitted_at ? `Sent by the office · ${day(s.submitted_at)}` : `Signed up · ${day(s.created_at)}`}
              </span>
              {review.state === "sent_back" && <span className="rounded-full bg-takal-orange-soft px-2.5 py-0.5 text-[12px] font-bold text-[#B23E10]">Sent back · {day(review.sent_back_at)}</span>}
              {review.state === "fixed" && <span className="rounded-full bg-black px-2.5 py-0.5 text-[12px] font-bold text-takal-yellow">● FIXED · {day(review.resubmitted_at)}</span>}
              {checking && <RiskBadge level={risk.level} title={risk.title} />}
            </div>
          </div>
          {reviewable && (
            <div className="w-full sm:w-[240px]">
              <div className="flex justify-between text-[12.5px]"><b>You checked {checked} of {total}</b><span className="text-takal-ink-soft">{Math.max(0, total - checked)} left</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEE]"><div className="h-full bg-black" style={{ width: `${total ? Math.min(100, Math.round((checked / total) * 100)) : 0}%` }} /></div>
              <button type="button" onClick={markRestOk} className="mt-2 w-full rounded-lg border-[1.5px] border-black bg-white px-2 py-1 text-[12px] font-bold hover:bg-takal-page">
                Mark everything not checked as OK
              </button>
            </div>
          )}
        </div>
        {steps.length > 0 && (
          <div className="mt-3 border-t border-[#EFEFEF] pt-3">
            <p className="mb-1.5 text-[12px] text-takal-ink-soft"><b className="text-takal-ink">Takal already checked these are THERE.</b> Now you check they are GOOD.</p>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((st: any) => (
                <span key={st.key} className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${st.done ? "bg-takal-green-soft text-takal-green" : "bg-takal-red-soft text-takal-red"}`}>
                  {st.done ? "✓" : "✕"} {st.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOCK 215: the shop's colour, every phone number found, the same shop twice. */}
      {checking && (
        <RiskPanel level={risk.level} title={risk.title} lines={risk.lines} progress={progress}
          scanning={scan.running} paused={scan.paused} onPause={() => scan.setPaused(true)} onResume={() => scan.setPaused(false)} />
      )}
      {checking && <ContactCard finds={finds} canMark={reviewable} marked={(k) => marks[k]?.state === "fix"} onSee={seeFind} onMarkFix={markFind} onNotContact={notContact} />}
      {checking && <SameShopCard twins={data.same_shop || []} />}

      {/* SENT BACK / FIXED: what the vendor was asked, ticked live (Mock 207-5). */}
      {(review.state === "sent_back" || review.state === "fixed") && review.fixes.length > 0 && (
        <div data-sent-list className={`rounded-xl border-[1.5px] px-4 py-3 ${review.state === "fixed" ? "border-black bg-takal-yellow-soft" : "border-[#F7B79C] bg-takal-orange-soft"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13.5px] text-takal-ink">
              {review.state === "fixed"
                ? `The vendor changed ${review.fixed_count} of ${review.fixes.length} and sent it back - check those again`
                : `Sent back ${day(review.sent_back_at)} - waiting for the vendor (${review.fixes.filter((f) => f.done).length} of ${review.fixes.length} changed so far)`}
            </b>
            {waLink && (
              <span className="ml-auto flex items-center gap-2">
                <WaLangSwitch lang={waLang} onChange={setWaLang} small />
                <a href={listLink || waLink} target="_blank" rel="noopener noreferrer" data-wa-list
                  onClick={() => {
                    apiClient.recordWhatsappSent(id, { kind: "list", lang: waLang, text: listText }).catch(() => {});
                    setExtraMsgs((m) => [{ id: `m-${Date.now()}`, kind: "whatsapp", lang: waLang, text: listText, by_name: "You", at: new Date().toISOString() }, ...m]);
                  }}
                  className="rounded-lg bg-takal-green px-3 py-1 text-[12px] font-bold text-white hover:brightness-110">
                  Open WhatsApp with the list
                </a>
              </span>
            )}
          </div>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {review.fixes.map((f) => (
              <li key={f.key} className="flex items-start gap-2 text-[12.5px] text-takal-ink">
                <span className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${f.done ? "bg-takal-green" : "bg-takal-orange"}`}>{f.done ? "✓" : "!"}</span>
                <span><b>{f.label}</b> - {f.reason}{f.done ? " · changed" : f.vendor_can_fix ? "" : " · the office sorts this"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Section title="Owner" n={1} right={sectionNote(REVIEW_SECTIONS[0].keys)}>
            {row("owner.name", <>{o.full_name || "—"}</>)}
            {row("owner.phone", <>
              {o.phone || "—"}
              {o.phone && <a href={`tel:${o.phone}`} className="ml-2 text-[12px] text-takal-blue underline">Call</a>}
              {data.whatsapp?.number && <a href={`https://wa.me/${data.whatsapp.number}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-[12px] text-takal-green underline">WhatsApp</a>}
            </>)}
            {row("owner.email", <>{o.email && !String(o.email).includes("noemail") ? o.email : "—"}</>)}
          </Section>
          <Section title="Shop details" n={2} right={sectionNote(REVIEW_SECTIONS[1].keys)}>
            {row("shop.name", <Marked text={s.name || ""} hits={findsFor("shop.name", finds).flatMap((f) => f.hits)} />)}
            {row("shop.type", <>{s.vendor_type_name || s.vendor_type}</>)}
            {row("shop.description", <>{s.description
              ? <span className="whitespace-pre-line"><Marked text={s.description} hits={findsFor("shop.description", finds).flatMap((f) => f.hits)} /></span>
              : <span className="text-takal-red">Empty</span>}</>)}
            {row("shop.minimum_order", <>{s.minimum_order != null ? money(s.minimum_order) : "—"}</>)}
            {row("shop.hours", <>{hoursInWords(s.opening_time, s.closing_time) || "—"}</>)}
          </Section>
          {lic?.needs_licence && (
            <Section title="Pharmacy licence" n={3} right={sectionNote(["licence"])}>
              {row("licence", <>
                <span data-licence-block className="flex flex-wrap items-start gap-3">
                  {lic.photo_link
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={lic.photo_link} alt="The pharmacy licence" onClick={() => setBigPic(lic.photo_link || null, "Pharmacy licence")}
                        className="h-20 w-28 cursor-zoom-in rounded-lg border border-takal-line object-cover" />
                    : <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-takal-red-soft px-2 text-center text-[11.5px] font-bold text-takal-red">
                        {lic.has_photo ? "Photo could not be opened - reload the page" : "No photo"}
                      </span>}
                  <span className="min-w-0 text-[13px]">
                    <span className="block">Number: <b>{lic.number || <span className="text-takal-red">not given</span>}</b></span>
                    <span className="block">Valid until: <b>{licenceDate(lic.valid_until) || <span className="text-takal-red">not given</span>}</b>
                      {LICENCE_STATE[lic.state]?.label && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${LICENCE_STATE[lic.state].tone}`}>{LICENCE_STATE[lic.state].label}</span>
                      )}
                    </span>
                    {lic.photo_link && <span className="block text-[12px] text-takal-ink-soft">Click the photo to open it full size</span>}
                  </span>
                </span>
              </>)}
              <p className="mx-4 mb-3 rounded-lg border-l-4 border-black bg-takal-yellow-soft px-3 py-2 text-[12.5px] text-takal-ink">
                <b>Approve stays locked for a pharmacy until the licence is marked OK.</b>{" "}
                {lic.state === "missing" || lic.state === "expired"
                  ? "This licence is missing or has run out, so it cannot be marked OK - add the new one on the store page first."
                  : "An expired licence shows red, and the shop is flagged 30 days before it runs out."}
              </p>
            </Section>
          )}
          <Section title="Logo" n={3 + L} right={sectionNote(["logo"])}>
            {row("logo", <><span className="flex flex-wrap items-center gap-3">{logo}
              <span className="text-[12px] text-takal-ink-soft">
                {!s.image_url ? "No logo yet"
                  : logoFinds.length ? <span data-logo-found className="font-bold text-takal-red">📞 {logoFinds.flatMap((f) => f.hits.map((h) => h.text)).join(" · ")} - written on the logo. Click it to see where.</span>
                  : logoCheck ? <span className="text-takal-green">✓ Read by the panel - no phone number or website. Click the picture to see it big.</span>
                  : <span>Reading the logo for phone numbers… Click the picture to see it big.</span>}
              </span></span></>)}
          </Section>
          <Section title="Location" n={4 + L} right={sectionNote(["place"])}>
            {row("place", <>
              <span className="block">{s.address || "—"}</span>
              <span className="text-[12px] text-takal-ink-soft">
                {mapsLink ? <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="text-takal-blue underline">See the pin on Google Maps ›</a> : <span className="font-bold text-takal-red">No map pin</span>}
              </span>
            </>)}
          </Section>
          <Section title={`Products (${data.products_total ?? products.length})`} n={5 + L}
            right={<>
              {(() => {
                const keys = [PRODUCTS_LINE, ...products.map((p) => productKey(p.id))];
                const fix = keys.filter((k) => marks[k]?.state === "fix").length;
                const un = keys.filter((k) => !marks[k]).length;
                return (fix || un) ? <span className="rounded-full bg-takal-orange-soft px-2 py-0.5 text-[11.5px] font-bold text-[#B23E10]">{fix ? `${fix} to fix` : ""}{fix && un ? " · " : ""}{un ? `${un} not checked` : ""}</span> : null;
              })()}
              {reviewable && <button type="button" onClick={() => { dirty.current = true; setMarks((was) => { const n = { ...was }; for (const p of products) if (!n[productKey(p.id)]) n[productKey(p.id)] = { state: "ok" }; return n; }); }}
                className="rounded-lg border-[1.5px] border-black bg-white px-2.5 py-0.5 text-[12px] font-bold hover:bg-takal-page">Mark the rest OK</button>}
            </>}>
            {/* THE PRODUCTS THEMSELVES (Sana 27 Oct 2026): OK / Needs fix for
                the shop's products as a whole - the only thing to press when
                a shop has none. */}
            <div data-products-line className="border-b border-takal-line">
              {row(PRODUCTS_LINE, <>
                {(data.products_total ?? products.length) === 0
                  ? <span className="font-bold text-takal-red">No products uploaded</span>
                  : <span>{data.products_total ?? products.length} uploaded</span>}
                {(data.products_total ?? products.length) < PRODUCTS_NEEDED && (data.products_total ?? products.length) > 0 && (
                  <span className="ml-1.5 font-bold text-takal-red">· fewer than {PRODUCTS_NEEDED}</span>)}
                <span className="block text-[12px] text-takal-ink-soft">
                  A shop needs at least {PRODUCTS_NEEDED} products, each with a photo. The vendor&apos;s line ticks itself when it has them.
                </span>
              </>)}
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => {
                const k = productKey(p.id);
                const m = marks[k];
                const pic = p.photos?.[0] || p.image_url;
                const pf = findsFor(k, finds);
                const onPic = pf.filter((f) => f.where === "picture");
                const inWords = pf.filter((f) => f.where === "words");
                const poor = [...new Set(photosOf(p).flatMap((u) => qualityWords(checksNow[u]?.quality)))];
                const unread = photosOf(p).filter((u) => !checksNow[u]).length;
                return (
                  <div key={p.id} data-review-item={k}
                    className={`rounded-xl bg-white p-1.5 ${pf.length ? "border-2 border-takal-red" : m?.state === "fix" ? "border-2 border-takal-orange" : m ? "border border-takal-line" : "border-2 border-dashed border-[#BDBDBD]"}`}>
                    {pic
                      ? <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={pic} alt="" onClick={() => (onPic[0] ? seeFind(onPic[0]) : seeProduct(p))} className="aspect-[4/3] w-full cursor-zoom-in rounded-lg object-cover" />
                          <span className="absolute left-1 top-1 flex flex-wrap gap-1">
                            {onPic.length > 0 && <span data-pic-found className="rounded-md bg-takal-red px-1.5 py-0.5 text-[10.5px] font-bold text-white">📞 on photo</span>}
                            {poor.map((w) => <span key={w} className="rounded-md bg-[#FFC72C] px-1.5 py-0.5 text-[10.5px] font-bold text-black">{w.replace(/ \(.*\)/, "")}</span>)}
                          </span>
                          {unread > 0 && reviewable && <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">reading…</span>}
                        </div>
                      : <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-takal-red-soft text-[12px] font-bold text-takal-red">No photo</div>}
                    {inWords.length > 0 && (
                      <div data-words-found className="mt-1 rounded-md bg-[#FFF1F2] px-1.5 py-0.5 text-[10.5px] font-bold text-takal-red">
                        📞 in the {inWords[0].field || "words"}: {inWords.flatMap((f) => f.hits.map((h) => h.text)).join(", ")}
                      </div>
                    )}
                    {p.photos?.length > 1 && <div className="mt-1 text-[10.5px] text-takal-ink-soft">{p.photos.length} photos</div>}
                    <div className="mt-1 truncate text-[12.5px] font-bold text-takal-ink" title={p.name}>{p.name}</div>
                    <div className="truncate text-[11.5px] text-takal-ink-soft">{p.price != null ? money(p.price) : "—"}{p.category_name ? ` · ${p.category_name}` : ""}</div>
                    {reviewable && (
                      <div className="mt-1.5 flex gap-1">
                        <Pill small on={m?.state === "ok"} kind="ok" onClick={() => mark(k, "ok")} />
                        <Pill small on={m?.state === "fix"} kind="fix" onClick={() => mark(k, "fix")} />
                      </div>
                    )}
                    {m?.state === "fix" && (
                      <button type="button" onClick={() => setOpenKey(k)} className="mt-1 block w-full truncate rounded-full bg-takal-orange-soft px-2 py-0.5 text-left text-[11px] font-bold text-[#B23E10]">
                        ! {m.reason || m.words || "Choose what is wrong"}
                      </button>
                    )}
                    {!m && reviewable && <div className="mt-1 rounded-full bg-[#EFEFEF] px-2 py-0.5 text-center text-[10.5px] font-bold text-[#555]">Not checked yet</div>}
                  </div>
                );
              })}
            </div>
            {openKey?.startsWith("product:") && marks[openKey]?.state === "fix" && (
              <div className="border-t border-[#EFEFEF] pt-2">
                <p className="px-4 text-[12.5px] font-bold text-takal-ink">{keyLabel(openKey)}</p>
                {reasonBox(openKey)}
              </div>
            )}
            {data.products_total != null && products.length < data.products_total && (
              <button type="button" disabled={loading} onClick={() => load(page + 1, true)}
                className="mx-3 mb-3 rounded-lg border-[1.5px] border-black bg-white px-3 py-1.5 text-[12.5px] font-bold hover:bg-takal-page disabled:opacity-50">
                {loading ? "Reading…" : `Show the next ${Math.min(data.per_page, data.products_total - products.length)} products`}
              </button>
            )}
          </Section>
          <Section title="Money" n={6 + L} right={sectionNote(["payout"])}>
            {row("payout", <>
              {data.payout?.given ? `${data.payout.method_label || data.payout.method} · ${data.payout.account_number || ""} · ${data.payout.account_title || ""}`
                : data.payout?.given === null ? "Could not be read just now" : <span className="text-takal-red">Not given yet</span>}
              {/* Only the office types payout details. The vendor's app opens
                  WhatsApp to Takal for them (26 Oct 2026) - this is where his
                  answer goes. */}
              <div className="mt-1 text-[12px] text-takal-ink-soft">
                The vendor sends these on WhatsApp.{" "}
                <Link href={`/dashboard/stores/${id}?tab=money`} className="font-semibold text-takal-blue underline">
                  Type them in on the Money tab ›
                </Link>
              </div>
            </>)}
          </Section>
          <MessagesNotes messages={[...extraMsgs, ...(data.messages || [])]} notes={[...extraNotes, ...(data.notes || [])]} onAddNote={addNote} />
        </div>

        <div id="fix-list" className="w-full lg:sticky lg:top-2 lg:w-[330px] lg:shrink-0">
          {fixList()}
          {refused && (
            <p role="alert" className="mt-2 rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-3 py-2 text-[12.5px] font-semibold text-takal-red">{refused}</p>
          )}
        </div>
      </div>

      {/* PHONE / TABLET: the list as a black bar at the bottom (Mock 207-3). */}
      {reviewable && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-black px-4 py-2.5 lg:hidden">
          <button type="button" onClick={() => document.getElementById("fix-list")?.scrollIntoView({ behavior: "smooth" })}
            className="flex-1 text-left">
            <b className="block text-[13px] font-black text-takal-yellow">{fixes.length} TO FIX</b>
            <span className="text-[11.5px] text-[#CCC]">{unchecked.length} not checked · tap to see the list</span>
          </button>
          <button type="button" disabled={fixes.length === 0 || noReason.length > 0 || busy} onClick={() => setAsk("send")}
            className="rounded-xl bg-takal-orange px-3.5 py-2 text-[13px] font-bold text-black disabled:bg-[#555] disabled:text-[#999]">
            Send back{fixes.length ? ` (${fixes.length})` : ""}
          </button>
        </div>
      )}

      {/* SEND BACK - check the list once more (Mock 207-4 A). */}
      <Modal open={ask === "send"} onClose={() => !busy && setAsk(null)} lockClose={busy} size="lg"
        title={`Send ${s.name} back for changes?`}
        hint={<>The shop stays in <b>Waiting for approval</b>. It is not rejected and it does not go live.</>}
        footer={<>
          <button type="button" onClick={() => setAsk(null)} disabled={busy}
            className="rounded-lg border-[1.5px] border-black bg-white px-4 py-2 text-[13.5px] font-bold">Not now</button>
          <button type="button" data-confirm-send-back onClick={sendBack} disabled={busy}
            className="rounded-lg border-[1.5px] border-[#B23E10] bg-takal-orange px-5 py-2 text-[13.5px] font-bold text-black disabled:opacity-60">
            {busy ? "Sending…" : "Send back for changes"}
          </button>
        </>}>
        <div className="space-y-0">
          {fixes.map((f, i) => (
            <div key={f.key} className="flex gap-3 border-b border-[#EFEFEF] py-2.5">
              <b className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-takal-orange text-[12px]">{i + 1}</b>
              <div className="text-[13.5px]">
                <b>{keyLabel(f.key)}</b> - <b className="text-[#B23E10]">{f.reason}</b>
                {f.words && <div className="text-[12.5px] text-takal-ink-soft">{f.words}</div>}
              </div>
            </div>
          ))}
        </div>
        <p className="mb-1.5 mt-3 text-[12.5px] font-bold text-takal-ink">The vendor gets this on his phone, and the list inside the Partners app:</p>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#E0E0E0] bg-[#F4F4F4] px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-black bg-takal-yellow font-black">T</span>
          <div className="text-[12.5px]"><b>Takal Partners</b><br />Takal asked for {fixes.length} change{fixes.length === 1 ? "" : "s"} to {s.name}. Open the app to see what to fix.</div>
        </div>
        {data.whatsapp?.number ? (
          <>
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={useWhatsapp} onChange={(e) => setUseWhatsapp(e.target.checked)} className="h-4 w-4 accent-black" />
              Also open WhatsApp to <b>0{data.whatsapp.number.slice(2)}</b> with this list written
            </label>
            {useWhatsapp && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-[12.5px] font-bold"><span>WhatsApp in:</span><WaLangSwitch lang={waLang} onChange={setWaLang} small /></div>
                <WaPreview lang={waLang} text={waText()} number={data.whatsapp.number} />
                <p className="text-[11.5px] text-takal-ink-soft">Only the WhatsApp message changes language - the vendor&apos;s app list stays as it is. Words you typed yourself go as you typed them. The message is kept in this shop&apos;s Messages.</p>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-[12.5px] text-takal-ink-soft">No Pakistani mobile number on this shop, so WhatsApp cannot be opened for it.</p>
        )}
      </Modal>

      {/* APPROVE - and it stays hidden (Mock 207-6 F). */}
      <ConfirmDialog open={ask === "approve"} busy={busy} danger={false}
        onCancel={() => setAsk(null)}
        onConfirm={() => approve(false)}
        title={`Approve ${s.name}?`}
        confirmLabel="Approve"
        message={<>
          {unchecked.length ? <>{unchecked.length} thing{unchecked.length === 1 ? " is" : "s are"} not checked yet, and nothing is marked Needs fix.</> : "Everything is checked and OK."}
          <span className="mt-3 block rounded-lg border-[1.5px] border-black bg-takal-yellow-soft p-3 text-takal-ink">
            <b>After approving, the shop stays HIDDEN from customers.</b> The vendor can keep adding
            products. Switch on <b>Show to customers</b> on its page when you are ready.
          </span>
          {refused && <span className="mt-3 block font-semibold text-takal-red">{refused}</span>}
          {refused && isMain && /anyway/i.test(refused) && (
            <button type="button" onClick={() => approve(true)} disabled={busy}
              className="mt-2 rounded-lg border-[1.5px] border-black bg-white px-3 py-1 text-[12.5px] font-bold">Approve anyway</button>
          )}
        </>}
      />

      <RejectReasonDialog
        open={ask === "reject"}
        busy={busy}
        title="Reject this store?"
        name={s.name || "This store"}
        who="the owner"
        consequence="will be turned down. Their shop will not appear to customers."
        suggestions={SHOP_REASONS}
        onCancel={() => setAsk(null)}
        onConfirm={(reason) => reject(reason || "")}
      />

      {view && (
        <PictureViewer pictures={view.list} start={view.start} title={view.title} note={view.note}
          boxes={boxesNow} onClose={() => setView(null)} />
      )}
    </div>
  );
}
