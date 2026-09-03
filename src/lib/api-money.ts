/**
 * Money, reports and everything the owner sets.\n *\n * What each shop and rider is owed and what has been paid, the cash riders are\n * still holding, revenue and forecast reports, the audit trail, promo codes,\n * home banners, welcome slides, Takal offices, and the platform's settings.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientPeople } from "./api-people";

export class APIClientMoney extends APIClientPeople {
  protected settlementQuery(p: { from?: string; to?: string; period?: string }) {
    const qs = new URLSearchParams();
    if (p.period) qs.set("period", p.period);
    if (p.from) qs.set("date_from", p.from);
    if (p.to) qs.set("date_to", p.to);
    const s = qs.toString();
    return s ? `?${s}` : "";
  }


  async recordRiderPayout(riderId: string, amount: number, method: string) {
    return this.requestOnce(`/admin/riders/payouts/record`, {
      rider_id: riderId, amount, method,
    });
  }

  // Analytics
  async getRevenueAnalytics(days = 30, groupBy = "day") {
    const params = new URLSearchParams({ days: String(days), group_by: groupBy });
    return this.request(`/admin/analytics/revenue?${params}`);
  }

  async getRiderAnalytics(days = 30) {
    const params = new URLSearchParams({ days: String(days) });
    return this.request(`/admin/analytics/riders?${params}`);
  }

  async getCustomerAnalytics(days = 90) {
    const params = new URLSearchParams({ days: String(days) });
    return this.request(`/admin/analytics/customers?${params}`);
  }

  async getForecastAnalytics(daysAhead = 7) {
    const params = new URLSearchParams({ days_ahead: String(daysAhead) });
    return this.request(`/admin/analytics/forecast?${params}`);
  }

  async getCategoryAnalytics(days = 30) {
    const params = new URLSearchParams({ days: String(days) });
    return this.request(`/admin/analytics/categories?${params}`);
  }

  // Reports
  async getExecutiveSummary() {
    return this.request("/admin/reports/executive-summary");
  }

  async getRevenueReport(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/reports/revenue?${params}`);
  }

  async getAuditLogs(days = 30) {
    const params = new URLSearchParams({ days: String(days) });
    return this.request(`/admin/audit-logs?${params}`);
  }

  // Settings
  // ── Takal offices (hubs) and the Standard-delivery parcel desk ────────────
  // Standard/marketplace orders are not carried by riders. The vendor brings the
  // parcel to a Takal office, staff confirm receipt, then send it out.
  async getHubs() {
    return this.request("/admin/hubs");
  }

  async createHub(hub: Record<string, unknown>) {
    return this.request("/admin/hubs", { method: "POST", body: JSON.stringify(hub) });
  }

  async updateHub(hubId: string, hub: Record<string, unknown>) {
    return this.request(`/admin/hubs/${hubId}`, { method: "PATCH", body: JSON.stringify(hub) });
  }

  /** Which payment methods are live, and what is still missing for the rest. */
  async getPaymentStatus() {
    return this.request("/admin/payment-status");
  }

  // ── Settlements: who is owed what, for a pay period ───────────────────────
  /** Ready-made pay periods (this, last, and earlier), from your cycle setting. */
  async getSettlementPeriods() {
    return this.request("/admin/settlements/periods");
  }

  /** One row per store: sold, commission, already paid, still to pay. */
  async getStoreSettlements(p: { from?: string; to?: string; period?: string } = {}) {
    return this.request(`/admin/settlements/stores${this.settlementQuery(p)}`);
  }

  /** One row per rider: earned, cash collected, cash still held, still to pay. */
  async getRiderSettlements(p: { from?: string; to?: string; period?: string } = {}) {
    return this.request(`/admin/settlements/riders${this.settlementQuery(p)}`);
  }

  async getSettings() {
    return this.request("/admin/settings");
  }

  /**
   * What a delivery of a given distance ACTUALLY costs, worked out by the same
   * backend code that charges the customer.
   *
   * The Rider Pay page used to draw its worked example with its own copy of
   * the fee formula, written again here in TypeScript. That copy left out both
   * the distance cap and the rounding rule, so the page could show a price the
   * customer is never charged - out by Rs 20 the moment the delivery limit was
   * set below the example distance. One formula, asked for.
   */
  async getFeeExamples() {
    return this.request("/admin/settings/fee-examples");
  }

  async updateSettings(settings: any) {
    return this.request("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // Per-store-type (vertical) commission overrides.
  async getVerticalCommissions() {
    return this.request(`/admin/vertical-commissions`);
  }

  async setVerticalCommission(vendorType: string, percent: number | null) {
    const qs = percent === null ? "" : `?percent=${percent}`;
    return this.request(`/admin/vertical-commissions/${encodeURIComponent(vendorType)}${qs}`, {
      method: "PUT",
    });
  }

  // Home promo banners (the big cards on the customer home screen).
  async getPromoBanners() {
    return this.request(`/admin/promo-banners`);
  }

  async createPromoBanner(payload: any) {
    return this.request(`/admin/promo-banners`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updatePromoBanner(id: string, payload: any) {
    return this.request(`/admin/promo-banners/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deletePromoBanner(id: string) {
    return this.request(`/admin/promo-banners/${id}`, { method: "DELETE" });
  }

  // Drag the banners into an order and save it as 1, 2, 3…
  //
  // Sending the whole list rather than one banner's new number is deliberate:
  // renumbering one banner is how two of them end up sharing a position, and
  // hand-typed positions are exactly what this replaces.
  async reorderPromoBanners(ids: string[]) {
    return this.request(`/admin/promo-banners/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  }

  // Welcome / onboarding slides.
  async getOnboardingSlides() {
    return this.request(`/admin/onboarding`);
  }

  async createOnboardingSlide(payload: any) {
    return this.request(`/admin/onboarding`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateOnboardingSlide(id: string, payload: any) {
    return this.request(`/admin/onboarding/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteOnboardingSlide(id: string) {
    return this.request(`/admin/onboarding/${id}`, { method: "DELETE" });
  }

  async reorderOnboardingSlides(ids: string[]) {
    return this.request(`/admin/onboarding/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  }

  // Promo codes
  async getPromos() {
    return this.request(`/admin/promo-codes`);
  }

  async createPromo(payload: any) {
    return this.request(`/admin/promo-codes`, { method: "POST", body: JSON.stringify(payload) });
  }

  async updatePromo(promoId: string, payload: any) {
    return this.request(`/admin/promo-codes/${promoId}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deletePromo(promoId: string) {
    return this.request(`/admin/promo-codes/${promoId}`, { method: "DELETE" });
  }

  // What one code has cost, and who used it.
  //
  // Nothing here is new data: every redemption already records the customer,
  // the order, the moment and the exact discount. This is the first screen
  // that ever reads it back.
  async getPromoCost(promoId: string) {
    return this.request(`/admin/promo-codes/${promoId}/cost`);
  }

  // How many people a message would reach, asked BEFORE it is sent, so the
  // confirm window can carry the real number.
  async getBroadcastAudience(role?: string | null) {
    const p = role ? `?role=${encodeURIComponent(role)}` : "";
    return this.request(`/admin/notifications/audience${p}`);
  }

  // Every message that has been sent to everybody.
  async getBroadcasts(limit = 25) {
    return this.request(`/admin/broadcasts?limit=${limit}`);
  }

  // Rider payouts
  async getRiderPayoutsReport() {
    return this.request(`/admin/riders/payouts`);
  }

  // Rider cash reconciliation (cash-on-delivery).
  // Either a trailing window (`days`) or an exact pay period (from/to).
  async getRiderCashReconciliation(
    days?: number,
    from?: string,
    to?: string,
  ) {
    const p = new URLSearchParams();
    if (from && to) {
      p.set("date_from", from);
      p.set("date_to", to);
    } else if (days) {
      p.set("days", String(days));
    }
    const qs = p.toString();
    return this.request(`/admin/riders/cash-reconciliation${qs ? `?${qs}` : ""}`);
  }

  async recordCashHandover(payload: { rider_id: string; amount: number; method?: string; reference?: string }) {
    return this.requestOnce(`/admin/riders/cash-handovers/record`, payload);
  }

  // Payments / settlements
  async getRestaurantPayoutReconciliation(days?: number) {
    return this.request(`/admin/restaurants/payout-reconciliation${days ? `?days=${days}` : ""}`);
  }

  async getPayoutHistory() {
    return this.request(`/admin/payouts/history`);
  }

  async recordRestaurantPayout(payload: {
    restaurant_id: string;
    amount: number;
    method?: string;
    reference?: string;
    note?: string;
  }) {
    return this.requestOnce("/admin/payouts/record", payload);
  }

  // ── PARCEL STAFF ──────────────────────────────────────────────────────────
  // The office staff who carry marketplace parcels. Until 2 September 2026 they
  // were in no money screen at all: every parcel recorded a wage of Rs 0, and
  // Rs 15,562 of the cash they had collected was tracked nowhere.

  /** One row per staff member for one calendar month: salary, bonus, what to
   *  pay, and - as a completely separate account - the cash they still hold. */
  async getStaffPay(month?: string) {
    return this.request(
      `/admin/staff/pay${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  }

  /** Set one person's salary, daily parcel target and bonus rate. */
  async setStaffPayTerms(userId: string, payload: {
    monthly_salary: number;
    daily_delivery_target: number;
    bonus_per_extra_delivery: number;
    is_active: boolean;
    note?: string;
  }) {
    return this.request(
      `/admin/staff/pay-settings/${encodeURIComponent(userId)}`,
      { method: "PUT", body: JSON.stringify(payload) });
  }

  /** Salary or bonus paid to a staff member. requestOnce, not request: this
   *  moves money, and a retried request would pay the same person twice. */
  async recordStaffPayout(payload: {
    user_id: string;
    amount: number;
    kind?: "salary" | "bonus" | "other";
    method?: string;
    reference?: string;
    note?: string;
    period_from?: string;
    period_to?: string;
  }) {
    return this.requestOnce("/admin/staff/payouts/record", payload);
  }

  /** Cash a staff member handed back to the office. They hand over EVERYTHING
   *  they collected; their pay comes back to them separately, above. */
  async recordStaffCashHandover(payload: {
    user_id: string;
    amount: number;
    method?: string;
    reference?: string;
    note?: string;
  }) {
    return this.requestOnce("/admin/staff/cash-handovers/record", payload);
  }

  /** WHAT TAKAL ITSELF EARNED — commission, markup, rider delivery margin and
   *  parcel shipping — for a period AND all-time, side by side.
   *
   *  The Dashboard's headline has always been GMV (what CUSTOMERS paid, almost
   *  all of it the shops') labelled "Revenue". This is the other number. */
  async getEarnings(p: { days?: number; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (p.days) qs.set("days", String(p.days));
    if (p.from) qs.set("date_from", p.from);
    if (p.to) qs.set("date_to", p.to);
    const s = qs.toString();
    return this.request(`/admin/earnings${s ? `?${s}` : ""}`);
  }

  /** GO LIVE — is Takal still a test system, and what exactly would be cleared?
   *  The counts are read live, so the screen shows the real rows rather than a
   *  list somebody wrote weeks ago. */
  async getGoLiveStatus() {
    return this.request("/admin/go-live");
  }

  /** Clear the internal-tester data and put Takal live. ONCE, and only once.
   *
   *  Not requestOnce: a one-time key is for making a repeat harmless, and this
   *  is not a payment that could be sent twice — the server refuses outright
   *  once `went_live_at` is stamped, which is a stronger guarantee. */
  async goLive(payload: {
    confirm: string;
    keep_customers: boolean;
    keep_audit_log: boolean;
    keep_distances: boolean;
    /** "clear" wipes the slate so testing can start again — as often as
     *  needed. "go_live" does the same clear and then closes the door for
     *  good. Defaults to the harmless one on the server too. */
    mode: "clear" | "go_live";
  }) {
    return this.request("/admin/go-live", {
      method: "POST",
      body: JSON.stringify(payload),
      // THREE MINUTES, NOT FIFTEEN SECONDS.
      //
      // This one request copies sixteen tables into a new schema and then
      // empties seventeen, inside one transaction, on a free-tier database.
      // The panel's usual 15-second limit is right for reading a list and
      // wrong for this. Found live on 2 September 2026: the clear was cut off
      // and the owner was told "this may or may not have gone through" about
      // an action that cannot be undone. Nothing had happened, but there was
      // no way for her to know that from the screen.
      timeoutMs: 180000,
    });
  }

  /** Every staff payment and every handover, newest first. */
  async getStaffMoneyHistory(userId?: string) {
    return this.request(
      `/admin/staff/history${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`);
  }
}
