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


  /** Record a payment made to a rider.
   *
   *  `period` is the WEEK the payment is for (money audit M4 - the same hole
   *  M2 closed for shops). The By Pay Period screen counts a payment against
   *  the period it NAMES, and falls back to the day it was typed only when it
   *  names none. So a payment for last week, recorded on Monday, was counted
   *  against THIS week: last week still showed as owing (pay twice) and this
   *  week showed as already paid (pay too little). */
  async recordRiderPayout(
    riderId: string,
    amount: number,
    method: string,
    period?: { from: string; to: string },
    key?: string,
  ) {
    return this.requestOnce(`/admin/riders/payouts/record`, {
      rider_id: riderId, amount, method,
      ...(period ? { period_from: period.from, period_to: period.to } : {}),
    }, key);
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

  // What a banner switched to live product pictures would show (Mock 79).
  // `enough` is false when the app would show the banner's own picture.
  async getBannerLivePreview(actionType: string, actionValue: string) {
    const qs = new URLSearchParams({
      action_type: actionType || "none",
      action_value: actionValue || "",
    });
    return this.request(`/admin/promo-banners/live-preview?${qs}`);
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

  // ── Announcements: the strip at the top of the three apps ─────────────────
  //
  // Replaces the single `banner_text` / `banner_active` pair that used to live
  // on the Settings screen. Sana, 4 September 2026: "I want full modification
  // setting in admin panel for that banner." Everything about how the strip
  // looks, when it shows and how it moves is a column on a row now, so it can
  // be changed from here instead of by a developer and a Play Store release.
  async getAnnouncements() {
    return this.request(`/admin/announcements`);
  }

  async createAnnouncement(payload: any) {
    return this.request(`/admin/announcements`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAnnouncement(id: string, payload: any) {
    return this.request(`/admin/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteAnnouncement(id: string) {
    return this.request(`/admin/announcements/${id}`, { method: "DELETE" });
  }

  // Same rule as the banners: the whole list goes, not one row's new number.
  async reorderAnnouncements(ids: string[]) {
    return this.request(`/admin/announcements/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  }

  // How long each announcement holds the top before the next takes its turn.
  // One number for the whole app, so three rows cannot disagree about it.
  async setAnnouncementRotate(seconds: number) {
    return this.request(`/admin/announcements/rotate`, {
      method: "PUT",
      body: JSON.stringify({ seconds }),
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

  /** Record cash a rider physically handed back.
   *
   *  NO WEEK HERE, ON PURPOSE. The table has period columns, but nothing in
   *  Takal reads them for a hand-in: what a rider owes is always all-time
   *  (cash collected, less cash handed in), never per week. Asking the office
   *  a question whose answer changes no figure is friction, not safety. If a
   *  weekly cash statement is ever built, this is the line to change. */
  async recordCashHandover(payload: { rider_id: string; amount: number; method?: string; reference?: string },
                           key?: string) {
    return this.requestOnce(`/admin/riders/cash-handovers/record`, payload, key);
  }

  // Payments / settlements
  async getRestaurantPayoutReconciliation(days?: number) {
    return this.request(`/admin/restaurants/payout-reconciliation${days ? `?days=${days}` : ""}`);
  }

  /** What the referral scheme has given away, and the credit it created.
   *  Mock 97, approved by Sana 19 September 2026. */
  async getReferrals(limit = 200) {
    return this.request(`/admin/referrals?limit=${encodeURIComponent(String(limit))}`);
  }

  async getPayoutHistory() {
    return this.request(`/admin/payouts/history`);
  }

  /**
   * WHICH WEEK IS THIS PAYING FOR? (money audit M2, 19 September 2026)
   *
   * The server has understood `period_from` / `period_to` for weeks - a
   * payment that NAMES its period belongs to that period and to no other -
   * and this call never sent them. So every payment fell back to the day it
   * was typed, and the Pay Out screen (which opens on LAST period) went on
   * showing money that had already been handed over, while THIS period's
   * "to pay" came out too small by the same amount.
   *
   * Overpaying one week and underpaying the next, from one missing field.
   */
  async recordRestaurantPayout(payload: {
    restaurant_id: string;
    amount: number;
    method?: string;
    reference?: string;
    note?: string;
    /** YYYY-MM-DD. Left out only for a payment that is not for one week. */
    period_from?: string;
    period_to?: string;
  }, key?: string) {
    return this.requestOnce("/admin/payouts/record", payload, key);
  }

  /** Cancel a shop payment that was recorded wrongly. Money audit M3.
   *
   *  NOT an edit and NOT a delete: the wrong row stays, marked cancelled, with
   *  the reason on it, and the right amount is recorded as a new payment.
   *  Main Admin only, and the reason is required by the server and by the
   *  database.
   *
   *  The id sits AFTER the word "cancel" in the address because the server's
   *  permission list matches on the START of a path - ".../{id}/cancel" could
   *  not be given a Main-Admin-only line of its own. */
  async cancelRestaurantPayout(payoutId: string, reason: string) {
    return this.requestOnce(
      `/admin/payouts/cancel/${encodeURIComponent(payoutId)}`, { reason });
  }

  /** Every rider payment recorded, newest first. Cancelled ones are IN the
   *  list, marked - the total the server sends back leaves them out. */
  async getRiderPayoutHistory(riderId?: string) {
    return this.request(`/admin/riders/payouts/history${
      riderId ? `?rider_id=${encodeURIComponent(riderId)}` : ""}`);
  }

  /** Every rider cash hand-in recorded, newest first. Same rule as above. */
  async getRiderHandoverHistory(riderId?: string) {
    return this.request(`/admin/riders/cash-handovers/history${
      riderId ? `?rider_id=${encodeURIComponent(riderId)}` : ""}`);
  }

  /** Cancel a rider payment recorded wrongly. See cancelRestaurantPayout. */
  async cancelRiderPayout(payoutId: string, reason: string) {
    return this.requestOnce(
      `/admin/riders/payouts/cancel/${encodeURIComponent(payoutId)}`, { reason });
  }

  /** Cancel a rider cash hand-in recorded wrongly.
   *
   *  This one can change whether a rider is allowed to work: a hand-in reduces
   *  the cash he is holding, and too much cash in hand suspends him. */
  async cancelRiderHandover(handoverId: string, reason: string) {
    return this.requestOnce(
      `/admin/riders/cash-handovers/cancel/${encodeURIComponent(handoverId)}`, { reason });
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
    /** YYYY-MM. Which month these terms start in - money audit M10.
     *  Left out, the server uses the current month in PAKISTAN time, which is
     *  the rule: a pay change starts in the month it is made, for the whole of
     *  that month, and never touches an earlier one. It is sent at all so a
     *  rise agreed earlier can be back-dated. */
    effective_from?: string;
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
  }, key?: string) {
    return this.requestOnce("/admin/staff/payouts/record", payload, key);
  }

  /** Cash a staff member handed back to the office. They hand over EVERYTHING
   *  they collected; their pay comes back to them separately, above. */
  async recordStaffCashHandover(payload: {
    user_id: string;
    amount: number;
    method?: string;
    reference?: string;
    note?: string;
  }, key?: string) {
    return this.requestOnce("/admin/staff/cash-handovers/record", payload, key);
  }

  /** Every staff payment and every cash hand-in, newest first.
   *
   *  Both lists in one reply on purpose: the question somebody actually asks
   *  is "what has moved between this person and the office", and answering it
   *  from two screens is how the two get compared wrongly.
   *
   *  CANCELLED ROWS ARE IN THIS LIST. They carry `voided_at`, `voided_by` and
   *  `void_reason`, and the totals beside them already leave them out. A
   *  history that hides a cancellation hides the mistake and whoever made it.
   *
   *  The endpoint has existed since the staff pay screen was built. Nothing in
   *  the panel asked for it until Mock 101, on 21 September 2026. */
  async getStaffMoneyHistory(userId?: string) {
    return this.request(
      `/admin/staff/history${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`);
  }

  /** Cancel a staff payment recorded wrongly. Mock 101.
   *
   *  NOT an edit and NOT a delete - the row stays, marked cancelled, carrying
   *  the reason and the admin's name. Main Admin only, checked again on the
   *  server. The money goes straight back into what that person is owed. */
  async cancelStaffPayout(payoutId: string, reason: string) {
    return this.requestOnce(
      `/admin/staff/payouts/cancel/${encodeURIComponent(payoutId)}`, { reason });
  }

  /** Cancel a staff cash hand-in recorded wrongly. Mock 101.
   *
   *  This puts the cash BACK in that person's hands as far as the books are
   *  concerned, which is the point if the hand-in never happened. */
  async cancelStaffHandover(handoverId: string, reason: string) {
    return this.requestOnce(
      `/admin/staff/cash-handovers/cancel/${encodeURIComponent(handoverId)}`, { reason });
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

  // getStaffMoneyHistory was removed on 4 September 2026 - nothing called it.
  // The old text is kept in DELETE-AFTER-TESTING/admin-audit-2026-09-04/.
}
