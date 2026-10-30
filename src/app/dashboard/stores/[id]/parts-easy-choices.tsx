"use client";

// MOCK 218 v2 - EASY SIZES, COLOURS AND DETAILS, the panel's six steps.
// Approved by Sana on 29 October 2026 ("GO 218"). The same steps as the
// Takal Partners app, so the office and a vendor add a product the same way:
//   1 does it come in kinds?  2 what is different (and which first)?
//   3 the first ones  4 the second ones under EACH  5 price and stock  6 check
// Picked is Takal yellow, never black. The rules live in
// src/lib/option-wizard.ts (tested against the server's own list of cases).

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { OptionDraft } from "@/lib/product-edit";
import {
  buildRows, choiceLines, cleanChoicePhotos, FALLBACK, kindsForReading, photoKeys, readRows, rowsOfDrafts, templateFrom, valuesOf,
  type BuiltRow, type ChoiceKind, type ChoiceTemplate,
} from "@/lib/option-wizard";

interface Props {
  categoryId?: string;
  vendorType: string;
  productName: string;
  basePrice?: number | null;
  drafts: OptionDraft[];
  disabled?: boolean;
  /** Migration 153: the product's own photos, and which colour each one shows. */
  photos?: string[];
  startPhotos?: Record<string, string>;
  onDone: (rows: BuiltRow[], addDetail: { label: string; value: string } | null, photosFor: Record<string, string>) => void;
}

const ROMAN: Record<number, string> = {
  1: "Kya yeh cheez mukhtalif rang, size ya qisam mein aati hai?",
  2: "Kya cheez badalti hai? Aik ya do dabayein.",
};

const own = (name: string): ChoiceKind => ({ key: `own:${name.toLowerCase()}`, label: name, icon: "✏️", groups: [] });

export default function EasyChoices({ categoryId, vendorType, productName, basePrice, drafts, disabled, photos = [], startPhotos = {}, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<ChoiceTemplate>(FALLBACK);
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<ChoiceKind[]>([]);
  const [first, setFirst] = useState<string[]>([]);
  const [second, setSecond] = useState<Record<string, string[]>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [stock, setStock] = useState<Record<string, string>>({});
  const [ownVals, setOwnVals] = useState<Record<string, string[]>>({});
  const [ownKinds, setOwnKinds] = useState<ChoiceKind[]>([]);
  const [typedAt, setTypedAt] = useState<Record<string, string>>({});
  const typed = (at: string) => typedAt[at] || "";
  const setTyped = (at: string, v: string) => setTypedAt((t) => ({ ...t, [at]: v }));
  const [seeFirst, setSeeFirst] = useState("");
  // MIGRATION 153 - a photo for each colour (the first thing the customer taps).
  const [photoFor, setPhotoFor] = useState<Record<string, string>>({});
  const [photosOpen, setPhotosOpen] = useState(false);

  // The ready choices for this shelf - asked when the shelf changes.
  useEffect(() => {
    let alive = true;
    apiClient.getOptionTemplates(categoryId || undefined, vendorType)
      .then((j) => { if (alive) setTpl(templateFrom(j)); })
      // Reason to stay quiet: a server from before Mock 218 - the everyday list still works.
      .catch(() => { if (alive) setTpl(FALLBACK); });
    return () => { alive = false; };
  }, [categoryId, vendorType]);

  const kinds = useMemo(() => [...tpl.kinds, ...ownKinds], [tpl, ownKinds]);
  const two = picked.length === 2;
  const has = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());
  const flip = (list: string[], v: string) => (has(list, v) ? list.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...list, v]);
  const valuesFor = (k: ChoiceKind) => [...k.groups, ...((ownVals[k.key] || []).length ? [{ title: "Your own", values: ownVals[k.key] }] : [])];
  const keys = two ? first.flatMap((a) => (second[a] || []).map((b) => `${a}|${b}`)) : first;

  const built = buildRows({
    levels: picked.map((k) => k.label), first, second,
    price: Object.fromEntries(keys.filter((k) => (price[k] || "").trim()).map((k) => [k, price[k].replace(/,/g, "")])),
    stock: Object.fromEntries(keys.filter((k) => (stock[k] || "").trim()).map((k) => [k, stock[k]])),
  });

  function start() {
    const now = rowsOfDrafts(drafts);
    const read = readRows(now, kindsForReading(tpl));
    setPrice({}); setStock({}); setOwnVals({}); setTypedAt({}); setSeeFirst("");
    setPhotoFor({ ...startPhotos }); setPhotosOpen(false);
    if (!now.length || read.mixed || !read.levels.length) {
      setPicked(tpl.suggested.map((k) => tpl.kinds.find((x) => x.key === k)).filter(Boolean).slice(0, 2) as ChoiceKind[]);
      setFirst([]); setSecond({});
    } else {
      const ks = read.levels.map((l) => kinds.find((k) => k.label.toLowerCase() === l.toLowerCase()) || own(l));
      setPicked(ks);
      setFirst(read.first); setSecond(read.second);
      setPrice(Object.fromEntries(Object.entries(read.price).map(([k, v]) => [k, String(v)])));
      setStock(Object.fromEntries(Object.entries(read.stock).map(([k, v]) => [k, String(v)])));
      const extra: Record<string, string[]> = {};
      ks.forEach((k, i) => {
        const vals = i === 0 ? read.first : Object.values(read.second).flat();
        const ready = new Set(valuesOf(k).map((v) => v.toLowerCase()));
        extra[k.key] = [...new Set(vals.filter((v) => !ready.has(v.toLowerCase())))];
      });
      setOwnVals(extra);
    }
    setStep(1);
    setOpen(true);
  }

  function pickKind(k: ChoiceKind) {
    setPicked((p) => {
      const at = p.findIndex((x) => x.key === k.key);
      const next = at >= 0 ? p.filter((_, i) => i !== at) : p.length < 2 ? [...p, k] : [p[0], k];
      if (!next.length || !p.length || next[0].key !== p[0].key) { setFirst([]); setSecond({}); }
      else if ((next[1]?.key || "") !== (p[1]?.key || "")) setSecond({});
      return next;
    });
  }

  function addOwnValue(k: ChoiceKind, into: "first" | string) {
    const v = typed(into).trim().split(/\s+/).join(" ");
    if (!v) return;
    if (!valuesOf(k).some((x) => x.toLowerCase() === v.toLowerCase())) {
      setOwnVals((o) => ({ ...o, [k.key]: has(o[k.key] || [], v) ? o[k.key] : [...(o[k.key] || []), v] }));
    }
    if (into === "first") setFirst((f) => (has(f, v) ? f : [...f, v]));
    else setSecond((s) => ({ ...s, [into]: has(s[into] || [], v) ? s[into] : [...(s[into] || []), v] }));
    setTyped(into, "");
  }

  const canGoOn = step === 1 ? true : step === 2 ? picked.length > 0 : step === 3 ? first.length > 0
    : step === 4 ? first.some((a) => (second[a] || []).length) : step === 5 ? true : built.rows.length > 0;

  const next = () => {
    if (!canGoOn) return;
    if (step === 6) { onDone(built.rows, built.add_detail, cleanChoicePhotos(photoFor, photoKeys(built.rows), photos)); setOpen(false); return; }
    setStep((s) => (s === 3 && !two ? 5 : s + 1));
  };
  const back = () => (step === 1 ? setOpen(false) : setStep((s) => (s === 5 && !two ? 3 : s - 1)));

  const chip = (word: string, on: boolean, tap: () => void, dot?: string) => (
    <button key={word} type="button" onClick={tap} aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold border-2 ${on ? "bg-takal-yellow border-takal-ink" : "bg-white border-takal-line"}`}>
      {dot && <span className="inline-block h-3 w-3 rounded-full border border-black/20" style={{ background: dot }} />}
      {word}
    </button>
  );
  const dotOf = (k: ChoiceKind, v: string) => (k.swatch ? k.groups.find((g) => g.dots?.[v])?.dots?.[v] : undefined);
  const tile = (icon: string, title: string, sub: string, on: boolean, tap: () => void) => (
    <button type="button" onClick={tap} aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${on ? "bg-takal-yellow border-takal-ink" : "bg-white border-takal-line hover:border-takal-ink"}`}>
      <span className="text-2xl">{icon || "•"}</span>
      <span className="flex-1"><b className="block text-sm">{title}</b>{sub && <span className="text-xs text-takal-ink-soft">{sub}</span>}</span>
      {on && <span aria-hidden>✓</span>}
    </button>
  );
  const urdu = (t: string) => <p className="mt-2 rounded-lg border border-takal-yellow-dark bg-takal-yellow-soft px-3 py-2 text-sm italic font-semibold">{t}</p>;
  const ownBox = (label: string, k: ChoiceKind, into: "first" | string) => (
    <div className="mt-2 flex gap-2">
      <input value={typed(into)} onChange={(e) => setTyped(into, e.target.value)} placeholder={`+ Own ${label}`}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwnValue(k, into); } }}
        className="flex-1 rounded-lg border border-takal-line px-3 py-1.5 text-sm" aria-label={`Own ${label}`} />
      <button type="button" onClick={() => addOwnValue(k, into)} className="rounded-lg border-2 border-takal-ink px-3 text-sm font-bold hover:bg-takal-yellow">Add</button>
    </div>
  );
  const groupsOf = (k: ChoiceKind, list: string[], tap: (v: string) => void) => valuesFor(k).map((g) => (
    <div key={g.title} className="mt-2">
      {valuesFor(k).length > 1 && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">{g.title}</p>}
      <div className="flex flex-wrap gap-1.5">{g.values.map((v) => chip(v, has(list, v), () => tap(v), dotOf(k, v)))}</div>
    </div>
  ));

  const names = ["CHOICES", "WHAT CHANGES", "PICK", "FOR EACH", "PRICE AND STOCK", "CHECK"];
  const base = basePrice ? money(basePrice) : "the product price";
  const firstsSeen = [...new Set(built.rows.map((r) => r.variant_type))];
  const pick = firstsSeen.includes(seeFirst) ? seeFirst : firstsSeen[0] || "";
  const photoKeysNow = photoKeys(built.rows);
  const photoWord = (picked[0]?.label || "choice").toLowerCase();
  const photosSet = photoKeysNow.filter((k) => photos.includes(photoFor[k] || "")).length;

  return (
    <>
      <div className="mb-2 rounded-xl border-2 border-takal-ink bg-takal-yellow p-3">
        {drafts.some((d) => d.variant_type.trim()) && (
          <div className="mb-2 text-xs font-semibold" data-testid="choices-summary">
            {choiceLines(drafts).slice(0, 6).map((l) => <p key={l}>{l}</p>)}
          </div>
        )}
        <button type="button" disabled={disabled} onClick={start} className="w-full text-left text-sm font-extrabold disabled:opacity-50">
          🎨 {drafts.length ? "Change them in easy steps" : "Add sizes, colours… in easy steps"} ›
          <span className="block text-xs font-semibold italic">Aasaan qadam - aik waqt mein aik sawal</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Easy steps">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white">
            <div className="bg-takal-yellow px-5 py-3">
              <p className="font-extrabold">{productName.trim() || "Sizes, colours…"}</p>
              <p className="text-xs">{tpl.shelf ? `Category: ${tpl.department} › ${tpl.shelf}` : tpl.department || vendorType}</p>
              <div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5, 6].map((i) => <span key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-takal-ink" : "bg-black/15"}`} />)}</div>
              <p className="mt-1 text-[11px] font-bold tracking-wide">STEP {step} OF 6 · {names[step - 1]}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {step === 1 && (<>
                <h3 className="text-lg font-extrabold">Does this product come in different colours, sizes or kinds?</h3>
                {urdu(ROMAN[1])}
                <div className="mt-3 space-y-2">
                  {tile("📦", "No, one kind", "Nahi, sirf aik qisam", false, () => {
                    if (!drafts.length || window.confirm(`Take away all ${drafts.length} choices? Customers will buy it as one kind.`)) {
                      onDone([], null, {}); setOpen(false);
                    }
                  })}
                  {tile("🎨", "Yes, different", "Haan, mukhtalif", true, next)}
                </div>
                <p className="mt-3 text-xs text-takal-ink-soft">Not sure? If a customer must say which one (&ldquo;red, size M&rdquo;) - press Yes.</p>
              </>)}

              {step === 2 && (<>
                <h3 className="text-lg font-extrabold">What is different? Tap one or two.</h3>
                {urdu(ROMAN[2])}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {kinds.map((k) => <div key={k.key}>{tile(k.icon || "", k.label, k.roman || "", picked.some((p) => p.key === k.key), () => pickKind(k))}</div>)}
                </div>
                <div className="mt-2 flex gap-2">
                  <input value={typed("kind")} onChange={(e) => setTyped("kind", e.target.value)} placeholder="Own kind - e.g. Design" aria-label="Own kind"
                    className="flex-1 rounded-lg border border-takal-line px-3 py-1.5 text-sm" />
                  <button type="button" className="rounded-lg border-2 border-takal-ink px-3 text-sm font-bold hover:bg-takal-yellow"
                    onClick={() => { const n = typed("kind").trim(); if (!n) return; const k = kinds.find((x) => x.label.toLowerCase() === n.toLowerCase()) || own(n); if (!kinds.includes(k)) setOwnKinds((o) => [...o, k]); pickKind(k); setTyped("kind", ""); }}>
                    + Own kind
                  </button>
                </div>
                {two && (<>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Which comes first?</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {tile(picked[0].icon || "", `${picked[0].label} first`, `each ${picked[0].label.toLowerCase()}, then its ${picked[1].label.toLowerCase()}s`, true, () => undefined)}
                    {tile(picked[1].icon || "", `${picked[1].label} first`, `each ${picked[1].label.toLowerCase()}, then its ${picked[0].label.toLowerCase()}s`, false,
                      () => { setPicked([picked[1], picked[0]]); setFirst([]); setSecond({}); })}
                  </div>
                </>)}
              </>)}

              {step === 3 && picked[0] && (<>
                <h3 className="text-lg font-extrabold">Which {picked[0].label.toLowerCase()}s do you have?</h3>
                {urdu(`Aap ke paas kaunse ${(picked[0].roman || picked[0].label).toLowerCase()} hain? Sab dabayein.`)}
                {groupsOf(picked[0], first, (v) => { setFirst((f) => flip(f, v)); if (has(first, v)) setSecond((s) => { const c = { ...s }; delete c[v]; return c; }); })}
                {ownBox(picked[0].label.toLowerCase(), picked[0], "first")}
                {first.length > 0 && <p className="mt-3 rounded-lg bg-takal-yellow-soft px-3 py-2 text-sm font-bold">{first.length} picked: {first.join(", ")}</p>}
              </>)}

              {step === 4 && two && (<>
                <h3 className="text-lg font-extrabold">{picked[1].label}s for each {picked[0].label.toLowerCase()}</h3>
                {urdu(`Har ${picked[0].label.toLowerCase()} ke neeche woh ${picked[1].label.toLowerCase()} dabayein jo us mein hain.`)}
                {first.map((a) => {
                  const mine = second[a] || [];
                  const other = first.find((o) => o !== a && (second[o] || []).length);
                  const all = picked[1].groups[0]?.values || [];
                  return (
                    <div key={a} className="mt-3 rounded-xl border border-takal-line p-3">
                      <p className="flex items-center justify-between font-extrabold">{a}
                        <span className={`rounded-full border px-2 text-xs ${mine.length ? "bg-takal-yellow border-takal-ink" : "border-takal-line"}`}>{mine.length} {picked[1].label.toLowerCase()}s</span></p>
                      {groupsOf(picked[1], mine, (v) => setSecond((s) => ({ ...s, [a]: flip(s[a] || [], v) })))}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                        {all.length > 0 && <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setSecond((s) => ({ ...s, [a]: [...new Set([...(s[a] || []), ...all])] }))}>All {picked[1].label.toLowerCase()}s</button>}
                        {other && <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setSecond((s) => ({ ...s, [a]: [...(s[other] || [])] }))}>Same as {other}</button>}
                      </div>
                      {ownBox(picked[1].label.toLowerCase(), picked[1], a)}
                    </div>
                  );
                })}
              </>)}

              {step === 5 && (<>
                <h3 className="text-lg font-extrabold">Price and stock</h3>
                {urdu(`Sab ki qeemat ${base} hai. Sirf woh badlein jo mukhtalif hai.`)}
                <div className="mt-2 flex gap-2 text-xs font-bold">
                  <button type="button" className="rounded-lg border px-2 py-1" onClick={() => setPrice({})}>Same price for all</button>
                  <button type="button" className="rounded-lg border px-2 py-1" onClick={() => { const n = window.prompt("Stock for all", "5"); if (n && /^\d+$/.test(n.trim())) setStock(Object.fromEntries(keys.map((k) => [k, n.trim()]))); }}>Stock for all</button>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase text-takal-ink-soft"><th>Choice</th><th>Price</th><th>Stock</th></tr></thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k}>
                        <td className="py-1 font-semibold">{k.replace("|", " · ")}</td>
                        <td><input aria-label={`Price of ${k}`} value={price[k] || ""} placeholder={base} onChange={(e) => setPrice((p) => ({ ...p, [k]: e.target.value }))} className="w-28 rounded border border-takal-line px-2 py-1" /></td>
                        <td><input aria-label={`Stock of ${k}`} value={stock[k] || ""} placeholder="∞" inputMode="numeric" onChange={(e) => setStock((s) => ({ ...s, [k]: e.target.value.replace(/\D/g, "") }))} className="w-20 rounded border border-takal-line px-2 py-1" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-takal-ink-soft">Blank price = the same as the product. 0 in stock = &ldquo;sold out&rdquo; for that one only.</p>
                {photoKeysNow.length > 0 && (
                  <div className="mt-4 rounded-xl border-2 border-takal-line p-3" data-testid="photos-per-choice-box">
                    <button type="button" data-testid="photos-per-choice" onClick={() => setPhotosOpen((o) => !o)}
                      className="w-full text-left text-sm font-extrabold">
                      📷 Photo for each {photoWord} {photosOpen ? "▾" : "›"}{photosSet ? ` (${photosSet} set)` : ""}
                    </button>
                    {photosOpen && (<>
                      {urdu(`Har ${photoWord} ki tasveer chunein - customer jab woh dabaye ga to yehi tasveer nazar aayegi.`)}
                      {!photos.length ? (
                        <p className="mt-2 text-xs text-takal-ink-soft" data-testid="photos-none-yet">Add the product&rsquo;s photos first (the Photos box), then pick one for each {photoWord} here.</p>
                      ) : photoKeysNow.map((k) => (
                        <div key={k} className="mt-2" data-testid={`photo-row-${k}`}>
                          <p className="text-xs font-bold">{k}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {photos.map((u, i) => {
                              const on = photoFor[k] === u;
                              return (
                                <button key={u} type="button" aria-pressed={on} aria-label={`Photo ${i + 1} for ${k}`} data-testid={`photo-${k}-${i}`}
                                  onClick={() => setPhotoFor((m) => { const c = { ...m }; if (on) delete c[k]; else c[k] = u; return c; })}
                                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 p-0.5 ${on ? "border-takal-ink bg-takal-yellow" : "border-takal-line bg-white"}`}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={u} alt="" className="h-full w-full rounded object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>)}
                  </div>
                )}
              </>)}

              {step === 6 && (<>
                {built.problem ? (
                  <p className="rounded-lg bg-takal-red-soft px-3 py-2 text-sm font-semibold text-takal-red">
                    &ldquo;{built.value}&rdquo; cannot be a {picked[0]?.label.toLowerCase()} here - customers would read it as a question. Go back and give it another name.
                  </p>
                ) : (<>
                  <h3 className="text-lg font-extrabold">{built.rows.length} choices - only the ones you have</h3>
                  <div className="mt-2 rounded-xl border border-takal-line p-3 text-sm font-semibold">
                    {two ? first.filter((a) => (second[a] || []).length).map((a) => <p key={a}>{a}: {second[a].join(", ")} ({second[a].length})</p>)
                      : <p>{picked[0]?.label}: {first.join(", ")}</p>}
                    {built.add_detail && <p className="mt-1 text-xs text-takal-ink-soft">Only one {built.add_detail.label.toLowerCase()}: &ldquo;{built.add_detail.label}: {built.add_detail.value}&rdquo; goes into the details.</p>}
                  </div>
                  {urdu("Theek hai? Neeche dekhein customer ko kaisa nazar aayega.")}
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">The customer sees</p>
                  <div className="mt-1 rounded-xl border border-takal-line p-3">
                    {two && !built.add_detail && (
                      <div className="mb-2 flex flex-wrap gap-1.5">{firstsSeen.map((s) => chip(s, s === pick, () => setSeeFirst(s)))}</div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {built.rows.filter((r) => !two || built.add_detail || r.variant_type === pick).map((r) => (
                        <span key={`${r.variant_type}|${r.variant_value}`} className={`rounded-full border border-takal-line bg-takal-page px-3 py-1 text-sm ${r.stock_quantity === 0 ? "line-through opacity-50" : ""}`}>
                          {r.variant_value}{r.price_override != null ? ` · ${money(r.price_override)}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </>)}
              </>)}
            </div>
            <div className="flex gap-2 border-t border-takal-line px-5 py-3">
              <button type="button" onClick={back} className="rounded-xl border-2 border-takal-ink px-4 py-2 font-bold" aria-label="Back">←</button>
              <button type="button" onClick={next} disabled={!canGoOn}
                className="flex-1 rounded-xl bg-takal-yellow py-2 font-extrabold text-takal-ink disabled:opacity-40">
                {step === 6 ? "✓ Use these choices" : step === 1 ? "Yes - next ›" : "Next ›"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
