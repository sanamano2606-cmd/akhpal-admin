"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Shield, ShieldCheck, SlidersHorizontal, X, UserPlus, AlertTriangle,
  ChevronDown, ChevronRight, KeyRound, Lock, Power,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getMyPerms } from "@/lib/perms";
import { isWorking, whyNotSwitchOff as whyNotSwitchOffRule } from "@/lib/admin-accounts";
import {
  TABS, ALL_KEYS, ALWAYS_OPEN, MAIN_ADMIN_ONLY, SENSITIVE_KEYS,
  type Tab, inPlainWords, isNewFormat, tabState, ticksForSavedList,
  toNewFormat,
} from "@/lib/tabs";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { ResetAdminPasswordModal } from "@/components/ResetAdminPasswordModal";
import { errorMessage, readFailure, type ReadFailure } from "@/lib/api-errors";

const nothingTicked = () => new Set<string>();

/** Every key this person ends up holding, for the "in plain words" line and
 *  for the count. A ticked TAB carries its options; they are not ticked one by
 *  one, so they have to be added here or the sentence would leave them out. */
const everythingTicked = (ticked: ReadonlySet<string>) => {
  const out = new Set<string>(ticked);
  for (const t of TABS) if (ticked.has(t.key)) for (const o of t.options) out.add(o.key);
  return out;
};

const initialsOf = (name: string, email: string) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((w) => w[0]).join("").toUpperCase() || "?";
};

/* ─────────────────────────────────────────────────────────────────────────
   THE SWITCH.

   The whole row is one <button role="switch">, not a tick-box with a label
   next to it. Two reasons, and both were real problems with the old grid:

   1. A 13px tick-box is a 13px target. On a laptop trackpad that is a miss
      waiting to happen, and a mis-click here hands someone the money pages.
      The row is ~48px tall, so it cannot be clicked by accident and cannot
      be missed on purpose.
   2. role="switch" + aria-checked is what a screen reader announces as
      "on"/"off". A bare <input type=checkbox> in a grid of ten reads as an
      unlabelled tick with no clue what it controls.

   Colour: near-black for ON, grey for OFF. The brand yellow is reserved for
   buttons; a yellow switch on a white card reads as "highlighted", not as
   "switched on".
   ───────────────────────────────────────────────────────────────────────── */
function SwitchRow({
  on, onChange, title, hint, disabled, disabledNote, tone = "plain",
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  title: string;
  hint?: string;
  disabled?: boolean;
  disabledNote?: string;
  tone?: "plain" | "super" | "sensitive";
}) {
  const ring =
    tone === "super"
      ? "border-slate-900/15 bg-takal-page"
      : on && tone === "sensitive"
      ? "border-amber-300 bg-amber-50/60"
      : "border-takal-line bg-white";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className={`w-full flex items-start gap-4 text-left px-4 py-3 rounded-xl border transition
        ${ring}
        ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-takal-line hover:shadow-sm"}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2`}
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-takal-ink">{title}</span>
          {tone === "sensitive" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              sensitive
            </span>
          )}
        </span>
        {hint && <span className="block text-xs text-takal-ink-soft mt-0.5 leading-relaxed">{hint}</span>}
        {disabled && disabledNote && (
          <span className="block text-xs text-amber-700 mt-1 leading-relaxed">{disabledNote}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors
          ${on ? "bg-slate-900" : "bg-slate-300"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${on ? "translate-x-6" : "translate-x-1"}`}
        />
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   THE PERMISSION PICKER.  (Mock 89, approved by Sana 17 September 2026.)

   One row per sidebar tab. The switch on the right gives the WHOLE tab -
   every option in it, including options added later. Open the row instead and
   tick a single option, and that is all the person gets.

   Two rows have no switch at all, on purpose:
     Dashboard    always on. Its figures are already cut down per permission.
     Admin Users  never. This is what stops a sub-admin giving permission to
                  anybody, including himself.
   ───────────────────────────────────────────────────────────────────────── */
function TabRow({
  tab, ticked, setTicked, open, setOpen,
}: {
  tab: Tab;
  ticked: ReadonlySet<string>;
  setTicked: (next: Set<string>) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
}) {
  const always = ALWAYS_OPEN.includes(tab.key);
  const never = MAIN_ADMIN_ONLY.includes(tab.key);
  const { whole, chosen, total } = tabState(tab, ticked);

  const setWholeTab = (on: boolean) => {
    const next = new Set(ticked);
    if (on) {
      next.add(tab.key);
      // The options underneath are not ticked one by one. The TAB is what is
      // saved, and the tab is what carries anything added to it next month.
      for (const o of tab.options) next.delete(o.key);
    } else {
      next.delete(tab.key);
    }
    setTicked(next);
  };

  const toggleOption = (key: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(key);
    else next.delete(key);
    setTicked(next);
  };

  const chip = always
    ? { text: "Always on", cls: "bg-emerald-50 text-emerald-700" }
    : never
    ? { text: "Never", cls: "bg-red-50 text-red-700" }
    : whole
    ? { text: total ? `All ${total} options` : "On", cls: "bg-emerald-50 text-emerald-700" }
    : chosen > 0
    ? { text: `${chosen} of ${total} options`, cls: "bg-amber-50 text-amber-800" }
    : { text: "Off", cls: "bg-slate-100 text-takal-ink-soft" };

  return (
    <div className="border border-takal-line rounded-xl bg-white overflow-hidden">
      <div className="flex items-start gap-3 px-3 py-3">
        {tab.options.length > 0 && !never ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} the options inside ${tab.label}`}
            className="flex-none mt-0.5 p-1 rounded hover:bg-slate-100 text-takal-ink-soft"
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="flex-none w-6" />
        )}

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-takal-ink">{tab.label}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${chip.cls}`}>
              {chip.text}
            </span>
            {SENSITIVE_KEYS.includes(tab.key) && !never && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                sensitive
              </span>
            )}
          </span>
          {tab.hint && (
            <span className="block text-xs text-takal-ink-soft mt-0.5 leading-relaxed">{tab.hint}</span>
          )}
          {whole && tab.options.length > 0 && (
            <span className="block text-xs text-emerald-700 mt-1 leading-relaxed">
              Whole tab is on — options added later are included automatically.
            </span>
          )}
          {!whole && chosen > 0 && !open && (
            <span className="block text-xs text-amber-800 mt-1 leading-relaxed">
              Only {tab.options.filter((o) => ticked.has(o.key)).map((o) => o.label).join(", ")}
              {" "}— and nothing else in {tab.label}.
            </span>
          )}
        </span>

        {never ? (
          <span className="flex-none mt-0.5 text-xs text-takal-ink-soft flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Main Admin only
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={always ? true : whole}
            aria-label={`Give the whole ${tab.label} tab`}
            disabled={always}
            onClick={() => !always && setWholeTab(!whole)}
            className={`flex-none mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${always ? "bg-slate-200 cursor-not-allowed" : whole ? "bg-slate-900" : "bg-slate-300"}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${always || whole ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        )}
      </div>

      {open && tab.options.length > 0 && !never && (
        <div className="border-t border-takal-line bg-takal-page/60 px-3 py-2 space-y-1">
          {tab.options.map((o) => {
            const on = whole || ticked.has(o.key);
            return (
              <label
                key={o.key}
                className={`flex items-start gap-3 px-2 py-2 rounded-lg ${whole ? "opacity-70" : "hover:bg-white cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={whole}
                  onChange={(e) => toggleOption(o.key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-takal-yellow flex-none"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium text-takal-ink">{o.label}</span>
                  {SENSITIVE_KEYS.includes(o.key) && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      sensitive
                    </span>
                  )}
                  <span className="block text-xs text-takal-ink-soft mt-0.5 leading-relaxed">
                    {whole ? "Included by the tab" : o.hint || ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabPermissions({
  ticked, setTicked, oldStyle,
}: {
  ticked: Set<string>;
  setTicked: (next: Set<string>) => void;
  oldStyle?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const everything = everythingTicked(ticked);
  const can = inPlainWords(ticked);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <p className="text-sm font-semibold text-takal-ink">
          Allow access to
          <span className="ml-2 text-xs font-medium text-takal-ink-soft">
            {everything.size} of {ALL_KEYS.size} places
          </span>
        </p>
        <button
          type="button"
          onClick={() => setTicked(new Set())}
          className="text-xs font-semibold text-takal-ink px-2 py-1 rounded hover:bg-slate-100"
        >
          Clear all
        </button>
      </div>

      {oldStyle && (
        <p className="text-xs text-takal-ink-soft mb-3 leading-relaxed bg-takal-page border border-takal-line rounded-lg px-3 py-2">
          This account was saved before tabs and options existed. The ticks below
          are the <b>exact</b> places it opens today — nothing has been added to
          it. Saving writes it in the new way.
        </p>
      )}

      <div className="space-y-2">
        {TABS.map((t) => (
          <TabRow
            key={t.key}
            tab={t}
            ticked={ticked}
            setTicked={setTicked}
            open={!!open[t.key]}
            setOpen={(v) => setOpen({ ...open, [t.key]: v })}
          />
        ))}
      </div>

      {/* IN PLAIN WORDS, WHAT THIS PERSON CAN OPEN. A list of keys is not
          something anybody can check at a glance. A sentence is. */}
      <div className="mt-4 border border-takal-line rounded-xl px-4 py-3 bg-takal-page">
        <p className="text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft mb-1.5">
          In plain words, what this person can open
        </p>
        <p className="text-sm text-takal-ink leading-relaxed">
          <span className="font-bold text-emerald-700">CAN</span> — {can.join(" · ")}
        </p>
        <p className="text-sm text-takal-ink leading-relaxed mt-1">
          <span className="font-bold text-red-700">CANNOT</span> — everything else.
          The server refuses it even if they type the address by hand.
        </p>
      </div>

      {everything.size <= ALWAYS_OPEN.length && (
        <p className="text-xs text-amber-700 mt-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-none mt-0.5" />
          Nothing is switched on. This person can log in and see the Dashboard,
          and every other page will refuse them.
        </p>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState("");

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [newPerms, setNewPerms] = useState<Set<string>>(nothingTicked());
  const [newSuper, setNewSuper] = useState(false);

  // Edit-access panel
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(nothingTicked());
  // Was this account saved before tabs and options existed? Shown as a note on
  // the panel, so nobody wonders why the ticks look scattered.
  const [editWasOldStyle, setEditWasOldStyle] = useState(false);
  const [editSuper, setEditSuper] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const me = getMyPerms();
    setIsSuper(me.isSuper);
    try {
      const u = JSON.parse(localStorage.getItem("admin_user") || "{}");
      setCurrentAdminId(String(u?.id || ""));
    } catch {
      // This was a completely empty catch. If the stored profile is corrupt,
      // currentAdminId stays empty - and an empty id matches nobody, so the
      // "you cannot delete or demote yourself" guard below silently stops
      // working. Fetch the id from the server instead of carrying on blind.
      setCurrentAdminId("");
      apiClient
        .getMe()
        .then((me: any) => setCurrentAdminId(String(me?.id || "")))
        .catch(() => {
          toast(
            "Could not confirm which account you are signed in as. Reload the page before changing any admin.",
            "error"
          );
        });
    }
    if (me.isSuper) fetchUsers();
    else setLoading(false);
  }, []);

  // Esc closes the access panel. Without it the only way out is the small X,
  // and a modal you cannot dismiss with the keyboard feels broken.
  const closeEdit = useCallback(() => setEditUser(null), []);
  useEffect(() => {
    if (!editUser) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeEdit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editUser, closeEdit]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getUsers()) as any;
      setUsers((res?.users || res?.data || []).filter((u: any) => (u.role || "").toLowerCase() === "admin"));
    } catch (err) {
      setError(readFailure(err, "the admin list"));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      // Saved in the new way, with the marker first. A list with no marker is
      // read as the fourteen OLD words, so the marker is what stops "riders"
      // being read as the old one-page meaning instead of the whole tab.
      const permissions = newSuper ? [] : toNewFormat(newPerms);
      await apiClient.createUser({ ...form, role: "admin", is_super_admin: newSuper, permissions });
      setForm({ full_name: "", email: "", password: "" });
      setNewPerms(nothingTicked());
      setNewSuper(false);
      setShowCreateForm(false);
      toast("Sub-admin created", "success");
      await fetchUsers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create sub-admin", "error");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditSuper(!!u.is_super_admin);
    const saved: string[] = Array.isArray(u.permissions) ? u.permissions.map(String) : [];
    // An OLD list is turned into the EXACT places it opens today - never into
    // the whole tab, which would hand somebody options they never had.
    setEditPerms(ticksForSavedList(saved));
    setEditWasOldStyle(saved.length > 0 && !isNewFormat(saved));
  };

  const saveEdit = async () => {
    if (!editUser) return;
    try {
      setSavingEdit(true);
      const permissions = editSuper ? [] : toNewFormat(editPerms);
      await apiClient.updateUser(String(editUser.id), { is_super_admin: editSuper, permissions });
      setEditUser(null);
      toast("Access updated — it applies on their very next click", "success");
      await fetchUsers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update access", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // DELETING AN ADMIN WAS FOUR WORDS IN THE BROWSER'S GREY BOX.
  // It did not say that the account cannot be brought back. The window says so
  // now - and since Mock 100 it also points at Switch off, which is the answer
  // almost every time somebody reaches for Delete.
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  // Mock 110: which admin is being let back in. null = the window is shut.
  const [pendingReset, setPendingReset] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── SWITCH AN ADMIN OFF, INSTEAD OF DELETING THEM ────────────────────────
  //
  // Mock 100, approved by Sana on 20 September 2026. Until this, Delete was the
  // ONLY lever on this screen and Delete cannot be undone - so somebody away
  // for a month could only be left fully working, or deleted and rebuilt with
  // every permission ticked again.
  //
  // The server has always been able to do this and has always written it to
  // the Audit Log. It stops the person on their very NEXT CLICK, because
  // stop_this_account_now() clears both caches rather than waiting for one to
  // expire. The same two locks the server refuses on - your own account, and
  // the last Main Admin - are greyed out here as well, so the answer arrives
  // before the click instead of as a red toast after it.
  const [pendingOff, setPendingOff] = useState<any | null>(null);
  const [switching, setSwitching] = useState(false);

  const setWorking = async (u: any, working: boolean) => {
    try {
      setSwitching(true);
      await apiClient.updateUser(String(u.id), { is_active: working });
      setPendingOff(null);
      toast(
        working
          ? `${u.full_name || "That admin"} can sign in again`
          : `${u.full_name || "That admin"} is switched off — from their very next click`,
        "success"
      );
      await fetchUsers();
    } catch (err) {
      toast(errorMessage(err, working ? "switching that admin on"
                                      : "switching that admin off"), "error");
    } finally {
      setSwitching(false);
    }
  };

  const doRemove = async (u: any) => {
    try {
      setDeleting(true);
      await apiClient.deleteUser(String(u.id));
      toast("Admin deleted", "success");
      setPendingDelete(null);
      await fetchUsers();
    } catch (err) {
      toast(errorMessage(err, "deleting that admin"), "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!isSuper) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-takal-ink">Admin Users</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg">
          🔒 Only the <strong>Main Admin</strong> can manage admins and permissions.
        </div>
      </div>
    );
  }

  const superCount = users.filter((u) => u.is_super_admin).length;
  const subCount = users.length - superCount;

  // The server refuses to remove the last Main Admin ("There must be at least
  // one Main Admin"). The switch is disabled here too, so the answer arrives
  // before the click rather than as a red toast after it.
  const editingSelf = !!editUser && String(editUser.id) === currentAdminId;
  const lastMainAdmin = !!editUser && !!editUser.is_super_admin && superCount <= 1;

  // The rules themselves are in src/lib/admin-accounts.ts, so a test can check
  // them without a browser. This is only the screen asking them.
  const whyNotSwitchOff = (u: any) => whyNotSwitchOffRule(u, currentAdminId, users);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-takal-ink">Admin Users</h1>
          <p className="text-takal-ink-soft mt-1">
            Add sub-admins and control exactly what each one can open.
          </p>
          {!loading && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white">
                <ShieldCheck className="w-3.5 h-3.5" />
                {superCount} Main Admin{superCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-takal-ink">
                {subCount} Sub-Admin{subCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Sub-Admin
        </button>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchUsers} denied={error.denied} />
      )}

      {/* ── Create ─────────────────────────────────────────────────────── */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-takal-line shadow-sm p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-takal-ink">New Sub-Admin</h3>
            <p className="text-sm text-takal-ink-soft mt-0.5">
              They can sign in straight away with the email and password you set here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-takal-ink mb-1">Full name</label>
              <input type="text" placeholder="e.g. Shafiq" value={form.full_name} required
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-takal-ink mb-1">Email</label>
              <input type="email" placeholder="name@example.com" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-takal-ink mb-1">Password</label>
              {/* TEN, NOT SIX (Sana, 21 September 2026).
                  The server refuses anything shorter on an admin account. This
                  box says so BEFORE the form is sent, because being told "too
                  short" only after pressing Create is how somebody retypes the
                  whole form. The server is still the real guard - this is only
                  the polite warning in front of it. */}
              <input type="password" placeholder="At least 10 characters" minLength={10} value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
              <p className="mt-1 text-xs text-takal-ink-soft">
                An admin account can see every shop&apos;s money and message every
                customer, so it needs a longer password than a customer account.
              </p>
            </div>
          </div>

          <SwitchRow
            on={newSuper}
            onChange={setNewSuper}
            tone="super"
            title="Make this a backup Main Admin"
            hint="Full control of everything, including adding and removing other admins. Only do this for someone you trust completely."
          />

          {!newSuper && <TabPermissions ticked={newPerms} setTicked={setNewPerms} />}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={creating}
              className="px-4 py-2.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg transition disabled:opacity-50">
              {creating ? "Creating…" : "Create Sub-Admin"}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 border border-takal-line rounded-lg hover:bg-takal-page font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── The list ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-takal-line shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Person</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Role</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Account</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Can open</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-takal-ink-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-takal-ink-soft">Loading…</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-takal-ink-soft">
                    The admin list could not be read, so nothing can be listed here.
                    Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-takal-ink-soft">No admins found</td></tr>
              ) : (
                users.map((u) => {
                  const self = String(u.id) === currentAdminId;
                  const perms: string[] = Array.isArray(u.permissions) ? u.permissions : [];
                  return (
                    <tr key={u.id} className="border-b border-takal-line last:border-0 hover:bg-takal-page/70 transition">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <span className="flex-none w-10 h-10 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-bold">
                            {initialsOf(u.full_name, u.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-takal-ink">{u.full_name || "No name"}</span>
                              {self && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-takal-yellow text-takal-ink">
                                  You
                                </span>
                              )}
                              {u.is_active === false && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                  Switched off
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-takal-ink-soft mt-0.5 break-all">{u.email}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${u.is_super_admin ? "bg-slate-900 text-white" : "bg-slate-100 text-takal-ink"}`}>
                          {u.is_super_admin && <Shield className="w-3 h-3" />}
                          {u.is_super_admin ? "Main Admin" : "Sub-Admin"}
                        </span>
                      </td>

                      {/* ACCOUNT — working, or switched off. (Mock 100.) */}
                      <td className="px-6 py-4 align-top">
                        {(() => {
                          const on = isWorking(u);
                          const why = whyNotSwitchOff(u);
                          return (
                            <>
                              <span className="flex items-center gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full
                                    ${why ? "bg-slate-200" : on ? "bg-slate-900" : "bg-slate-300"}`}
                                >
                                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full shadow transition-transform
                                    ${why ? "bg-takal-page" : "bg-white"} ${on ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded
                                  ${on ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                  {on ? "Working" : "Switched off"}
                                </span>
                              </span>
                              {why && (
                                <span className="block text-xs text-takal-ink-soft mt-1.5 leading-relaxed max-w-52">
                                  {why}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </td>

                      <td className="px-6 py-4 align-top max-w-md">
                        {u.is_super_admin ? (
                          <span className="text-sm text-takal-ink-soft">Everything</span>
                        ) : /* read-safe: a fact about this admin's row,
                             not about whether the list was read */
                          perms.length === 0 ? (
                          <span className="text-sm text-amber-700">No access yet</span>
                        ) : (
                          <>
                            <span className="block text-xs font-semibold text-takal-ink-soft mb-1.5">
                              {everythingTicked(ticksForSavedList(perms)).size} of {ALL_KEYS.size} places
                              {!isNewFormat(perms) && (
                                <span className="ml-1.5 font-normal">(saved the old way)</span>
                              )}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              {inPlainWords(ticksForSavedList(perms)).map((w) => (
                                <span key={w}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-takal-ink">
                                  {w}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-takal-ink border border-takal-line rounded-lg hover:bg-slate-100 transition"
                            title="Change what this admin can open">
                            <SlidersHorizontal className="w-4 h-4" /> Access
                          </button>
                          {/* LETTING A LOCKED-OUT ADMIN BACK IN. (Mock 110.)
                              Never on your own row: your own password is
                              changed from the menu, where the CURRENT one is
                              required. Without that, anybody at an unlocked
                              screen could take the Main Admin's account. */}
                          {self ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                                             text-takal-disabled-text border border-takal-line rounded-lg cursor-not-allowed"
                                  title="Your own password is changed from the menu, bottom left - it asks for your current one first">
                              <KeyRound className="w-4 h-4" /> Reset password
                            </span>
                          ) : (
                            <button
                              onClick={() => setPendingReset(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-takal-ink
                                         border border-takal-line rounded-lg hover:bg-slate-100 transition"
                              title="Set a new password for somebody who is locked out"
                            >
                              <KeyRound className="w-4 h-4" /> Reset password
                            </button>
                          )}
                          {(() => {
                            const on = isWorking(u);
                            const why = whyNotSwitchOff(u);
                            if (why) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold
                                                 text-takal-disabled-text border border-takal-line rounded-lg cursor-not-allowed"
                                      title={why}>
                                  <Power className="w-4 h-4" /> Switch off
                                </span>
                              );
                            }
                            return (
                              <button
                                onClick={() => (on ? setPendingOff(u) : setWorking(u, true))}
                                disabled={switching}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-takal-ink
                                           border border-takal-line rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                                title={on
                                  ? "Stop them using the panel, without deleting anything"
                                  : "Let them sign in again"}
                              >
                                <Power className="w-4 h-4" /> {on ? "Switch off" : "Switch on"}
                              </button>
                            );
                          })()}
                          {self ? (
                            <span className="p-1.5 text-takal-disabled-text cursor-not-allowed" title="You can't delete your own account">
                              <Trash2 className="w-4 h-4" />
                            </span>
                          ) : (
                            <button onClick={() => setPendingDelete(u)}
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Access panel ───────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
             onClick={closeEdit} role="dialog" aria-modal="true" aria-label="Edit access">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
               onClick={(e) => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-takal-line">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex-none w-10 h-10 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-bold">
                  {initialsOf(editUser.full_name, editUser.email)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-takal-ink truncate">
                    {editUser.full_name || "No name"}
                  </h3>
                  <p className="text-xs text-takal-ink-soft break-all">{editUser.email}</p>
                </div>
              </div>
              <button onClick={closeEdit} aria-label="Close"
                className="flex-none p-1.5 text-takal-disabled-text hover:text-takal-ink hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              <SwitchRow
                on={editSuper}
                onChange={setEditSuper}
                tone="super"
                title="Main Admin"
                hint="Full control of everything, including adding and removing other admins."
                disabled={lastMainAdmin}
                disabledNote={
                  lastMainAdmin
                    ? (editingSelf
                        ? "You are the only Main Admin. Make somebody else a Main Admin first, or you would lock yourself out."
                        : "This is the only Main Admin left. There must always be at least one.")
                    : undefined
                }
              />

              {/* THE SAME SWITCH, WHERE YOU ARE ALREADY STANDING. (Mock 100.) */}
              {!editingSelf && (
                <SwitchRow
                  on={isWorking(editUser)}
                  onChange={(next) => {
                    if (next) setWorking(editUser, true);
                    else setPendingOff(editUser);
                  }}
                  title="Account is working"
                  hint="Switch this off to stop them using the panel, without deleting anything. The permissions below are kept."
                  disabled={!!whyNotSwitchOff(editUser)}
                  disabledNote={whyNotSwitchOff(editUser) || undefined}
                />
              )}

              {!editSuper && (
                <TabPermissions
                  ticked={editPerms}
                  setTicked={setEditPerms}
                  oldStyle={editWasOldStyle}
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-takal-line bg-takal-page rounded-b-2xl flex flex-wrap items-center gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="px-4 py-2.5 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink font-semibold rounded-lg transition disabled:opacity-50">
                {savingEdit ? "Saving…" : "Save Access"}
              </button>
              <button onClick={closeEdit}
                className="px-4 py-2.5 border border-takal-line bg-white rounded-lg hover:bg-slate-100 font-medium">
                Cancel
              </button>
              <p className="text-xs text-takal-ink-soft ml-auto">
                Takes effect on their very next click — no need to sign them out.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mock 110. Its own window rather than a ConfirmDialog: it has two
          steps, and the second one - handing the password over - is the half
          that must not be rushed past. */}
      <ResetAdminPasswordModal
        admin={pendingReset}
        onClose={() => setPendingReset(null)}
        onDone={fetchUsers}
      />

      <ConfirmDialog
        open={pendingOff !== null}
        busy={switching}
        onCancel={() => setPendingOff(null)}
        title={`Switch ${pendingOff?.full_name || "this admin"} off?`}
        confirmLabel="Yes, switch off"
        message={
          <>
            They are signed out of every screen <b>on their very next click</b>,
            not in a minute.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><b>Nothing is lost.</b> Their permissions, and everything they
                  have already done, stay exactly as they are.</li>
              <li><b>You can switch them back on at any time</b>, and they carry
                  on where they left off.</li>
              <li>This is written to the Audit Log with your name on it.</li>
            </ul>
          </>
        }
        onConfirm={() => pendingOff && setWorking(pendingOff, false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        title="Delete this admin account?"
        confirmLabel="Yes, delete the account"
        message={
          <>
            <b>{pendingDelete?.full_name || pendingDelete?.email}</b> will lose
            access to this panel straight away, and the account cannot be
            brought back — you would have to create a new one and set every
            permission again. Anything they already did stays in the history.
            <br /><br />
            If you only want to stop them <b>for now</b>, use <b>Switch off</b>
            instead — nothing is lost, their permissions are kept, and it can be
            undone at any time.
          </>
        }
        onConfirm={() => pendingDelete && doRemove(pendingDelete)}
      />
    </div>
  );
}
