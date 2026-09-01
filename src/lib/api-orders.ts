/**
 * Orders, returns, parcels and the messages sent out.\n *\n * Everything that happens to an order after it is placed: looking at it,\n * cancelling it, handing it to a rider, approving a return, and the Takal-office\n * parcel desk that Standard deliveries pass through.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientCore } from "./api-core";

export class APIClientOrders extends APIClientCore {

  // Dashboard
  async getDashboard() {
    return this.request("/admin/dashboard");
  }

  // Orders
  async getOrders(page = 1, limit = 50, filters: any = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...filters,
    });
    return this.request(`/admin/orders?${params}`);
  }

  async cancelOrder(orderId: string, reason: string) {
    return this.request(`/admin/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async assignRider(orderId: string, riderId: string) {
    return this.request(`/admin/orders/${orderId}/assign-rider`, {
      method: "PUT",
      body: JSON.stringify({ rider_id: riderId }),
    });
  }

  /** Move one of the store's orders along: accepted / ready / cancelled, etc. */
  async setOrderStatus(orderId: string, status: string, rejectionReason?: string) {
    const p = new URLSearchParams({ order_status: status });
    if (rejectionReason) p.set("rejection_reason", rejectionReason);
    return this.request(`/orders/${orderId}/status?${p.toString()}`, { method: "PUT" });
  }

  // Returns / refunds
  async getReturns(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(`/admin/returns${qs}`);
  }

  async approveReturn(orderId: string, note?: string, amount?: number) {
    return this.requestOnce(`/admin/returns/${orderId}/approve`, {
      note: note ?? null, amount: amount ?? null,
    });
  }

  async rejectReturn(orderId: string, note?: string) {
    return this.request(`/admin/returns/${orderId}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? null }),
    });
  }

  // Refunds (record-only)
  async refundOrder(orderId: string, payload: { amount: number; reason?: string }) {
    return this.requestOnce(`/admin/orders/${orderId}/refund`, payload);
  }

  /** Parcels awaiting drop-off, held in an office, or already sent out. */
  async getHubParcels(
    params: { hub_id?: string; status?: string; mine?: boolean } = {}
  ) {
    const qs = new URLSearchParams();
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    if (params.status) qs.set("status", params.status);
    if (params.mine) qs.set("mine", "true");
    const s = qs.toString();
    return this.request(`/admin/hub-parcels${s ? `?${s}` : ""}`);
  }

  /** Confirm the vendor physically handed the parcel in. */
  async receiveParcel(orderId: string, body: { hub_id?: string; note?: string } = {}) {
    return this.request(`/orders/${orderId}/hub/receive`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  /** Send the parcel out from the office to the customer. */
  /** Hand a parcel to a named person and send it out.
   *  staff_id is required by the server — a parcel that leaves the office
   *  without a name attached is exactly the gap this replaced. */
  async dispatchParcel(orderId: string, staffId: string) {
    const p = new URLSearchParams({ staff_id: staffId });
    return this.request(`/orders/${orderId}/hub/dispatch?${p.toString()}`, {
      method: "PUT",
    });
  }

  /** Who may be given a parcel, plus each person's day: how many they were
   *  handed and for how much, how many they closed, and what is still in their
   *  bag. `day` is YYYY-MM-DD and defaults to today. */
  async getDeliveryStaff(day?: string) {
    const p = day ? `?day=${encodeURIComponent(day)}` : "";
    return this.request(`/admin/hub-parcels/staff${p}`);
  }

  /// Hand a parcel over at the door. The 4-digit code the customer reads out
  /// is checked BY THE SERVER — see routers/orders.py. Leaving it out is an
  /// override and needs a written reason instead.
  async deliverParcel(
    orderId: string,
    opts: { code?: string; bypassReason?: string } = {},
  ) {
    // THE DOOR CODE GOES IN THE BODY, NOT IN THE WEB ADDRESS.
    //
    // It used to be sent as `?delivery_code=1234`. Everything after the `?` is
    // written down by things that are not the server - the hosting provider's
    // access log, any proxy in between, and this browser's own history. A
    // secret written into a log on every delivery is not a secret. In the body
    // it is part of the request itself: not logged, not in history.
    return this.request(`/orders/${orderId}/status?order_status=delivered`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delivery_code: opts.code || null,
        bypass_reason: opts.bypassReason || null,
      }),
    });
  }

  /// Send a stuck parcel back to "waiting to be dropped off".
  async resetParcel(orderId: string, reason: string) {
    const p = new URLSearchParams({ reason });
    return this.request(`/orders/${orderId}/hub/reset?${p.toString()}`, {
      method: "PUT",
    });
  }

  // Sent broadcast history
  async getNotificationsHistory() {
    return this.request(`/admin/notifications/history`);
  }

  // Notifications
  async broadcastNotification(payload: { role?: string | null; title: string; body: string; type?: string }) {
    return this.request("/admin/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}
