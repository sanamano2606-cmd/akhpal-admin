"use client";

import { useState, useEffect } from "react";
import { Search, Download, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { money } from "@/lib/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [assignOrder, setAssignOrder] = useState<any | null>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [selectedRider, setSelectedRider] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;

      const response = await apiClient.getOrders(page, PAGE_SIZE, filters) as any;
      setOrders(response?.orders || response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;

    try {
      setCancelingOrderId(orderId);
      await apiClient.cancelOrder(orderId, "Admin cancelled");
      toast("Order cancelled", "success");
      await fetchOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel order", "error");
    } finally {
      setCancelingOrderId(null);
    }
  };

  const openAssign = async (order: any) => {
    setAssignOrder(order);
    setSelectedRider("");
    try {
      const res = (await apiClient.getRiders({})) as any;
      const list = (res?.riders || res?.data || []).filter(
        (r: any) => r.is_approved && !r.is_suspended
      );
      setRiders(list);
    } catch {
      setRiders([]);
    }
  };

  const submitAssign = async () => {
    if (!assignOrder || !selectedRider) return;
    try {
      setAssigning(true);
      await apiClient.assignRider(assignOrder.id, selectedRider);
      setAssignOrder(null);
      toast("Rider assigned", "success");
      await fetchOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to assign rider", "error");
    } finally {
      setAssigning(false);
    }
  };

  // Client-side search across order id, customer and restaurant.
  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      String(o.id).toLowerCase().includes(q) ||
      (o.customer_name || o.customer || "").toLowerCase().includes(q) ||
      (o.restaurant_name || o.restaurant || "").toLowerCase().includes(q)
    );
  });

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-50 text-yellow-700",
      cooking: "bg-blue-50 text-blue-700",
      ready: "bg-purple-50 text-purple-700",
      delivering: "bg-cyan-50 text-cyan-700",
      delivered: "bg-green-50 text-green-700",
      cancelled: "bg-red-50 text-red-700",
    };
    return colors[status] || "bg-slate-50 text-slate-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-600 mt-1">Manage all orders and tracking</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
        >
          <Download className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order ID or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="cooking">Cooking</option>
            <option value="ready">Ready</option>
            <option value="delivering">Delivering</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Restaurant
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-600">
                    <div className="inline-block animate-spin mb-2">
                      <div className="w-6 h-6 border-3 border-slate-300 border-t-primary-600 rounded-full"></div>
                    </div>
                    <p>Loading orders...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-600">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.customer_name || order.customer || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.restaurant_name || order.restaurant || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {money(order.total_amount || order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(order.created_at || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View
                      </button>
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => openAssign(order)}
                          className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Assign
                        </button>
                      )}
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancelingOrderId === order.id}
                          className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          {cancelingOrderId === order.id ? "Canceling..." : "Cancel"}
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm text-slate-600">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={orders.length < PAGE_SIZE || loading}
          className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      {/* Order detail popup */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Order #{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-medium">{selectedOrder.status || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{selectedOrder.customer_name || selectedOrder.customer || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Restaurant</span><span className="font-medium">{selectedOrder.restaurant_name || selectedOrder.restaurant || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-medium">Rs {(selectedOrder.total_amount || selectedOrder.total || 0).toLocaleString()}</span></div>
              {selectedOrder.delivery_fee != null && (
                <div className="flex justify-between"><span className="text-slate-500">Delivery fee</span><span className="font-medium">Rs {Number(selectedOrder.delivery_fee).toLocaleString()}</span></div>
              )}
              {selectedOrder.payment_method && (
                <div className="flex justify-between"><span className="text-slate-500">Payment</span><span className="font-medium">{selectedOrder.payment_method}</span></div>
              )}
              {selectedOrder.address && (
                <div className="flex justify-between gap-4"><span className="text-slate-500">Address</span><span className="font-medium text-right">{selectedOrder.address}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500">Placed</span><span className="font-medium">{new Date(selectedOrder.created_at || Date.now()).toLocaleString()}</span></div>
            </div>

            {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">Items</h4>
                <div className="space-y-1">
                  {selectedOrder.items.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm border-b border-slate-100 py-1">
                      <span>{it.quantity ? `${it.quantity}× ` : ""}{it.name || it.item_name || "Item"}</span>
                      <span>Rs {(it.price || it.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedOrder(null)}
              className="mt-6 w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Assign rider popup */}
      {assignOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignOrder(null)}>
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Assign Rider</h3>
            <p className="text-sm text-slate-500 mb-4">Order #{assignOrder.id}</p>
            {riders.length === 0 ? (
              <p className="text-sm text-slate-600 mb-4">No approved riders available.</p>
            ) : (
              <select
                value={selectedRider}
                onChange={(e) => setSelectedRider(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none mb-4"
              >
                <option value="">Select a rider...</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name || "Rider"} {r.phone ? `(${r.phone})` : ""} {r.is_online ? "• online" : ""}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                onClick={submitAssign}
                disabled={assigning || !selectedRider}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
              <button
                onClick={() => setAssignOrder(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
