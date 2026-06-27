"use client";

import { useState, useEffect } from "react";
import { Search, Trash2, Edit2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ email: "", full_name: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ full_name: string; is_active: boolean }>({ full_name: "", is_active: true });
  const [currentAdminId, setCurrentAdminId] = useState<string>("");

  useEffect(() => {
    // Who am I? Used to stop me deleting my own account.
    try {
      const me = JSON.parse(localStorage.getItem("admin_user") || "{}");
      setCurrentAdminId(String(me?.id || ""));
    } catch {
      /* ignore */
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = (await apiClient.getUsers()) as any;
      setUsers(response?.users || response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await apiClient.createUser({ ...formData, role: "admin" });
      setFormData({ email: "", full_name: "", password: "" });
      setShowCreateForm(false);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (user: any) => {
    setEditingId(String(user.id));
    setEditData({ full_name: user.full_name || "", is_active: user.is_active !== false });
  };

  const handleSaveEdit = async (userId: string) => {
    try {
      await apiClient.updateUser(userId, editData);
      setEditingId(null);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;
    try {
      await apiClient.deleteUser(userId);
      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete admin");
    }
  };

  // This page manages ADMIN accounts only.
  const admins = users.filter((u) => (u.role || "").toLowerCase() === "admin");
  const filteredUsers = admins.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Users</h1>
          <p className="text-slate-600 mt-1">Manage admin user accounts</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          + Add Admin
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Create New Admin User</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              required
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-600">Loading...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-600">No admins found</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = String(user.id) === currentAdminId;
                  const isEditing = editingId === String(user.id);
                  return (
                    <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.full_name}
                            onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                            className="px-2 py-1 border border-slate-300 rounded w-40"
                          />
                        ) : (
                          <>
                            {user.full_name || "N/A"}
                            {isSelf && (
                              <span className="ml-2 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">You</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editData.is_active}
                              onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                            />
                            Active
                          </label>
                        ) : (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              user.is_active === false ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                            }`}
                          >
                            {user.is_active === false ? "Suspended" : "Active"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(String(user.id))}
                              className="text-green-600 hover:text-green-700"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-slate-500 hover:text-slate-700"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              onClick={() => startEdit(user)}
                              className="text-primary-600 hover:text-primary-700"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isSelf ? (
                              <span className="text-slate-300 cursor-not-allowed" title="You can't delete your own account">
                                <Trash2 className="w-4 h-4" />
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(String(user.id))}
                                className="text-red-600 hover:text-red-700"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
