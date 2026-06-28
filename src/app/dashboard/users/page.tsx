"use client";

import { useState, useEffect } from "react";
import { Trash2, Shield, Settings2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getMyPerms, ALL_SECTIONS, SECTION_LABELS } from "@/lib/perms";

const emptySections = () =>
  Object.fromEntries(ALL_SECTIONS.map((s) => [s, false])) as Record<string, boolean>;

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
  const [editId, setEditId] = useState<string | null>(null);
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
    setEditId(String(u.id));
    setEditSuper(!!u.is_super_admin);
    const map = emptySections();
    (Array.isArray(u.permissions) ? u.permissions : []).forEach((s: string) => { if (s in map) map[s] = true; });
    setEditPerms(map);
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      setSavingEdit(true);
      const permissions = editSuper ? [] : ALL_SECTIONS.filter((s) => editPerms[s]);
      await apiClient.updateUser(editId, { is_super_admin: editSuper, permissions });
      setEditId(null);
      toast("Access updated", "success");
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

  const PermGrid = ({ state, setState, disabled }: any) => (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {ALL_SECTIONS.map((s) => (
        <label key={s} className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!state[s]} onChange={(e) => setState({ ...state, [s]: e.target.checked })} />
          {SECTION_LABELS[s]}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>
          <p className="text-slate-600 mt-1">Add sub-admins and control exactly what each can access.</p>
        </div>
        <button onClick={() => setShowCreateForm((s) => !s)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition">
          + Add Sub-Admin
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">⚠️ {error}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">New Sub-Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="Full name" value={form.full_name} required
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
            <input type="email" placeholder="Email" value={form.email} required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
            <input type="password" placeholder="Password (min 6)" minLength={6} value={form.password} required
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" />
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={newSuper} onChange={(e) => setNewSuper(e.target.checked)} />
            <Shield className="w-4 h-4 text-primary-600" /> Make this a backup Main Admin (full access to everything)
          </label>

          {!newSuper && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Allow access to:</p>
              <PermGrid state={newPerms} setState={setNewPerms} disabled={false} />
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50">
              {creating ? "Creating..." : "Create Sub-Admin"}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Access</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-600">No admins found</td></tr>
              ) : (
                users.map((u) => {
                  const self = String(u.id) === currentAdminId;
                  const access = u.is_super_admin
                    ? "Everything"
                    : (Array.isArray(u.permissions) && u.permissions.length
                        ? u.permissions.map((s: string) => SECTION_LABELS[s] || s).join(", ")
                        : "No access yet");
                  return (
                    <tr key={u.id} className="border-b border-slate-200 hover:bg-slate-50 align-top">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {u.full_name || "N/A"} {self && <span className="ml-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">You</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${u.is_super_admin ? "bg-primary-50 text-primary-700" : "bg-slate-100 text-slate-700"}`}>
                          {u.is_super_admin && <Shield className="w-3 h-3" />}
                          {u.is_super_admin ? "Main Admin" : "Sub-Admin"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">{access}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-3">
                          <button onClick={() => openEdit(u)} className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1" title="Edit access">
                            <Settings2 className="w-4 h-4" /> Access
                          </button>
                          {self ? (
                            <span className="text-slate-300 cursor-not-allowed" title="You can't delete your own account"><Trash2 className="w-4 h-4" /></span>
                          ) : (
                            <button onClick={() => remove(u)} className="text-red-600 hover:text-red-700" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      {/* Edit access modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Access</h3>
            <label className="inline-flex items-center gap-2 text-sm font-medium mb-4">
              <input type="checkbox" checked={editSuper} onChange={(e) => setEditSuper(e.target.checked)} />
              <Shield className="w-4 h-4 text-primary-600" /> Main Admin (full access to everything)
            </label>
            {!editSuper && (
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Allow access to:</p>
                <PermGrid state={editPerms} setState={setEditPerms} disabled={false} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50">
                {savingEdit ? "Saving..." : "Save Access"}
              </button>
              <button onClick={() => setEditId(null)} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
