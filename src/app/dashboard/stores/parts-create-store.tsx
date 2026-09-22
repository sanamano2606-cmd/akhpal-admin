"use client";

/**
 * CREATE A STORE — the same form a vendor fills in the Takal Vendors app.
 *
 * Mock 74 (approved by Sana, 15 September 2026) and Mock 75, Option A
 * (approved 16 September 2026). Pictures: mocks/MOCK-74-* and MOCK-75-*.
 *
 * EVERY SHOP WAITS FOR APPROVAL (Sana, 16 September 2026, afternoon): "every
 * shop go for approval first from admin if made OR add by Vendor app". A shop
 * made here lands in Stores -> Pending, exactly like a vendor-app sign-up, and
 * is approved there with the same Approve button.
 *
 * WHY IT WAS REBUILT
 * The old form asked for owner, phone, email, shop name, type, address and a
 * map pin — and nothing else. The vendor app's sign-up also asks for a
 * password, a logo, a description, the cuisine (restaurants), a minimum order
 * and the opening hours, so a shop made in the office came out with fewer
 * details than one a vendor made himself. Sana: "I want the store to be
 * created the same way the vendors creates it."
 *
 * WHAT IT CAN DO
 *   Step 1  pick the kind of shop — or, for a mall, several kinds
 *   Step 2  the vendor app's sections, in the vendor app's order
 *   Step 3  what was made, and the login to hand over
 *
 * A mall is ONE login with ONE SHOP PER KIND (Option A). A shop's kind decides
 * its categories, whether a rider or a parcel office delivers it, its
 * commission and its tab in the customer app, so one shop cannot be all kinds.
 *
 * "Existing vendor" adds the new shop(s) under a login that already exists —
 * the office's version of the app's "Add another store".
 *
 * Every rule here is the vendor app's rule, and the server checks all of them
 * again (routers/restaurants_admin.py -> admin_create_store).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { CreateStoreResult, VendorMatch } from "@/lib/api-stores";
import { toast } from "@/lib/toast";
import { SIGNUP_VERTICALS, verticalLabel, verticalEmoji } from "@/lib/verticals";
import { Button, useDialogKeys } from "@/components/ui";
import { expressShopTypes } from "./[id]/parts-map";
import { ShopLocationBox } from "./parts-shop-location";
import { hasPin } from "@/lib/shop-location";

// ── The vendor app's own lists and rules ────────────────────────────────────

/** restaurant_app/lib/data/cuisine_options.dart — same values, same order. */
export const CUISINES: { value: string; label: string; emoji: string }[] = [
  { value: "pizza", label: "Pizza", emoji: "🍕" },
  { value: "burgers", label: "Burgers", emoji: "🍔" },
  { value: "desi", label: "Desi", emoji: "🍛" },
  { value: "bbq", label: "BBQ", emoji: "🔥" },
  { value: "fast food", label: "Fast Food", emoji: "🌮" },
  { value: "chinese", label: "Chinese", emoji: "🥢" },
  { value: "seafood", label: "Seafood", emoji: "🐟" },
  { value: "bakery", label: "Bakery", emoji: "🥐" },
  { value: "coffee", label: "Coffee", emoji: "☕" },
  { value: "sweets", label: "Sweets", emoji: "🍰" },
  { value: "healthy", label: "Healthy", emoji: "🥗" },
];

/** "1 thing needs fixing" / "4 things need fixing". */
export function thingsToFix(n: number): string {
  return n === 1 ? "1 thing needs fixing" : `${n} things need fixing`;
}

/** The shop-name label changes with the kind, as in the vendor app. */
export function nameLabelFor(vendorType: string): string {
  switch (vendorType) {
    case "restaurant": return "Restaurant Name";
    case "bakery": return "Bakery Name";
    case "pharmacy": return "Pharmacy Name";
    case "grocery":
    case "clothing_store": return "Store Name";
    default: return "Shop Name";
  }
}

/** validators.dart isValidPhone: digits, + - ( ) and spaces; 7 to 15 digits. */
export function phoneProblem(phone: string): string | null {
  const v = phone.trim();
  if (!v) return "Phone number is required";
  const digits = v.replace(/\D/g, "");
  if (!/^[+\d\s\-()]+$/.test(v) || digits.length < 7 || digits.length > 15) {
    return "Enter a valid phone number (7–15 digits)";
  }
  return null;
}

/** The number exactly as the server will save it — and the vendor signs in with. */
export function savedPhone(phone: string): string {
  const v = phone.trim();
  const digits = v.replace(/\D/g, "");
  return v.startsWith("+") ? `+${digits}` : digits;
}

/** validators.dart: 6+ characters with at least one letter. */
/** Where a vendor gets the app. One place, so the message and any future
 *  screen cannot drift apart. */
export const VENDOR_APP_LINK = "https://takalapp.com/vendor";

export function passwordProblem(pw: string): string | null {
  if (!pw) return "Password is required";
  if (pw.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least one letter";
  return null;
}

/** 10 characters, always a letter and a digit, no look-alikes (0/O, 1/I). */
export function makePassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (set: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return set[buf[0] % set.length];
  };
  const body = Array.from({ length: 8 }, () => pick(all)).join("");
  return body + pick(letters) + pick(digits);
}

/** A Pakistani mobile as WhatsApp wants it: 03001234567 -> 923001234567. */
export function whatsappNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) return `92${d.slice(1)}`;
  return d;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ── Small drawing pieces ────────────────────────────────────────────────────

const inputCls = (bad?: string) =>
  `w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-takal-ink ${
    bad ? "border-2 border-takal-red bg-takal-red-soft" : "border border-takal-line bg-white"
  }`;

function Label({ text, children, error, hint }: {
  text: string; children: React.ReactNode; error?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-takal-ink">{text}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-takal-red">⚠ {error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-takal-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 border-b-2 border-takal-yellow pb-1 text-lg font-bold text-takal-ink">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label, hint }: {
  on: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-start justify-between gap-4 rounded-lg border border-takal-line p-3 text-left hover:bg-takal-page"
      aria-pressed={on}
    >
      <span>
        <span className="block text-sm font-bold text-takal-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-takal-ink-soft">{hint}</span>}
      </span>
      <span className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full ${on ? "bg-takal-ink" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${on ? "left-[22px] bg-takal-yellow" : "left-0.5 bg-white"}`} />
      </span>
    </button>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const names = ["Shop type", "Details", "Done"];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {names.map((s, i) => {
        const n = i + 1;
        const on = n === step;
        const done = n < step;
        return (
          <div key={s} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
              on ? "bg-takal-yellow text-takal-ink" : done ? "bg-takal-green-soft text-takal-green" : "bg-slate-100 text-takal-ink-soft"
            }`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                on ? "bg-takal-ink text-takal-yellow" : done ? "bg-takal-green text-white" : "bg-white text-takal-ink-soft"
              }`}>{done ? "✓" : n}</span>
              {s}
            </span>
            {n < 3 && <span className="text-takal-ink-soft">›</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── The form ────────────────────────────────────────────────────────────────

type Errors = Record<string, string>;

export default function CreateStoreWizard({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [who, setWho] = useState<"new" | "existing">("new");
  const [many, setMany] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [express, setExpress] = useState<string[]>([]);

  // Owner (new vendor)
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Owner (existing vendor)
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<VendorMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [vendor, setVendor] = useState<VendorMatch | null>(null);

  // Shop details
  const [mainName, setMainName] = useState("");
  // The one name when a single kind is picked — kept apart from the mall's
  // per-kind names, so changing the kind in step 1 does not lose it.
  const [soloName, setSoloName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [open24, setOpen24] = useState(false);
  const [openNow, setOpenNow] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  // After the first press of Create, the red marks follow the typing: a field
  // that is fixed loses its mark at once, instead of staying red until the
  // next press.
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateStoreResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // The window scrolls on its own; a new step, or a list of things to fix,
  // starts at the top so the person sees it.
  const scroller = useRef<HTMLDivElement | null>(null);
  const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  useEffect(() => { toTop(); }, [step]);

  const close = useCallback(() => onClose(), [onClose]);
  useDialogKeys(true, close, saving || uploading);

  useEffect(() => {
    let alive = true;
    expressShopTypes().then((t) => alive && setExpress(t));
    return () => { alive = false; };
  }, []);
  const byRider = (v: string) => express.includes(v);

  const hasFood = picked.includes("restaurant");
  const single = picked.length === 1 ? picked[0] : "";

  // ── Step 1: kinds ─────────────────────────────────────────────────────────
  const toggleKind = (v: string) => {
    setErrors({});
    if (!many) { setPicked([v]); return; }
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  };
  const setManyMode = (on: boolean) => {
    setMany(on);
    // Going back to one kind keeps only the first one picked.
    if (!on) setPicked((p) => p.slice(0, 1));
  };
  const next = () => {
    if (!picked.length) {
      setErrors({ kinds: many ? "Pick every kind this vendor sells" : "Pick the kind of shop" });
      return;
    }
    setErrors({});
    setStep(2);
  };

  // Names in a mall follow the main name until somebody edits one by hand.
  const shopName = (v: string) =>
    names[v] ?? (mainName.trim() ? `${mainName.trim()} — ${verticalLabel(v)}` : "");

  // ── Existing vendor search ────────────────────────────────────────────────
  useEffect(() => {
    if (who !== "existing") return;
    const t = search.trim();
    if (t.length < 2) { setMatches([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await apiClient.findVendors(t);
        if (!cancelled) setMatches(r?.vendors || []);
      } catch (err) {
        if (!cancelled) {
          setMatches([]);
          toast(err instanceof Error ? err.message : "Could not search vendors", "error");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search, who]);

  // ── Logo ──────────────────────────────────────────────────────────────────
  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await apiClient.uploadImage(file);
      setLogo(r.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "The picture could not be uploaded", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Checks: the vendor app's, in the vendor app's words ──────────────────
  const check = (): Errors => {
    const e: Errors = {};
    if (who === "new") {
      if (ownerName.trim().length < 3) {
        e.ownerName = ownerName.trim() ? "Name must be at least 3 characters" : "Name is required";
      }
      if (email.trim() && !/^[\w.+\-]+@[a-zA-Z\d\-]+(\.[a-zA-Z\d\-]+)*\.[a-zA-Z]{2,}$/.test(email.trim())) {
        e.email = "Enter a valid email or leave it empty";
      }
      const pp = phoneProblem(phone);
      if (pp) e.phone = pp;
      const pw = passwordProblem(password);
      if (pw) e.password = pw;
      else if (confirm !== password) e.confirm = "Passwords do not match";
    } else if (!vendor) {
      e.vendor = "Find and pick the vendor first";
    } else if (vendor.is_suspended) {
      e.vendor = "This vendor is suspended. Unsuspend them before adding a shop.";
    }
    if (many) {
      if (!mainName.trim() && picked.some((v) => !names[v]?.trim())) e.mainName = "Main name is required";
      picked.forEach((v) => {
        if (!shopName(v).trim()) e[`name_${v}`] = "Name is required";
      });
    } else if (!soloName.trim()) {
      e.name = `${nameLabelFor(single)} is required`;
    }
    // The pin first: it is the first thing in the Shop location box.
    if (!hasPin(lat, lon)) {
      e.pin = "Put the shop on the map — customers cannot see it without this";
    }
    if (!address.trim()) e.address = "Shop address is required";
    if (hasFood && !cuisine) e.cuisine = "Please choose a cuisine type";
    if (minOrder.trim()) {
      const n = Number(minOrder);
      if (!Number.isFinite(n)) e.minOrder = "Enter a number, e.g. 300";
      else if (n < 0) e.minOrder = "Cannot be negative";
    }
    if (!open24) {
      if (!HHMM.test(openTime)) e.openTime = "Pick an opening time";
      if (!HHMM.test(closeTime)) e.closeTime = "Pick a closing time";
    }
    return e;
  };

  useEffect(() => {
    if (tried && step === 2) setErrors(check());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tried, step, who, vendor, ownerName, email, phone, password, confirm, mainName, names,
      soloName, address, lat, lon, cuisine, minOrder, openTime, closeTime, open24]);

  const submit = async () => {
    if (saving) return;
    setTried(true);
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) {
      toTop();
      toast(`${thingsToFix(Object.keys(e).length)} — they are marked in red`, "error");
      return;
    }
    const shops = picked.map((v) => ({
      store_name: (many ? shopName(v) : soloName).trim(),
      vendor_type: v,
      ...(v === "restaurant" ? { cuisine_type: cuisine } : {}),
    }));
    setSaving(true);
    try {
      const res = await apiClient.createStore({
        ...(who === "existing" && vendor
          ? { existing_owner_id: vendor.id }
          : {
              owner_name: ownerName.trim(),
              phone: phone.trim(),
              email: email.trim() || undefined,
              password,
            }),
        shops,
        address: address.trim(),
        description: description.trim() || undefined,
        latitude: Number(lat),
        longitude: Number(lon),
        minimum_order: minOrder.trim() ? Number(minOrder) : 0,
        // "Open 24 hours" sends the same time twice — the vendor app's rule,
        // which the server reads as "never closed".
        opening_time: open24 ? "00:00" : openTime,
        closing_time: open24 ? "00:00" : closeTime,
        image_url: logo || undefined,
        open_now: openNow,
      });
      setResult(res);
      setStep(3);
      onCreated();
      toast(res.stores.length > 1 ? `${res.stores.length} shops created` : "Store created", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "The store could not be created", "error");
    } finally {
      setSaving(false);
    }
  };

  // WHO TO RING IF SOMETHING GOES WRONG.
  //
  // The person signing the vendor up, taken from the profile already stored in
  // this browser. Without it the shopkeeper has a password and no human being
  // attached to it, and his first move is to ring whoever's number he happens
  // to have.
  //
  // Read once, in an effect rather than during drawing: localStorage does not
  // exist while the page is being made on the server.
  const [helperLine, setHelperLine] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_user");
      if (!raw) return;
      const me = JSON.parse(raw);
      const name = String(me?.full_name || "").trim();
      // A made-up placeholder like "admin-b21a92803528" is not a phone number
      // and must never be sent to a vendor as one.
      const phone = String(me?.phone || "").trim();
      const real = /^[0-9+][0-9\s-]{6,}$/.test(phone) ? phone : "";
      setHelperLine([name, real].filter(Boolean).join(" · "));
    } catch {
      /* A stored profile that will not parse simply leaves the line out. */
    }
  }, []);

  // WHAT THE SHOPKEEPER IS ACTUALLY HANDED.  (Mock 109, part C, 22 Sep 2026.)
  //
  // This used to be the shop name, the phone and the password. A shopkeeper
  // receiving that on WhatsApp has been told his password and NOT told where
  // to type it, so the first thing he does is ring whoever signed him up.
  //
  // It now carries the three things he needs and one he must be told:
  // where to get the app, how to sign in, who to ring, and that the password
  // is temporary.
  const loginText = useMemo(() => {
    if (!result) return "";
    const many = result.stores.length > 1;
    const lines = [
      `Takal Vendors — your login`,
      ``,
      `Shop${many ? "s" : ""}: ${result.stores.map((s) => s.name).join(", ")}`,
      `Get the app: ${VENDOR_APP_LINK}`,
      `Sign in with this phone: ${result.credentials.phone}`,
    ];
    if (result.credentials.password) {
      lines.push(`Password: ${result.credentials.password}`);
      lines.push(``);
      lines.push(`Please change this password the first time you sign in.`);
    } else {
      lines.push(``);
      lines.push(`Use the password you already have.`);
    }
    lines.push(``);
    lines.push(`Your shop${many ? "s" : ""} will go live after Takal approves ${many ? "them" : "it"}.`);
    if (helperLine) lines.push(`Any problem, contact ${helperLine}`);
    return lines.join("\n");
  }, [result, helperLine]);

  /**
   * FOR A SHOPKEEPER WITH NO SMARTPHONE.
   *
   * A separate window with nothing but the words, printed straight away. Not
   * window.print() on this page: that would print the whole panel behind the
   * box - the sidebar, the shop list, whoever else's details are on screen.
   *
   * The password is written into this window and nowhere else. Close it and it
   * is gone, exactly like the box it came from.
   */
  const printLogin = () => {
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) {
      toast("Your browser blocked the print window. Use Copy instead.", "error");
      return;
    }
    const safe = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><meta charset="utf-8"><title>Takal Vendors login</title>` +
      `<style>body{font-family:system-ui,Arial,sans-serif;padding:32px;color:#000}` +
      `h1{font-size:20px;margin:0 0 4px}pre{font-size:15px;line-height:1.7;` +
      `white-space:pre-wrap;border:2px solid #FFFF00;padding:16px;border-radius:8px}` +
      `small{color:#4A4A4A}</style>` +
      `<h1>Takal</h1><small>Keep this safe. It is not stored anywhere.</small>` +
      `<pre>${safe(loginText)}</pre>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  // ── Drawing ───────────────────────────────────────────────────────────────
  const E = errors;
  return (
    <div ref={scroller} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6"
      onClick={() => { if (!saving && !uploading && step !== 2) close(); }}>
      <div className="my-auto w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl sm:p-7" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Create a store">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-takal-ink">Create a store</h2>
            <p className="mt-1 text-sm text-takal-ink-soft">The same form a vendor fills in the Takal Vendors app.</p>
          </div>
          <button onClick={close} disabled={saving || uploading} className="text-2xl leading-none text-takal-ink-soft hover:text-takal-ink disabled:opacity-40" aria-label="Close">×</button>
        </div>
        <Steps step={step} />

        {step !== 3 && (
          <div className="my-5 inline-flex rounded-lg border-2 border-takal-yellow p-1">
            {(["new", "existing"] as const).map((w) => (
              <button key={w} type="button" onClick={() => { setWho(w); setErrors({}); setTried(false); }}
                className={`rounded-md px-4 py-1.5 text-sm font-bold ${who === w ? "bg-takal-yellow text-takal-ink" : "text-takal-ink-soft hover:text-takal-ink"}`}>
                {w === "new" ? "New vendor" : "Existing vendor"}
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <Switch on={many} onChange={setManyMode}
              label="This vendor sells many kinds of things (for example a mall)"
              hint="Pick every kind. Takal makes one shop for each kind, all under ONE login." />
            <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">{many ? "Pick every kind this vendor sells" : "What kind of business is it?"}</p>
              {many && picked.length > 0 && (
                <span className="rounded-lg bg-takal-yellow-soft px-3 py-1 text-sm font-bold">
                  {picked.length} kind{picked.length > 1 ? "s" : ""} picked → {picked.length} shop{picked.length > 1 ? "s" : ""} will be made
                </span>
              )}
            </div>
            {E.kinds && <p className="mb-3 text-sm font-medium text-takal-red">⚠ {E.kinds}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {/* SIGNUP_VERTICALS, not VERTICALS - the thirteen DEPARTMENTS.
                  The eight sections (Bakery, Jewelry, Toys, Furniture, Garden,
                  Meat & Chicken, Fruit & Veg, Cleaning) are retired: an admin
                  can still name, filter, edit and set a commission on a shop
                  that is already on one, but a NEW shop is never offered them.
                  Mock 113. */}
              {SIGNUP_VERTICALS.map((v) => {
                const sel = picked.includes(v.value);
                return (
                  <button key={v.value} type="button" onClick={() => toggleKind(v.value)} aria-pressed={sel}
                    className={`relative rounded-xl border-2 p-3 text-left transition ${
                      sel ? "border-takal-ink bg-takal-yellow-soft shadow" : "border-takal-line bg-white hover:border-takal-yellow"
                    }`}>
                    <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center text-xs font-bold ${many ? "rounded" : "rounded-full"} ${
                      sel ? "border-2 border-takal-ink bg-takal-yellow" : many ? "border-2 border-takal-line bg-white" : ""
                    }`}>{sel ? "✓" : ""}</span>
                    <span className="block text-3xl">{v.emoji}</span>
                    <span className="mt-1 block text-sm font-bold text-takal-ink">{v.label}</span>
                    {/* The line that stops the guessing. A tile saying only
                        "Food & Drinks" tells a baker no more than "Food" did;
                        reading the word "bakery" under it tells him where he
                        belongs. Mock 113. */}
                    {v.examples ? (
                      <span className="mt-0.5 block text-xs text-takal-ink-soft">{v.examples}</span>
                    ) : null}
                    <span className={`mt-0.5 block text-xs ${byRider(v.value) ? "text-takal-green" : "text-takal-purple"}`}>
                      {byRider(v.value) ? "🛵 Delivered by rider" : "📦 Shipped to customer"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" size="lg" className="flex-1" onClick={close}>Cancel</Button>
              <Button size="lg" className="flex-1" onClick={next}>Next ›</Button>
            </div>
          </>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-takal-yellow-soft px-4 py-3">
              <span className="text-2xl">{picked.map((v) => verticalEmoji(v)).join(" ")}</span>
              <div className="flex-1 text-sm">
                <div className="font-bold">
                  {picked.length === 1
                    ? `${verticalLabel(single)} · ${byRider(single) ? "Delivered by rider" : "Shipped to customer"}`
                    : `${picked.length} shops: ${picked.map((v) => verticalLabel(v)).join(", ")}`}
                </div>
                <div className="text-xs text-takal-ink-soft">Chosen in step 1</div>
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-sm font-bold underline">Change</button>
            </div>

            {Object.keys(E).length > 0 && (
              <div className="mb-5 rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
                <strong>{thingsToFix(Object.keys(E).length)} before this store can be created.</strong> They are marked in red below.
              </div>
            )}

            {who === "new" ? (
              <Section title="Owner Details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label text="Full Name *" error={E.ownerName}>
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputCls(E.ownerName)} maxLength={120} />
                  </Label>
                  <Label text="Email Address (Optional)" error={E.email}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls(E.email)} placeholder="name@example.com" maxLength={200} />
                  </Label>
                  <Label text="Phone Number *" error={E.phone}
                    hint={phone.trim() && !phoneProblem(phone) ? `Saved as ${savedPhone(phone)} — the vendor signs in with this` : "The vendor signs in with this number"}>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls(E.phone)} inputMode="tel" maxLength={20} placeholder="0300 1234567" />
                  </Label>
                  <div className="hidden sm:block" />
                  <Label text="Password *" error={E.password} hint="At least 6 characters, with a letter">
                    <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls(E.password)} maxLength={128} autoComplete="new-password" />
                  </Label>
                  <Label text="Confirm Password *" error={E.confirm}>
                    <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls(E.confirm)} maxLength={128} autoComplete="new-password" />
                  </Label>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Button variant="secondary" size="sm" onClick={() => { const p = makePassword(); setPassword(p); setConfirm(p); setShowPw(true); }}>
                    🔑 Make a password for me
                  </Button>
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="text-xs font-bold underline">
                    {showPw ? "Hide password" : "Show password"}
                  </button>
                  <span className="text-xs text-takal-ink-soft">No phone code is needed — you are creating this in the office.</span>
                </div>
              </Section>
            ) : (
              <Section title="Vendor">
                <Label text="Find the vendor" error={E.vendor} hint="Search by name or phone number">
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setVendor(null); }} className={inputCls(E.vendor)} placeholder="Type at least 2 letters or digits" maxLength={60} />
                </Label>
                {vendor ? (
                  <div className="flex items-center gap-3 rounded-lg border-2 border-takal-ink bg-takal-yellow-soft p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-takal-yellow font-bold">
                      {(vendor.full_name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-bold">{vendor.full_name}</div>
                      <div className="truncate text-takal-ink-soft">
                        {vendor.phone} · {vendor.shops.length} shop{vendor.shops.length === 1 ? "" : "s"}
                        {vendor.shops.length ? `: ${vendor.shops.map((s) => s.name).join(", ")}` : ""}
                      </div>
                    </div>
                    <span className="text-sm font-bold">✓ Selected</span>
                    <button type="button" onClick={() => setVendor(null)} className="text-sm font-bold underline">Change</button>
                  </div>
                ) : (
                  <div className="divide-y divide-takal-line rounded-lg border border-takal-line">
                    {searching && <div className="px-3 py-2 text-sm text-takal-ink-soft">Searching…</div>}
                    {!searching && search.trim().length >= 2 && matches.length === 0 && (
                      <div className="px-3 py-2 text-sm text-takal-ink-soft">No vendor found. Check the spelling, or use &quot;New vendor&quot;.</div>
                    )}
                    {matches.map((m) => (
                      <button key={m.id} type="button" onClick={() => setVendor(m)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-takal-yellow-soft">
                        <span className="flex-1">
                          <span className="font-bold">{m.full_name}</span>{" "}
                          <span className="text-takal-ink-soft">· {m.phone} · {m.shops.length} shop{m.shops.length === 1 ? "" : "s"}</span>
                        </span>
                        {m.is_suspended && <span className="rounded bg-takal-red-soft px-2 py-0.5 text-xs font-bold text-takal-red">Suspended</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-takal-ink-soft">
                  The new shop is added to this vendor&apos;s login — the same as &quot;Add another store&quot; in the app. No new password is made.
                </p>
              </Section>
            )}

            {many ? (
              <>
                <Section title="Shop Names">
                <>
                  <Label text="Main name *" error={E.mainName} hint="Each shop is named from this. You can change any of them below.">
                    <input value={mainName} onChange={(e) => setMainName(e.target.value)} className={inputCls(E.mainName)} maxLength={120} placeholder="City Mall" />
                  </Label>
                  <div className="divide-y divide-takal-line rounded-lg border border-takal-line">
                    {picked.map((v) => (
                      <div key={v} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                        <span className="text-xl">{verticalEmoji(v)}</span>
                        <input value={shopName(v)} onChange={(e) => setNames((n) => ({ ...n, [v]: e.target.value }))}
                          className={`min-w-[160px] flex-1 ${inputCls(E[`name_${v}`])}`} maxLength={150}
                          placeholder={`${nameLabelFor(v)} for ${verticalLabel(v)}`} />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${byRider(v) ? "bg-takal-green-soft text-takal-green" : "bg-takal-purple-soft text-takal-purple"}`}>
                          {byRider(v) ? "🛵 Rider" : "📦 Parcel"}
                        </span>
                        <span className="text-xs text-takal-ink-soft">Commission: {verticalLabel(v)} rate</span>
                      </div>
                    ))}
                  </div>
                </>
                </Section>

                <Section title="Shared by All Shops">
                  <p className="text-sm text-takal-ink-soft">Filled in once and copied to every shop — each can be changed later on its own store page.</p>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-takal-line bg-takal-page text-center text-xs text-takal-ink-soft hover:border-takal-yellow">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Shop logo" className="h-full w-full object-cover" />
                  ) : uploading ? "Uploading…" : (<><span className="text-2xl">📷</span>Tap to add</>)}
                </button>
                <div className="text-sm">
                  <div className="font-bold">Shop Logo / Picture</div>
                  <div className="text-xs text-takal-ink-soft">Optional. JPG or PNG. Made small automatically.</div>
                  {logo && <button type="button" onClick={() => setLogo("")} className="mt-1 text-xs font-bold underline">Remove</button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </div>
              <Label text="Description (optional)">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls()} maxLength={2000} placeholder="What does the shop sell?" />
              </Label>
              {/* ONE box for where the shop is: search, pin, address (Mock 85). */}
              <ShopLocationBox
                value={{ lat, lon, address }}
                onChange={(v) => { setLat(v.lat); setLon(v.lon); setAddress(v.address); }}
                pinError={E.pin}
                addressError={E.address}
              />
                </Section>
              </>
            ) : (
              // ONE section for one shop, in the vendor app's order (Mock 74):
              // picture, name, description, address, map.
              <Section title={single === "restaurant" ? "Restaurant Details" : "Shop Details"}>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-takal-line bg-takal-page text-center text-xs text-takal-ink-soft hover:border-takal-yellow">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Shop logo" className="h-full w-full object-cover" />
                  ) : uploading ? "Uploading…" : (<><span className="text-2xl">📷</span>Tap to add</>)}
                </button>
                <div className="text-sm">
                  <div className="font-bold">Shop Logo / Picture</div>
                  <div className="text-xs text-takal-ink-soft">Optional. JPG or PNG. Made small automatically.</div>
                  {logo && <button type="button" onClick={() => setLogo("")} className="mt-1 text-xs font-bold underline">Remove</button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </div>
              <Label text={`${nameLabelFor(single)} *`} error={E.name}>
                  <input value={soloName} onChange={(e) => setSoloName(e.target.value)} className={inputCls(E.name)} maxLength={150} />
                </Label>
              <Label text="Description (optional)">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls()} maxLength={2000} placeholder="What does the shop sell?" />
              </Label>
              {/* ONE box for where the shop is: search, pin, address (Mock 85). */}
              <ShopLocationBox
                value={{ lat, lon, address }}
                onChange={(v) => { setLat(v.lat); setLon(v.lon); setAddress(v.address); }}
                pinError={E.pin}
                addressError={E.address}
              />
              </Section>
            )}

            {hasFood && (
              <Section title="Cuisine Type *">
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((c) => (
                    <button key={c.value} type="button" onClick={() => setCuisine(c.value)} aria-pressed={cuisine === c.value}
                      className={`rounded-full border-2 px-3 py-1 text-sm ${
                        cuisine === c.value ? "border-takal-ink bg-takal-yellow font-bold" : E.cuisine ? "border-takal-red/60" : "border-takal-line hover:border-takal-yellow"
                      }`}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
                {E.cuisine && <span className="block text-xs font-medium text-takal-red">⚠ {E.cuisine}</span>}
                <p className="text-xs text-takal-ink-soft">Shown only for Food shops — exactly as in the vendor app.</p>
              </Section>
            )}

            <Section title="Orders and Opening Hours">
              <div className="grid gap-3 sm:grid-cols-3">
                <Label text="Min Order (Rs)" error={E.minOrder} hint="Blank = no minimum">
                  <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className={inputCls(E.minOrder)} inputMode="numeric" placeholder="300" />
                </Label>
                <Label text="Opens at" error={E.openTime}>
                  <input type="time" value={openTime} disabled={open24} onChange={(e) => setOpenTime(e.target.value)} className={`${inputCls(E.openTime)} disabled:opacity-40`} />
                </Label>
                <Label text="Closes at" error={E.closeTime}>
                  <input type="time" value={closeTime} disabled={open24} onChange={(e) => setCloseTime(e.target.value)} className={`${inputCls(E.closeTime)} disabled:opacity-40`} />
                </Label>
              </div>
              <Switch on={open24} onChange={setOpen24} label="Open 24 hours" hint="When on, the shop never closes by the clock." />
            </Section>

            <Section title="When It Is Created">
              <div className="rounded-lg bg-takal-orange-soft px-3 py-2 text-sm text-[#C8410F]">
                <strong>⏳ Waits for approval</strong> — like every shop made in the Vendors app. Approve it in Stores → Pending.
                Customers cannot see it until then.
              </div>
              <Switch on={openNow} onChange={setOpenNow} label="Open for orders once approved"
                hint="Off: after approval the shop stays Closed until the vendor switches it on in the app." />
              {who === "new" && (
                <div className="rounded-lg border-l-4 border-takal-blue bg-takal-blue-soft px-3 py-2 text-xs text-takal-blue">
                  The vendor will be asked to accept the Terms and Privacy Policy the first time they sign in to the app.
                </div>
              )}
            </Section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" size="lg" className="flex-1" disabled={saving} onClick={() => setStep(1)}>‹ Back</Button>
              <Button size="lg" className="flex-1" loading={saving} disabled={uploading} onClick={submit}>
                {saving ? "Creating…" : picked.length > 1 ? `Create ${picked.length} shops` : "Create store"}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
        {step === 3 && result && (
          <div className="mt-5">
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-takal-orange-soft px-4 py-3 text-[#C8410F]">
              <span className="text-2xl">⏳</span>
              <div>
                <div className="font-bold">
                  {result.stores.length > 1
                    ? `${result.stores.length} shops created for ${(who === "new" && mainName.trim()) || result.owner_name} — waiting for approval`
                    : `${result.stores[0]?.name} is created — waiting for approval`}
                </div>
                <div className="text-sm">
                  Approve {result.stores.length > 1 ? "each shop" : "it"} in Stores → Pending.{" "}
                  {result.is_open
                    ? "Once approved, it opens for orders."
                    : `Once approved, it stays Closed until ${result.owner_name} opens ${result.stores.length > 1 ? "them" : "it"} in the app.`}
                  {result.stores.length > 1 && " In the Vendors app he picks which shop to run from his store list."}
                </div>
              </div>
            </div>
            {result.stores.length > 1 && (
            <div className="divide-y divide-takal-line rounded-lg border border-takal-line">
              {result.stores.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="text-xl">{verticalEmoji(s.vendor_type)}</span>
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="text-xs">{byRider(s.vendor_type) ? "🛵 Rider" : "📦 Parcel"}</span>
                  <a href={`/dashboard/stores/${s.id}`} className="font-bold underline">Open</a>
                </div>
              ))}
            </div>
            )}
            <div className={`${result.stores.length > 1 ? "mt-4" : ""} divide-y divide-takal-line rounded-lg border border-takal-line bg-takal-page px-4 py-1 text-sm`}>
              {result.stores.length === 1 && (
                <>
                  <div className="flex justify-between gap-3 py-1.5">
                    <span className="text-takal-ink-soft">Shop type</span>
                    <span className="font-bold">
                      {verticalEmoji(result.stores[0].vendor_type)} {verticalLabel(result.stores[0].vendor_type)}
                      {(() => {
                        // The server sends the cuisine back; the form's own
                        // choice is the fallback.
                        const c = result.stores[0].cuisine_type
                          || (result.stores[0].vendor_type === "restaurant" ? cuisine : "");
                        return c ? ` · ${CUISINES.find((x) => x.value === c)?.label ?? c}` : "";
                      })()}
                      {" · "}{byRider(result.stores[0].vendor_type) ? "🛵 Rider" : "📦 Parcel"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 py-1.5">
                    <span className="text-takal-ink-soft">Hours</span>
                    <span className="font-bold">
                      {open24 ? "Open 24 hours" : `${openTime} – ${closeTime}`}
                      {minOrder.trim() && Number(minOrder) > 0 ? ` · Min order Rs ${Number(minOrder).toLocaleString("en-PK")}` : ""}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-3 py-1.5"><span className="text-takal-ink-soft">Sign-in phone</span><span className="font-mono">{result.credentials.phone}</span></div>
              {result.credentials.password ? (
                <div className="flex justify-between gap-3 py-1.5"><span className="text-takal-ink-soft">Password</span><span className="font-mono">{result.credentials.password}</span></div>
              ) : (
                <div className="py-1.5 text-takal-ink-soft">The vendor keeps the password they already have.</div>
              )}
            </div>
            {result.credentials.password && (
              <p className="mt-2 text-xs text-takal-ink-soft">
                The password is shown <strong>only now</strong>. It is not stored
                anywhere and nobody can read it back — not even Takal. Copy it,
                send it or print it before you close this box. If it is lost, a
                new one has to be set.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(loginText); toast("Copied", "success"); }}>
                📋 {result.credentials.password ? "Copy phone and password" : "Copy login details"}
              </Button>
              <Button variant="secondary" onClick={() => window.open(
                `https://wa.me/${whatsappNumber(result.credentials.phone)}?text=${encodeURIComponent(loginText)}`,
                "_blank", "noopener,noreferrer")}>
                💬 Send on WhatsApp
              </Button>
              {/* For a shopkeeper with no smartphone. Mock 109, part C. */}
              <Button variant="secondary" onClick={printLogin}>
                🖨️ Print it
              </Button>
              {result.stores.length === 1 ? (
                <>
                  <Button variant="secondary" onClick={() => { window.location.href = `/dashboard/stores/${result.stores[0].id}`; }}>
                    🏪 Open the store page
                  </Button>
                  <Button onClick={close}>Done</Button>
                </>
              ) : (
                <Button className="sm:col-span-2" onClick={close}>Done</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
