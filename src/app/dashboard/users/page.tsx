"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2, Shield, ShieldCheck, SlidersHorizontal, X, UserPlus, AlertTriangle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  getMyPerms, ALL_SECTIONS, SECTION_LABELS, SECTION_HINTS, SENSITIVE_SECTIONS,
} from "@/lib/perms";

const emptySections = () =>
  Object.fromEntries(ALL_SECTIONS.map((s) => [s, false])) as Record<string, boolean>;

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
      ? "border-slate-900/15 bg-slate-50"
      : on && tone === "sensitive"
      ? "border-amber-300 bg-amber-50/60"
      : "border-slate-200 bg-white";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className={`w-full flex items-start gap-4 text-left px-4 py-3 rounded-xl border transition
        ${ring}
        ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-slate-300 hover:shadow-sm"}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2`}
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          {tone === "sensitive" && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              sensitive
            </span>
          )}
        </span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">{hint}</span>}
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

function PermSwitches({
  state, setState,
}: {
  state: Record<string, boolean>;
  setState: (next: Record<string, boolean>) => void;
}) {
  const chosen = ALL_SECTIONS.filter((s) => state[s]).length;
  const setAll = (v: boolean) =>
    setState(Object.fromEntries(ALL_SECTIONS.map((s) => [s, v])) as Record<string, boolean>);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-900">
          Allow access to
          <span className="ml-2 text-xs font-medium text-slate-500">
            {chosen} of {ALL_SECTIONS.length} selected
          </span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAll(true)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100">
            Select all
          </button>
          <button type="button" onClick={() => setAll(false)}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100">
            Clear all
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {ALL_SECTIONS.map((s) => (
          <SwitchRow
            key={s}
            on={!!state[s]}
            onChange={(v) => setState({ ...state, [s]: v })}
            title={SECTION_LABELS[s] || s}
            hint={SECTION_HINTS[s]}
            tone={SENSITIVE_SECTIONS.includes(s) ? "sensitive" : "plain"}
          />
        ))}
      </div>
      {chosen === 0 && (
        <p className="text-xs text-amber-700 mt-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-none mt-0.5" />
          Nothing is switched on. This person will be able to log in and see
          nothing but the dashboard.
        </p>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState("");

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>(emptySections());
  const [newSuper, setNewSuper] = useState(false);

  // Edit-access panel
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>(emptySections());
  const [editSuper, setEditSuper] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const me = getMyPerms();
    setIsSuper(me.isSuper);
    try {
      const u = JSON.parse(localStorage.getItem("admin_user") || "{}");
      setCurrentAdminId(String(u?.id || ""));
    } catch {}
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
      setError("");
      const res = (await apiClient.getUsers()) as any;
      setUsers((res?.users || res?.data || []).filter((u: any) => (u.role || "").toLowerCase() === "admin"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const permissions = newSuper ? [] : ALL_SECTIONS.filter((s) => newPerms[s]);
      await apiClient.createUser({ ...form, role: "admin", is_super_admin: newSuper, permissions });
      setForm({ full_name: "", email: "", password: "" });
      setNewPerms(emptySections());
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
    const map = emptySections();
    (Array.isArray(u.permissions) ? u.permissions : []).forEach((s: string) => { if (s in map) map[s] = true; });
    setEditPerms(map);
  };

  const saveEdit = async () => {
    if (!editUser) return;
    try {
      setSavingEdit(true);
      const permissions = editSuper ? [] : ALL_SECTIONS.filter((s) => editPerms[s]);
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

  const remove = async (u: any) => {
    if (!window.confirm(`Delete admin ${u.full_name || u.email}?`)) return;
    try {
      await apiClient.deleteUser(String(u.id));
      toast("Admin deleted", "success");
      await fetchUsers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete admin", "error");
    }
  };

  if (!isSuper) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>
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

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>
          <p className="text-slate-600 mt-1">
            Add sub-admins and control exactly what each one can open.
          </p>
          {!loading && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white">
                <ShieldCheck className="w-3.5 h-3.5" />
                {superCount} Main Admin{superCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {subCount} Sub-Admin{subCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-slate-900 font-semibold rounded-lg transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add Sub-Admin
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      {/* ── Create ─────────────────────────────────────────────────────── */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">New Sub-Admin</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              They can sign in straight away with the email and password you set here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
              <input type="text" placeholder="e.g. Shafiq" value={form.full_name} required
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" placeholder="name@example.com" value={form.email} required
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input type="password" placeholder="At least 6 characters" minLength={6} value={form.password} required
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" />
            </div>
          </div>

          <SwitchRow
            on={newSuper}
            onChange={setNewSuper}
            tone="super"
            title="Make this a backup Main Admin"
            hint="Full control of everything, including adding and removing other admins. Only do this for someone you trust completely."
          />

          {!newSuper && <PermSwitches state={newPerms} setState={setNewPerms} />}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={creating}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-slate-900 font-semibold rounded-lg transition disabled:opacity-50">
              {creating ? "Creating…" : "Create Sub-Admin"}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── The list ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Person</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Role</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Can open</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">No admins found</td></tr>
              ) : (
                users.map((u) => {
                  const self = String(u.id) === currentAdminId;
                  const perms: string[] = Array.isArray(u.permissions) ? u.permissions : [];
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <span className="flex-none w-10 h-10 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-bold">
                            {initialsOf(u.full_name, u.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900">{u.full_name || "No name"}</span>
                              {self && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-slate-900">
                                  You
                                </span>
                              )}
                              {u.is_active === false && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                  Switched off
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-500 mt-0.5 break-all">{u.email}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${u.is_super_admin ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                          {u.is_super_admin && <Shield className="w-3 h-3" />}
                          {u.is_super_admin ? "Main Admin" : "Sub-Admin"}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top max-w-md">
                        {u.is_super_admin ? (
                          <span className="text-sm text-slate-600">Everything</span>
                        ) : perms.length === 0 ? (
                          <span className="text-sm text-amber-700">No access yet</span>
                        ) : (
                          <>
                            <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                              {perms.length} of {ALL_SECTIONS.length} sections
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                              {perms.map((s) => (
                                <span key={s}
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded
                                    ${SENSITIVE_SECTIONS.includes(s)
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"}`}>
                                  {SECTION_LABELS[s] || s}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 transition"
                            title="Change what this admin can open">
                            <SlidersHorizontal className="w-4 h-4" /> Access
                          </button>
                          {self ? (
                            <span className="p-1.5 text-slate-300 cursor-not-allowed" title="You can't delete your own account">
                              <Trash2 className="w-4 h-4" />
                            </span>
                          ) : (
                            <button onClick={() => remove(u)}
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

            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex-none w-10 h-10 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-bold">
                  {initialsOf(editUser.full_name, editUser.email)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 truncate">
                    {editUser.full_name || "No name"}
                  </h3>
                  <p className="text-xs text-slate-500 break-all">{editUser.email}</p>
                </div>
              </div>
              <button onClick={closeEdit} aria-label="Close"
                className="flex-none p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
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

              {!editSuper && <PermSwitches state={editPerms} setState={setEditPerms} />}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-wrap items-center gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-slate-900 font-semibold rounded-lg transition disabled:opacity-50">
                {savingEdit ? "Saving…" : "Save Access"}
              </button>
              <button onClick={closeEdit}
                className="px-4 py-2.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 font-medium">
                Cancel
              </button>
              <p className="text-xs text-slate-500 ml-auto">
                Takes effect on their very next click — no need to sign them out.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
