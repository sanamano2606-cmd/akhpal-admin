"use client";

// ─────────────────────────────────────────────────────────────────────────────
// A MALL'S OWN STAFF LOGINS - THE MAIN ADMIN'S TAB.
// Mock 133 pictures C-G, approved 1 October 2026 ("Takal Main Admin Only").
//
// Drawn ONLY for the Main Admin (page.tsx decides). That is a courtesy, not
// the lock: every /admin/shop-staff door is __super__ in app_guard AND calls
// _require_main_admin in routers/shop_staff.py.
//
// A password is typed here (or made by the existing password-maker), SENT to
// the server, shown on this screen ONCE, and never received back.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, KeyRound, Mail, Power, RefreshCw, Smartphone, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShopStaffMember } from "@/lib/api-people";
import { makeAdminPassword } from "@/lib/make-admin-password";
import { MIN_ADMIN_PASSWORD, strengthOf } from "@/lib/password-strength";
import { staffWelcomeText } from "@/lib/staff-sign-in";
import { fmtDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Button, ConfirmDialog, Modal } from "@/components/ui";

const BAR = ["bg-takal-red w-1/3", "bg-takal-orange w-2/3", "bg-takal-green w-full"];
const WORD = ["text-takal-red", "text-takal-orange", "text-takal-green"];
const FACES = ["bg-takal-blue", "bg-takal-green", "bg-takal-orange", "bg-takal-purple", "bg-takal-red"];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

/** The password box with Show and Make another - the same one the Admin
 *  reset window uses (Mock 110), so both look and behave alike. */
function PasswordBox({ pw, setPw }: { pw: string; setPw: (v: string) => void }) {
  const [show, setShow] = useState(true);
  const strength = strengthOf(pw);
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="off"
          aria-label="First password"
          className="w-full rounded-lg border-2 border-takal-line px-4 py-3 pr-24 font-mono text-takal-ink focus:border-takal-yellow focus:outline-none"
        />
        <button type="button" onClick={() => setShow((v) => !v)}
          className="absolute right-12 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100"
          aria-label={show ? "Hide the password" : "Show the password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => setPw(makeAdminPassword())}
          className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100"
          aria-label="Make another password" title="Make another">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${BAR[strength.step]}`} />
        </div>
        <span className={`text-xs ${WORD[strength.step]}`}>{strength.word}</span>
        <span className="text-xs text-takal-ink-soft"> · {pw.length} characters. Made for you — you may type your own.</span>
      </div>
    </div>
  );
}

/** "Give him these 3 things" - shown once (Mock 133 picture F, step 2). */
function GiveThese({ title, text, onClose }: {
  title: string; text: string; password: string; onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={title} hint="Shown once. Nobody can read it back afterwards." size="md"
      footer={<Button onClick={onClose}>Done</Button>}>
      <pre className="whitespace-pre-wrap rounded-xl bg-[#111111] p-4 font-sans text-sm leading-7 text-white">{text}</pre>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(text); toast("Copied", "success"); }}>
          📋 Copy all 3
        </Button>
        <Button variant="secondary" onClick={() =>
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")}>
          💬 WhatsApp
        </Button>
      </div>
      <div className="mt-4 flex gap-2.5 rounded-lg border border-[#FFC7B0] bg-takal-orange-soft p-3 text-sm text-[#9A3412]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>This password is shown only now.</b> Takal keeps only a scrambled copy. If it is
          lost, press <b>New password</b> on the row.</p>
      </div>
    </Modal>
  );
}

/** The mall this store is in - a login can then be given the WHOLE mall
 *  (every store of it). Migration 127, Mock 172-6 (Sana, 8 Oct 2026: "staff
 *  log in should have access to all stores of that Mall"). */
export type StaffMall = { id: string; name: string; storeCount: number };

export function MallStaffTab({ restaurantId, shopName, staff, loading, error, reload, mall }: {
  restaurantId: string;
  shopName: string;
  staff: ShopStaffMember[];
  loading: boolean;
  error: string;
  reload: () => void;
  mall?: StaffMall | null;
}) {
  const address = typeof window !== "undefined" ? window.location.origin : "";
  // Where the login works, in words: the whole mall, or the one store.
  const whereFor = (wholeMall: boolean) =>
    wholeMall && mall ? `${mall.name} (all ${mall.storeCount} stores)` : shopName;

  // ── Whole mall on / off (Main Admin only, like every staff change) ───────
  const [mallBusy, setMallBusy] = useState("");
  const setWholeMall = async (s: ShopStaffMember, on: boolean) => {
    if (!mall) return;
    setMallBusy(s.id);
    try {
      await apiClient.setShopStaffMall(s.id, on ? mall.id : null);
      toast(on ? `${s.full_name} now works in every store of ${mall.name}`
               : `${s.full_name} now works in ${s.shop_name || shopName} only`, "success");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That did not work. Please try again.", "error");
    } finally {
      setMallBusy("");
    }
  };

  // ── Add ──────────────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [wholeMall, setWholeMallNew] = useState(true);
  const [formError, setFormError] = useState("");
  const [given, setGiven] = useState<{ title: string; text: string; password: string } | null>(null);

  const openAdd = () => {
    setName(""); setPhone(""); setEmail(""); setFormError("");
    setPw(makeAdminPassword());
    setWholeMallNew(!!mall);
    setAdding(true);
  };

  const add = async () => {
    setFormError("");
    const n = name.trim(), p = phone.trim(), m = email.trim();
    if (n.length < 2) return setFormError("Type their full name.");
    if (!p && !m) return setFormError("Give a phone number or an email — they sign in with it.");
    if (pw.length < MIN_ADMIN_PASSWORD) return setFormError(`The password needs at least ${MIN_ADMIN_PASSWORD} characters.`);
    setBusy(true);
    try {
      await apiClient.addShopStaff({
        restaurant_id: restaurantId, full_name: n, password: pw,
        ...(p ? { phone: p } : {}), ...(m ? { email: m } : {}),
        ...(mall && wholeMall ? { mall_id: mall.id } : {}),
      });
      setAdding(false);
      const first = n.split(/\s+/)[0];
      setGiven({
        title: `${n} can now sign in`,
        // The phone is shown as typed; the server took out spaces and dashes,
        // and the sign-in box does the same, so either way works.
        text: staffWelcomeText({ name: n, shop: whereFor(wholeMall), phone: p, email: m.toLowerCase(), password: pw, address }),
        password: pw,
      });
      toast(`${first} added to ${whereFor(wholeMall)}`, "success");
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not add them. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Switch off / on ──────────────────────────────────────────────────────
  const [flip, setFlip] = useState<ShopStaffMember | null>(null);
  const [flipping, setFlipping] = useState(false);
  const doFlip = async () => {
    if (!flip) return;
    setFlipping(true);
    try {
      await apiClient.setShopStaffActive(flip.id, !flip.is_active);
      toast(flip.is_active ? `${flip.full_name} is switched off` : `${flip.full_name} can sign in again`, "success");
      setFlip(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That did not work. Please try again.", "error");
    } finally {
      setFlipping(false);
    }
  };

  // ── New password ─────────────────────────────────────────────────────────
  const [resetFor, setResetFor] = useState<ShopStaffMember | null>(null);
  const [newPw, setNewPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  useEffect(() => {
    if (resetFor) { setNewPw(makeAdminPassword()); setResetError(""); }
  }, [resetFor]);
  const doReset = async () => {
    if (!resetFor) return;
    if (newPw.length < MIN_ADMIN_PASSWORD) {
      setResetError(`The password needs at least ${MIN_ADMIN_PASSWORD} characters.`);
      return;
    }
    setResetting(true);
    try {
      await apiClient.resetShopStaffPassword(resetFor.id, newPw);
      const who = resetFor;
      setResetFor(null);
      setGiven({
        title: `New password for ${who.full_name}`,
        text: staffWelcomeText({ name: who.full_name, shop: whereFor(!!mall && who.mall_id === mall.id), phone: who.phone, email: who.email, password: newPw, address }),
        password: newPw,
      });
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Could not set the password. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-[#EDE88A] bg-gradient-to-r from-takal-yellow-soft to-white px-4 py-3">
        <span className="text-2xl" aria-hidden>🏬</span>
        <div className="min-w-[220px] flex-1">
          <p className="font-bold text-takal-ink">{mall ? `${mall.name}’s own logins` : `${shopName}’s own logins`}</p>
          <p className="text-[13px] text-takal-ink-soft">
            {mall ? (
              <>Each person signs in with “Shop staff”. A <b>whole-mall</b> login works in <u>every store of {mall.name}</u> —
                products, pictures, settings and orders. Never commission, fees, payments or other shops.</>
            ) : (
              <>Each person signs in with “Shop staff” and sees <u>only {shopName}</u> — its products,
                pictures and settings. Never commission, fees, payments or other shops.</>
            )}
          </p>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-takal-yellow px-4 py-2.5 text-sm font-bold text-takal-ink shadow-[0_2px_0_#C9C900] hover:bg-takal-yellow-dark">
          <UserPlus className="h-4 w-4" /> Add staff member
        </button>
      </div>

      {error && staff.length > 0 && (
        <p role="alert" className="rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">
          The list below may be out of date - it could not be read again: {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-[1.5px] border-takal-line bg-[#FAFAF7] text-left text-[11px] uppercase tracking-wider text-takal-ink-soft">
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Signs in with</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {error && staff.length === 0 ? (
              // The list could not be read: say so. "No staff logins yet" here
              // would be a fact nobody checked.
              <tr><td colSpan={5} className="px-3 py-8 text-center">
                <p className="text-takal-red">The staff list could not be read: {error}</p>
                <button onClick={reload} className="mt-2 rounded-lg bg-takal-yellow px-4 py-2 text-sm font-semibold text-takal-ink hover:bg-takal-yellow-dark">
                  Try again
                </button>
              </td></tr>
            ) : loading && staff.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-takal-ink-soft">Loading…</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-takal-ink-soft">
                No staff logins yet. Press “Add staff member”.
              </td></tr>
            ) : staff.map((s, i) => (
              <tr key={s.id} className={`border-b border-[#F0F0F0] hover:bg-[#FFFEE8] ${s.is_active ? "" : "text-takal-disabled-text"}`}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold text-white ${s.is_active ? FACES[i % FACES.length] : "bg-[#BDBDBD]"}`}>
                      {initials(s.full_name)}
                    </div>
                    <div>
                      <p className={`font-bold ${s.is_active ? "text-takal-ink" : ""}`}>{s.full_name}</p>
                      <p className="text-xs text-takal-ink-soft">
                        {mall && s.mall_id === mall.id
                          ? `Whole mall · all ${mall.storeCount} stores`
                          : mall ? `Only ${s.shop_name || shopName}` : "Shop staff"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {s.phone && <p className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" />{s.phone}</p>}
                  {s.email && <p className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{s.email}</p>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {s.is_active ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-semibold text-takal-green">
                      <span className="h-2 w-2 rounded-full bg-takal-green" /> Can sign in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEEEEE] px-2.5 py-0.5 text-xs font-semibold text-[#666666]">
                      <span className="h-2 w-2 rounded-full bg-[#888888]" /> Switched off{s.switched_off_at ? ` · ${fmtDate(s.switched_off_at)}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-2">
                    {s.is_active && mall && (
                      <button onClick={() => setWholeMall(s, s.mall_id !== mall.id)} disabled={mallBusy === s.id}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-takal-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-ink hover:border-[#DADA00] hover:bg-[#FFFEE0] disabled:opacity-50">
                        🛍️ {s.mall_id === mall.id ? "Only its own store" : "Give the whole mall"}
                      </button>
                    )}
                    {s.is_active ? (
                      <>
                        <button onClick={() => setResetFor(s)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-takal-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-ink hover:border-[#DADA00] hover:bg-[#FFFEE0]">
                          <KeyRound className="h-3.5 w-3.5" /> New password
                        </button>
                        <button onClick={() => setFlip(s)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-[#F3C2C7] bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-red hover:bg-takal-red-soft">
                          <Power className="h-3.5 w-3.5" /> Switch off
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setFlip(s)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-[#BFE0CF] bg-white px-3 py-1.5 text-[12.5px] font-bold text-takal-green hover:bg-takal-green-soft">
                        <Power className="h-3.5 w-3.5" /> Switch on again
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-takal-ink-soft">
        ℹ️ Switching someone off signs them out on every computer at once. Their name stays here so you can see who had access.
      </p>

      {/* ── Add a staff member (picture F, step 1) ── */}
      {adding && (
        <Modal open onClose={() => setAdding(false)} lockClose={busy} title="Add a staff member" size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
            <Button onClick={add} loading={busy}>＋ Add {name.trim() ? name.trim() : "staff member"}</Button>
          </>}>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-takal-ink">For which shop</p>
              <div className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-takal-line bg-[#FAFAF7] px-3 py-2.5">
                <span className="text-xl" aria-hidden>{mall && wholeMall ? "🛍️" : "🏬"}</span>
                <div className="min-w-0">
                  <p className="font-bold text-takal-ink">{whereFor(wholeMall)}</p>
                  <p className="text-xs text-takal-ink-soft">
                    {mall && wholeMall ? "They will see every store of this mall - and nothing else"
                                       : "Fixed — they will see only this shop"}
                  </p>
                </div>
              </div>
              {mall && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={wholeMall} onChange={(e) => setWholeMallNew(e.target.checked)} />
                  Give them the whole mall ({mall.storeCount} stores)
                </label>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-takal-ink">Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={100}
                className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-takal-ink">
                Phone number <span className="font-normal text-takal-ink-soft">— or an email, or both</span>
              </span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0312 3456789" maxLength={20}
                className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-takal-ink">
                Email <span className="font-normal text-takal-ink-soft">(optional)</span>
              </span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" maxLength={200}
                className="w-full rounded-lg border-[1.5px] border-takal-line px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-takal-yellow" />
            </label>
            <div>
              <p className="mb-1 text-sm font-medium text-takal-ink">First password</p>
              <PasswordBox pw={pw} setPw={setPw} />
              <p className="mt-1 text-xs text-takal-ink-soft">They must choose their own password the first time they sign in.</p>
            </div>
            {formError && (
              <p role="alert" className="rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">{formError}</p>
            )}
          </div>
        </Modal>
      )}

      {/* ── Switch off / on (picture G) ── */}
      <ConfirmDialog
        open={flip !== null}
        busy={flipping}
        danger={flip?.is_active === true}
        onCancel={() => setFlip(null)}
        onConfirm={doFlip}
        title={flip?.is_active ? `Switch off ${flip?.full_name}?` : `Switch ${flip?.full_name} on again?`}
        confirmLabel={flip?.is_active ? `Switch off ${flip?.full_name?.split(/\s+/)[0] || ""}` : "Yes, switch on"}
        message={flip?.is_active ? (
          <>
            <p>What happens <b>straight away</b>:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Signed out on every computer and phone</li>
              <li>Cannot sign in again</li>
              <li>Nothing they changed is undone</li>
            </ul>
            <p className="mt-2 text-takal-ink-soft">You can switch them on again later with the same login.</p>
          </>
        ) : (
          <p>They can sign in again with their old password and will see{" "}
            <b>{whereFor(!!mall && flip?.mall_id === mall.id)}</b>{mall && flip?.mall_id === mall.id ? "" : " only"}.</p>
        )}
      />

      {/* ── New password (picture G) ── */}
      {resetFor && (
        <Modal open onClose={() => setResetFor(null)} lockClose={resetting} title={`New password for ${resetFor.full_name}`} size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setResetFor(null)} disabled={resetting}>Cancel</Button>
            <Button onClick={doReset} loading={resetting}>🔑 Set new password</Button>
          </>}>
          <p className="mb-1 text-sm font-medium text-takal-ink">New first password</p>
          <PasswordBox pw={newPw} setPw={setNewPw} />
          <div className="mt-4 flex gap-2.5 rounded-lg border border-[#FFC7B0] bg-takal-orange-soft p-3 text-sm text-[#9A3412]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{resetFor.full_name.split(/\s+/)[0]} is <b>signed out everywhere</b> at once, and must choose their
              own password at the next sign-in. Give them the new one by phone or WhatsApp.</p>
          </div>
          {resetError && (
            <p role="alert" className="mt-3 rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-3 py-2 text-sm text-takal-red">{resetError}</p>
          )}
        </Modal>
      )}

      {given && <GiveThese {...given} onClose={() => setGiven(null)} />}
    </div>
  );
}
