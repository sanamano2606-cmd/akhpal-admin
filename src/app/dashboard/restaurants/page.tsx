"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Clock, Edit2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { VERTICALS, verticalLabel, verticalEmoji } from "@/lib/verticals";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actioningRestaurantId, setActioningRestaurantId] = useState<string | null>(null);
  const [editCommissionId, setEditCommissionId] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState("");
  const [editTypeId, setEditTypeId] = useState<string | null>(null);

  // Create-store modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<any>(null);
  const emptyForm = { owner_name: "", phone: "", email: "", store_name: "", vendor_type: "restaurant", address: "" };
  const [form, setForm] = useState({ ...emptyForm });

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submitCreate = async () => {
    if (!form.owner_name.trim() || !form.phone.trim() || !form.store_name.trim()) {
      toast("Owner name, phone, and store name are required", "error");
      return;
    }
    try {
      setCreating(true);
      const res = (await apiClient.createStore(form)) as any;
      setCreds(res?.credentials || null);
      toast("Store created", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create store", "error");
    } finally {
      setCreating(false);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreds(null);
    setForm({ ...emptyForm });
  };

  const vendorTypeOf = (r: any) => (r.vendor_type || "").trim() || "restaurant";

  const saveVendorType = async (restaurantId: string, vendorType: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.setRestaurantVendorType(restaurantId, vendorType);
      setEditTypeId(null);
      toast("Store type updated", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update store type", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  const saveCommission = async (restaurantId: string) => {
    const val = parseFloat(commissionValue);
    if (isNaN(val) || val < 0 || val > 100) {
      toast("Enter a commission between 0 and 100", "error");
      return;
    }
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.setRestaurantCommission(restaurantId, val);
      setEditCommissionId(null);
      toast("Commission updated", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update commission", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [statusFilter]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError("");
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;

      const response = await apiClient.getRestaurants(filters) as any;
      setRestaurants(response?.restaurants || response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (restaurantId: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.approveRestaurant(restaurantId);
      toast("Restaurant approved", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  const handleReject = async (restaurantId: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.rejectRestaurant(restaurantId);
      toast("Restaurant rejected", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reject", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  const handleSuspend = async (restaurantId: string) => {
    if (!window.confirm("Suspend this restaurant?")) return;
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.suspendRestaurant(restaurantId);
      toast("Restaurant suspended", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to suspend", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  // The backend stores is_approved / is_suspended, not a single status string.
  const deriveStatus = (r: any) =>
    r.is_suspended ? "suspended" : r.is_approved ? "approved" : "pending";

  const handleUnsuspend = async (restaurantId: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.unsuspendRestaurant(restaurantId);
      toast("Restaurant unsuspended", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unsuspend", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch = (r.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || deriveStatus(r) === statusFilter;
    const matchesType = typeFilter === "all" || vendorTypeOf(r) === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, any> = {
      approved: { bg: "bg-green-50", text: "text-green-700", icon: CheckCircle2 },
      pending: { bg: "bg-yellow-50", text: "text-yellow-700", icon: Clock },
      rejected: { bg: "bg-red-50", text: "text-red-700", icon: XCircle },
      suspended: { bg: "bg-gray-50", text: "text-gray-700", icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Restaurants</h1>
          <p className="text-slate-600 mt-1">Manage restaurant onboarding and commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition font-medium"
          >
            + Create store
          </button>
          <button
            onClick={fetchRestaurants}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by restaurant name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          >
            <option value="all">All Store Types</option>
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Store Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Owner</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Commission</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    Loading...
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    No restaurants found
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      <Link href={`/dashboard/restaurants/${restaurant.id}`} className="text-primary-600 hover:underline">
                        {restaurant.name || "N/A"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {editTypeId === restaurant.id ? (
                        <select
                          autoFocus
                          defaultValue={vendorTypeOf(restaurant)}
                          disabled={actioningRestaurantId === restaurant.id}
                          onChange={(e) => saveVendorType(restaurant.id, e.target.value)}
                          onBlur={() => setEditTypeId(null)}
                          className="px-2 py-1 border border-slate-300 rounded text-sm"
                        >
                          {VERTICALS.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.emoji} {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {verticalEmoji(vendorTypeOf(restaurant))} {verticalLabel(vendorTypeOf(restaurant))}
                          </span>
                          <button
                            onClick={() => setEditTypeId(restaurant.id)}
                            className="text-primary-600 hover:text-primary-700"
                            title="Change store type"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {restaurant.owner_name || restaurant.email || "N/A"}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(deriveStatus(restaurant))}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {editCommissionId === restaurant.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={commissionValue}
                            onChange={(e) => setCommissionValue(e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded"
                          />
                          %
                          <button onClick={() => saveCommission(restaurant.id)} className="text-green-600 hover:text-green-700" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditCommissionId(null)} className="text-slate-500 hover:text-slate-700" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {restaurant.commission_percent ?? 0}%
                          <button
                            onClick={() => {
                              setEditCommissionId(restaurant.id);
                              setCommissionValue(String(restaurant.commission_percent ?? 0));
                            }}
                            className="text-primary-600 hover:text-primary-700"
                            title="Edit commission"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {deriveStatus(restaurant) === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(restaurant.id)}
                            disabled={actioningRestaurantId === restaurant.id}
                            className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(restaurant.id)}
                            disabled={actioningRestaurantId === restaurant.id}
                            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {deriveStatus(restaurant) === "approved" && (
                        <button
                          onClick={() => handleSuspend(restaurant.id)}
                          disabled={actioningRestaurantId === restaurant.id}
                          className="text-yellow-600 hover:text-yellow-700 font-medium disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                      {deriveStatus(restaurant) === "suspended" && (
                        <button
                          onClick={() => handleUnsuspend(restaurant.id)}
                          disabled={actioningRestaurantId === restaurant.id}
                          className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                        >
                          Unsuspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeCreate}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {creds ? (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Store created</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Share these with the vendor. They sign into the vendor app with their phone and password.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-mono font-medium text-slate-900">{creds.phone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Password</span><span className="font-mono font-medium text-slate-900">{creds.password}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-mono text-xs text-slate-700">{creds.email}</span></div>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`Phone: ${creds.phone}\nPassword: ${creds.password}`); toast("Copied", "success"); }}
                  className="mt-3 w-full px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm"
                >
                  Copy phone and password
                </button>
                <button onClick={closeCreate} className="mt-2 w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Create a store</h2>
                <div className="space-y-3">
                  <input placeholder="Owner name" value={form.owner_name} onChange={(e) => setF("owner_name", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm" />
                  <input placeholder="Phone (used to sign in)" value={form.phone} onChange={(e) => setF("phone", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm" />
                  <input placeholder="Email (optional)" value={form.email} onChange={(e) => setF("email", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm" />
                  <input placeholder="Store name" value={form.store_name} onChange={(e) => setF("store_name", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm" />
                  <select value={form.vendor_type} onChange={(e) => setF("vendor_type", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm">
                    {VERTICALS.map((v) => (
                      <option key={v.value} value={v.value}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                  <input placeholder="Address (optional)" value={form.address} onChange={(e) => setF("address", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm" />
                  <p className="text-xs text-slate-500">A secure password is generated automatically. The store is approved instantly, so the vendor can sign in right away.</p>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={closeCreate} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                  <button onClick={submitCreate} disabled={creating} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-lg">
                    {creating ? "Creating…" : "Create store"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
