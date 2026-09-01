"use client";

import { useState, useEffect } from "react";
import { Search, Download, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { toast } from "@/lib/toast";
import { money, fmtDate, fmtDateTime } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { errorMessage } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

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
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const submitRefund = async () => {
    if (!selectedOrder) return;
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt < 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    try {
      setRefunding(true);
      await apiClient.refundOrder(selectedOrder.id, { amount: amt, reason: refundReason || undefined });
      toast("Refund recorded", "success");
      setShowRefund(false);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record refund", "error");
    } finally {
      setRefunding(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;

      const response = await apiClient.getOrders(page, PAGE_SIZE, filters) as any;
      setOrders(response?.orders || response?.data || []);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
        setOrders([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Live auto-refresh every 30s (silent), paused while a popup is open.
  useEffect(() => {
    const t = setInterval(() => {
      if (!selectedOrder && !assignOrder) fetchOrders(true);
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, selectedOrder, assignOrder]);

  const handleCancelOrder = async (orderId: string) => {
    // THE REASON WAS INVENTED HERE, and then thrown away by the server.
    //
    // This used to send the literal string "Admin cancelled" for every
    // cancellation - nobody was ever asked. And it went in the request BODY
    // while the server read it from the web address, so even that placeholder
    // never arrived: every admin cancellation recorded "[ADMIN CANCELLED]"
    // with nothing after it, and no way to find out afterwards why.
    //
    // A cancellation is money and a customer's evening. It gets a reason.
    const reason = window.prompt(
      "Cancel this order. Why? The customer is shown this, and it is kept on " +
      "the order.",
      ""
    );
    if (reason === null) return;              // they changed their mind
    if (!reason.trim()) {
      toast("Please give a reason - the customer is shown it.", "error");
      return;
    }

    try {
      setCancelingOrderId(orderId);
      await apiClient.cancelOrder(orderId, reason.trim());
      toast("Order cancelled", "success");
      await fetchOrders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel order", "error");
    } finally {
      setCancelingOrderId(null);
    }
  };

  // WHY THIS CARRIES ITS OWN ERROR MESSAGE.
  //
  // The rider list is guarded by the "riders" permission, not "orders". So an
  // admin who handles orders and nothing else gets refused here - and this used
  // to swallow the refusal and show them "No approved riders available."
  //
  // That is a false statement about the world. There are riders; they are just
  // not allowed to see them. And the false version gives them nothing to do,
  // because the fix is to ask the Main Admin for the "riders" permission and
  // nothing on the screen said so.
  const [riderError, setRiderError] = useState("");

  const openAssign = async (order: any) => {
    setAssignOrder(order);
    setSelectedRider("");
    setRiderError("");
    try {
      const res = (await apiClient.getRiders({})) as any;
      const list = (res?.riders || res?.data || []).filter(
        (r: any) => r.is_approved && !r.is_suspended
      );
      setRiders(list);
    } catch (err) {
      setRiders([]);
      setRiderError(errorMessage(err, "riders"));
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
      cooking: "bg-amber-50 text-amber-800",
      ready: "bg-amber-50 text-amber-800",
      delivering: "bg-blue-50 text-blue-700",
      delivered: "bg-green-50 text-green-700",
      cancelled: "bg-red-50 text-red-700",
    };
    return colors[status] || "bg-takal-page text-takal-ink";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">All Orders</h2>
          <p className="text-takal-ink-soft mt-1 flex items-center gap-2">
            Manage all orders and tracking
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadCsv("orders.csv", filteredOrders, [
                { key: "id", label: "Order ID" },
                { key: "customer_name", label: "Customer" },
                { key: "restaurant_name", label: "Restaurant" },
                { key: "total_amount", label: "Amount" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "Date" },
              ]) || toast("Nothing to export.", "info")
            }
            className="flex items-center gap-2 px-4 py-2 bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchOrders()}
            className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && <ErrorState message={error} />}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-takal-line p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-takal-disabled-text" />
              <input
                type="text"
                placeholder="Search by order ID or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
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
      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Restaurant
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* 7 headings above, so 7 here. It said 8, which pushed a
                   grey cell outside the table's own column grid. */
                <SkeletonRows rows={8} cols={7} />
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-takal-ink-soft">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {order.customer_name || order.customer || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {order.restaurant_name || order.restaurant || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">
                      {money(order.total_amount || order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {fmtDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-takal-ink hover:text-takal-ink font-medium"
                      >
                        View
                      </button>
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => openAssign(order)}
                          className="text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
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
          className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm text-takal-ink-soft">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={orders.length < PAGE_SIZE || loading}
          className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page disabled:opacity-40"
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
              <h3 className="text-lg font-bold text-takal-ink">Order #{selectedOrder.id}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-takal-disabled-text hover:text-takal-ink text-xl">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-takal-ink-soft">Status</span><span className="font-medium">{selectedOrder.status || "—"}</span></div>
              <div className="flex justify-between"><span className="text-takal-ink-soft">Customer</span><span className="font-medium">{selectedOrder.customer_name || selectedOrder.customer || "—"}</span></div>
              <div className="flex justify-between"><span className="text-takal-ink-soft">Restaurant</span><span className="font-medium">{selectedOrder.restaurant_name || selectedOrder.restaurant || "—"}</span></div>
              <div className="flex justify-between"><span className="text-takal-ink-soft">Amount</span><span className="font-medium">{money(selectedOrder.total_amount || selectedOrder.total || 0)}</span></div>
              {/*
                WHY THE ORDER ENDED. It was saved and shown nowhere: a shop's
                reject reason went into the database and no screen read it
                back, so the office could see that an order had been rejected
                and never why.
              */}
              {selectedOrder.rejection_reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-takal-ink-soft whitespace-nowrap">Reason</span>
                  <span className="font-medium text-right">{selectedOrder.rejection_reason}</span>
                </div>
              )}
              {selectedOrder.cancelled_by_role && (
                <div className="flex justify-between">
                  <span className="text-takal-ink-soft">Ended by</span>
                  <span className="font-medium capitalize">{selectedOrder.cancelled_by_role}</span>
                </div>
              )}
              {selectedOrder.delivery_fee != null && (
                <div className="flex justify-between"><span className="text-takal-ink-soft">Delivery fee</span><span className="font-medium">{money(selectedOrder.delivery_fee)}</span></div>
              )}
              {selectedOrder.payment_method && (
                <div className="flex justify-between"><span className="text-takal-ink-soft">Payment</span><span className="font-medium">{selectedOrder.payment_method}</span></div>
              )}
              {selectedOrder.address && (
                <div className="flex justify-between gap-4"><span className="text-takal-ink-soft">Address</span><span className="font-medium text-right">{selectedOrder.address}</span></div>
              )}
              <div className="flex justify-between"><span className="text-takal-ink-soft">Placed</span><span className="font-medium">{fmtDateTime(selectedOrder.created_at)}</span></div>
            </div>

            {/* Status timeline */}
            <div className="mt-4">
              <h4 className="font-semibold text-takal-ink mb-2 text-sm">Progress</h4>
              {selectedOrder.status === "cancelled" ? (
                <p className="text-sm text-red-600">Order was cancelled.</p>
              ) : (
                <ol className="space-y-1.5">
                  {["pending", "confirmed", "cooking", "ready", "delivering", "delivered"].map((st, i, arr) => {
                    const curIdx = arr.indexOf(selectedOrder.status);
                    const done = curIdx >= 0 && i <= curIdx;
                    return (
                      <li key={st} className="flex items-center gap-2 text-sm">
                        <span className={`w-2.5 h-2.5 rounded-full ${done ? "bg-green-500" : "bg-slate-200"}`}></span>
                        <span className={done ? "text-takal-ink font-medium" : "text-takal-disabled-text"}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-takal-ink mb-2 text-sm">Items</h4>
                <div className="space-y-1">
                  {selectedOrder.items.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm border-b border-takal-line py-1">
                      <span>{it.quantity ? `${it.quantity}× ` : ""}{it.name || it.item_name || "Item"}</span>
                      <span>{money(it.price || it.total || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refund (record-only) */}
            {selectedOrder.refunded ? (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2">
                Refunded {money(selectedOrder.refund_amount)}{selectedOrder.refund_reason ? ` — ${selectedOrder.refund_reason}` : ""}
              </div>
            ) : showRefund ? (
              <div className="mt-4 space-y-2">
                <input
                  type="number"
                  min={0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Refund amount (Rs)"
                  className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none focus:ring-2 focus:ring-takal-yellow text-sm"
                />
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2 border border-takal-line rounded-lg outline-none focus:ring-2 focus:ring-takal-yellow text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={submitRefund} disabled={refunding} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm disabled:opacity-50">
                    {refunding ? "Saving..." : "Save refund"}
                  </button>
                  <button onClick={() => setShowRefund(false)} className="px-4 py-2 border border-takal-line rounded-lg text-sm hover:bg-takal-page">Cancel</button>
                </div>
                <p className="text-xs text-takal-disabled-text">This only records the refund — pay the customer back manually.</p>
              </div>
            ) : (
              <button
                onClick={() => { setShowRefund(true); setRefundAmount(String(selectedOrder.total_amount || selectedOrder.total || "")); setRefundReason(""); }}
                className="mt-4 text-sm text-amber-700 hover:underline"
              >
                Record a refund
              </button>
            )}

            <button
              onClick={() => setSelectedOrder(null)}
              className="mt-4 w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
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
            <h3 className="text-lg font-bold text-takal-ink mb-1">Assign Rider</h3>
            <p className="text-sm text-takal-ink-soft mb-4">Order #{assignOrder.id}</p>
            {riderError ? (
              // Say what actually happened. "No riders available" was a lie
              // whenever the real reason was a missing permission.
              <div className="mb-4 rounded-lg border border-[#FFD2BF] bg-takal-orange-soft px-4 py-3 text-sm text-[#C8410F]">
                {riderError}
              </div>
            ) : riders.length === 0 ? (
              <p className="text-sm text-takal-ink-soft mb-4">No approved riders available.</p>
            ) : (
              <select
                value={selectedRider}
                onChange={(e) => setSelectedRider(e.target.value)}
                className="w-full px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none mb-4"
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
                className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
              <button
                onClick={() => setAssignOrder(null)}
                className="px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page"
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
