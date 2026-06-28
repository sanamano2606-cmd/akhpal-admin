"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Clock, Edit2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioningRestaurantId, setActioningRestaurantId] = useState<string | null>(null);
  const [editCommissionId, setEditCommissionId] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState("");

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
    return matchesSearch && matchesStatus;
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
        <button
          onClick={fetchRestaurants}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          Refresh
        </button>
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
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Owner</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Commission</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-600">
                    Loading...
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-600">
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
    </div>
  );
}
