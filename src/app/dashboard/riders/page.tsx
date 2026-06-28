"use client";

import { useState, useEffect } from "react";
import { Search, CheckCircle2, Clock, Bike } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";

export default function RidersPage() {
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioningRiderId, setActioningRiderId] = useState<string | null>(null);

  useEffect(() => {
    fetchRiders();
  }, [statusFilter]);

  const fetchRiders = async () => {
    try {
      setLoading(true);
      setError("");
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;

      const response = await apiClient.getRiders(filters) as any;
      setRiders(response?.riders || response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load riders");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (riderId: string) => {
    try {
      setActioningRiderId(riderId);
      await apiClient.approveRider(riderId);
      toast("Rider approved", "success");
      await fetchRiders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    } finally {
      setActioningRiderId(null);
    }
  };

  const handleSuspend = async (riderId: string) => {
    if (!window.confirm("Suspend this rider?")) return;
    try {
      setActioningRiderId(riderId);
      await apiClient.suspendRider(riderId);
      toast("Rider suspended", "success");
      await fetchRiders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to suspend", "error");
    } finally {
      setActioningRiderId(null);
    }
  };

  const handleReject = async (riderId: string) => {
    try {
      setActioningRiderId(riderId);
      await apiClient.rejectRider(riderId);
      toast("Rider rejected", "success");
      await fetchRiders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to reject", "error");
    } finally {
      setActioningRiderId(null);
    }
  };

  const handleUnsuspend = async (riderId: string) => {
    try {
      setActioningRiderId(riderId);
      await apiClient.unsuspendRider(riderId);
      toast("Rider unsuspended", "success");
      await fetchRiders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unsuspend", "error");
    } finally {
      setActioningRiderId(null);
    }
  };

  // Riders store full_name / phone (not name / email), and is_approved / is_suspended (not status).
  const deriveStatus = (r: any) =>
    r.is_suspended ? "suspended" : r.is_approved ? "approved" : "pending";

  const filteredRiders = riders.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || deriveStatus(r) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      approved: "bg-green-50 text-green-700",
      pending: "bg-yellow-50 text-yellow-700",
      suspended: "bg-red-50 text-red-700",
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Riders</h1>
          <p className="text-slate-600 mt-1">Manage delivery riders and earnings</p>
        </div>
        <button
          onClick={fetchRiders}
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
                placeholder="Search by name or email..."
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Earnings</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Deliveries</th>
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
              ) : filteredRiders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    No riders found
                  </td>
                </tr>
              ) : (
                filteredRiders.map((rider) => (
                  <tr key={rider.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {rider.full_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {rider.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(deriveStatus(rider))}`}>
                        {deriveStatus(rider).charAt(0).toUpperCase() + deriveStatus(rider).slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {money(rider.total_earnings)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {rider.total_deliveries || 0}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {deriveStatus(rider) === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(rider.id)}
                            disabled={actioningRiderId === rider.id}
                            className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(rider.id)}
                            disabled={actioningRiderId === rider.id}
                            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {deriveStatus(rider) === "approved" && (
                        <button
                          onClick={() => handleSuspend(rider.id)}
                          disabled={actioningRiderId === rider.id}
                          className="text-yellow-600 hover:text-yellow-700 font-medium disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                      {deriveStatus(rider) === "suspended" && (
                        <button
                          onClick={() => handleUnsuspend(rider.id)}
                          disabled={actioningRiderId === rider.id}
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
