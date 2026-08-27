/**
 * API Client for Admin Panel
 * Handles all communication with backend API
 */

// The backend origin is fixed at build time.
//
// SECURITY: this used to be read from `localStorage.getItem("api_url")`, which
// meant anything able to write a single localStorage key — any XSS, any
// malicious bookmarklet, any shared browser profile — could point every
// subsequent API call at a server of its choosing. Each of those calls carries
// the admin's bearer token in the Authorization header, so one writable key
// was enough to exfiltrate full admin access. It is now a constant.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";

/** Random key so a resubmitted write is recognised and ignored by the server. */
function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export class APIClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.token = typeof window !== "undefined"
      ? localStorage.getItem("admin_token") || ""
      : "";
  }

  private getHeaders() {
    // Read the token fresh each call so a login mid-session is always picked up.
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : this.token;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  private get base() {
    return this.baseUrl;
  }

  /**
   * POST a money-moving action exactly once.
   *
   * The key is generated per logical action and reused across retries, so if
   * the response is lost in transit the server recognises the resubmission and
   * replays the original result instead of paying a second time.
   */
  private async requestOnce<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": newIdempotencyKey() },
    });
  }

  /**
   * Fire-and-forget wake-up ping (like the customer app's splash does). Hits
   * /health with NO retry and swallows all errors, so the free-tier server
   * starts waking in the background before the admin actually does anything —
   * making saves feel instant instead of waiting for a cold start.
   */
  warmUp(): void {
    if (typeof window === "undefined") return;
    try {
      fetch(`${this.base}/health`, { cache: "no-store" }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /**
   * Warm the cache for the pages you're most likely to open next (Orders,
   * Restaurants, Riders, Customers) right after login, so they appear instantly
   * when you click them. Fire-and-forget; failures are ignored. These call the
   * SAME endpoints with the SAME defaults the pages use on load, so the cached
   * URLs match exactly and turn into a cache hit.
   *
   * A short delay lets the page you're actually on finish loading first, so
   * these background warms don't compete with it on the free-tier backend.
   */
  prefetchCommon(): void {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("admin_token")) return;
    setTimeout(() => {
      this.getOrders(1, 50, {}).catch(() => {});
      this.getRestaurants({}).catch(() => {});
      this.getRiders({}).catch(() => {});
      this.getCustomers().catch(() => {});
    }, 1200);
  }

  // ── Short-lived GET cache for instant page loads ─────────────────────────
  // Successful GET responses are cached in memory for a short window. Re-opening
  // a page returns the cached data immediately (no spinner), then quietly
  // refreshes in the background. ANY write (POST/PUT/PATCH/DELETE) clears the
  // cache so lists are never stale right after you edit something.
  private static _cache = new Map<string, { data: any; ts: number }>();
  private static _inflight = new Map<string, Promise<any>>();
  private static readonly CACHE_TTL = 60_000;  // reuse cached data for up to 60s
  private static readonly CACHE_FRESH = 8_000;  // refresh in background if older than this
  private static _hydrated = false;
  private static readonly PERSIST_KEY = "admin_get_cache_v1";

  /** Load the cache from sessionStorage once, so a hard-refresh loads instantly. */
  private static _hydrate() {
    if (APIClient._hydrated || typeof window === "undefined") return;
    APIClient._hydrated = true;
    try {
      const raw = sessionStorage.getItem(APIClient.PERSIST_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as Record<string, { data: any; ts: number }>;
      const now = Date.now();
      for (const [k, v] of Object.entries(obj)) {
        if (v && now - v.ts < APIClient.CACHE_TTL) APIClient._cache.set(k, v);
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
  }

  /** Mirror the in-memory cache to sessionStorage (best-effort; ignores quota). */
  private static _persist() {
    if (typeof window === "undefined") return;
    try {
      const obj: Record<string, { data: any; ts: number }> = {};
      APIClient._cache.forEach((v, k) => (obj[k] = v));
      sessionStorage.setItem(APIClient.PERSIST_KEY, JSON.stringify(obj));
    } catch {
      /* storage full or unserializable — the in-memory cache still works */
    }
  }

  /** Wipe the read cache — called after every successful write. */
  static clearCache() {
    APIClient._cache.clear();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(APIClient.PERSIST_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private async request<T>(path: string, options: RequestInit = {}, attempt = 0): Promise<T> {
    const url = `${this.base}${path}`;
    const method = (options.method || "GET").toUpperCase();

    // Reads: serve from cache instantly, revalidate in the background.
    if (method === "GET" && attempt === 0) {
      APIClient._hydrate();
      const hit = APIClient._cache.get(url);
      const now = Date.now();
      if (hit && now - hit.ts < APIClient.CACHE_TTL) {
        if (now - hit.ts > APIClient.CACHE_FRESH) {
          this._fetchAndCache<T>(url, options).catch(() => {});
        }
        return hit.data as T;
      }
      // Collapse duplicate concurrent GETs into one network call.
      const pending = APIClient._inflight.get(url);
      if (pending) return pending as Promise<T>;
      const p = this._fetchAndCache<T>(url, options);
      APIClient._inflight.set(url, p);
      try {
        return await p;
      } finally {
        APIClient._inflight.delete(url);
      }
    }

    const result = await this._send<T>(url, options, attempt);
    // A successful write means cached lists may be out of date — drop them.
    if (method !== "GET") APIClient.clearCache();
    return result;
  }

  private async _fetchAndCache<T>(url: string, options: RequestInit): Promise<T> {
    const data = await this._send<T>(url, options, 0);
    APIClient._cache.set(url, { data, ts: Date.now() });
    APIClient._persist();
    return data;
  }

  private async _send<T>(url: string, options: RequestInit, attempt = 0): Promise<T> {
    // The free backend sleeps after inactivity and can take ~60-90s to wake (a
    // fresh redeploy is even longer). We wait it out with retries, BUT each try
    // has a hard timeout so a stalled connection can never freeze the UI — a
    // warm server answers in well under a second.
    //
    // ⚠️ RETRIES ARE ONLY SAFE FOR IDEMPOTENT REQUESTS.
    //
    // This retry loop used to apply to EVERY method. A 502/503/504 comes from an
    // upstream proxy and says nothing about whether the backend already committed
    // the write — and on a free tier that sleeps, a 502 *after* a successful
    // commit is routine. That meant a single click on "Save Payment" could send
    // recordRestaurantPayout up to 24 times and pay a vendor several times over.
    // Same for recordRiderPayout, refundOrder, approveReturn, recordCashHandover
    // and broadcastNotification (24 push broadcasts to every user).
    //
    // The UI's `disabled={saving}` guards do NOT help here: they prevent double
    // *clicks*, not double *sends* — the retries happen invisibly inside one await.
    //
    // GET/HEAD have no side effects, so they can be retried freely. Everything
    // else now fails fast and lets the operator decide whether to retry, which
    // is the safe default until the backend supports an Idempotency-Key.
    const method = (options.method || "GET").toUpperCase();
    const isIdempotent = method === "GET" || method === "HEAD";

    // 6 × 5s ≈ 30s, still comfortably covers a Render cold start. (Was 24,
    // which made a genuinely-down backend hang the UI for two full minutes.)
    const MAX_ATTEMPTS = isIdempotent ? 6 : 0;
    const WAIT_MS = 5000;
    const PER_TRY_TIMEOUT = 15000;   // never hang on a single attempt

    let response: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_TRY_TIMEOUT);
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });
    } catch {
      clearTimeout(timer);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
        return this._send<T>(url, options, attempt + 1);
      }
      throw new Error(
        isIdempotent
          ? "Can't reach the server. Check your connection and try again."
          : "Couldn't reach the server, so this may or may not have gone through. " +
            "Refresh and check before trying again."
      );
    } finally {
      clearTimeout(timer);
    }

    // 502/503/504 = the server is still waking or restarting.
    // Safe to retry for reads only — see the note above.
    if ((response.status === 502 || response.status === 503 || response.status === 504)) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
        return this._send<T>(url, options, attempt + 1);
      }
      if (!isIdempotent) {
        throw new Error(
          "The server didn't confirm this request, so it may or may not have gone " +
          "through. Refresh and check before trying again."
        );
      }
    }

    // 401 = the admin session has expired or been revoked. Without this the panel
    // showed "API Error: 401" on every page forever, with no route back to login.
    if (response.status === 401) {
      APIClient.handleUnauthorized();
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
  }

  /** Clear the session and send the admin back to the login page (once). */
  private static _redirecting = false;
  static handleUnauthorized() {
    if (typeof window === "undefined" || APIClient._redirecting) return;
    APIClient._redirecting = true;
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      APIClient.clearCache();   // don't leave cached customer data behind
    } catch {
      /* ignore storage errors */
    }
    if (!window.location.pathname.startsWith("/auth/login")) {
      window.location.href = "/auth/login?expired=1";
    }
  }

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

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
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

  // Restaurants
  async getRestaurants(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/restaurants?${params}`);
  }

  async getRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/detail`);
  }

  // How reliably each shop honours the orders it accepts — the evidence behind
  // the vendor terms clause about repeat cancellations.
  async getVendorReliability() {
    return this.request(`/admin/vendors/reliability`);
  }

  async approveRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/approve`, {
      method: "PUT",
    });
  }

  async rejectRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/reject`, {
      method: "PUT",
    });
  }

  async suspendRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/suspend`, {
      method: "PUT",
    });
  }

  async unsuspendRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/unsuspend`, {
      method: "PUT",
    });
  }

  async setRestaurantCommission(restaurantId: string, commission: number) {
    // Backend expects the value as a query param (?percent=), not a JSON body.
    return this.request(`/admin/restaurants/${restaurantId}/commission?percent=${commission}`, {
      method: "PUT",
    });
  }

  /** Set a store's map point. An EXPRESS store with no coordinates is hidden
   *  from customers, because a rider cannot be routed to it and the delivery
   *  fee cannot be calculated. */
  async setRestaurantLocation(restaurantId: string, latitude: number, longitude: number) {
    return this.request(`/restaurants/${restaurantId}`, {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    });
  }

  // ── Managing a store the way its owner would ──────────────────────────────
  // These all hit the same endpoints the vendor app uses. The backend already
  // lets an admin through (`_assert_owns_restaurant` returns early for the
  // admin role), so nothing new was needed server-side.

  /** Update a store's profile: name, phone, address, hours, minimum order,
   *  pickup, logo, open/closed. Only the fields you pass are changed. */
  async updateRestaurant(restaurantId: string, payload: Record<string, any>) {
    return this.request(`/restaurants/${restaurantId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  /** Flip a store between Open and Closed. */
  async toggleRestaurantOpen(restaurantId: string) {
    return this.request(`/restaurants/${restaurantId}/toggle`, { method: "PUT" });
  }

  /** Turn a map point into a readable street address (free, OpenStreetMap).
   *  The customer app already uses this to fill in an address from GPS. */
  async reverseGeocode(lat: number, lon: number) {
    return this.request(`/geocode/reverse?lat=${lat}&lon=${lon}`);
  }

  /** Everything the store sells, including items it has switched off. */
  async getRestaurantMenu(restaurantId: string) {
    return this.request(`/restaurants/${restaurantId}/menu?include_unavailable=true`);
  }

  /** Add a product to a store. */
  async createRestaurantMenuItem(restaurantId: string, payload: Record<string, any>) {
    return this.request(`/restaurants/${restaurantId}/menu`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /** That store's earnings and payout history (same figures the vendor sees). */
  async getRestaurantEarnings(restaurantId: string, period?: string) {
    return this.request(
      `/restaurants/${restaurantId}/earnings${period ? `?period=${period}` : ""}`,
    );
  }

  /** Move one of the store's orders along: accepted / ready / cancelled, etc. */
  async setOrderStatus(orderId: string, status: string, rejectionReason?: string) {
    const p = new URLSearchParams({ order_status: status });
    if (rejectionReason) p.set("rejection_reason", rejectionReason);
    return this.request(`/orders/${orderId}/status?${p.toString()}`, { method: "PUT" });
  }

  // Create a vendor login + store in one step; returns the credentials to share.
  async createStore(payload: {
    owner_name: string;
    phone: string;
    email?: string;
    password?: string;
    store_name: string;
    vendor_type: string;
    address?: string;
  }) {
    return this.request(`/admin/stores`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Change a store's TYPE (Food, Fashion, Pharmacy, …). Query param, not body.
  async setRestaurantVendorType(restaurantId: string, vendorType: string) {
    return this.request(
      `/admin/restaurants/${restaurantId}/vendor-type?vendor_type=${encodeURIComponent(vendorType)}`,
      { method: "PUT" }
    );
  }

  // Mark a store as Featured / Top-Rated (home Featured row + Top-Rated badge).
  async setRestaurantFeatured(restaurantId: string, featured: boolean) {
    return this.request(
      `/admin/restaurants/${restaurantId}/featured?featured=${featured}`,
      { method: "PUT" }
    );
  }

  // Mark a single product as Featured / Top-Rated (earns the Top-Rated badge).
  async setProductFeatured(itemId: string, featured: boolean) {
    return this.request(
      `/admin/menu/${itemId}/featured?featured=${featured}`,
      { method: "PUT" }
    );
  }

  // Every product/option at or below the stock threshold, across all stores.
  async getLowStock(threshold = 5) {
    return this.request(`/admin/low-stock?threshold=${threshold}`);
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

  // REMOVED: setDeliveryFee(restaurantId, fee)
  //
  // It posted to /admin/restaurants/{id}/delivery-fee, which does not exist —
  // nothing in the panel called it, so it never failed visibly, but wiring it
  // to a button would have. It also contradicted the pricing model: delivery is
  // charged as base + per-km from admin settings, not per store. The real
  // routes are PATCH /admin/restaurants/bulk-delivery-fee and the fee settings
  // page.

  // Riders
  async getRiders(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/riders?${params}`);
  }

  async getRider(riderId: string) {
    return this.request(`/admin/riders/${riderId}/detail`);
  }

  async approveRider(riderId: string) {
    return this.request(`/admin/riders/${riderId}/approve`, {
      method: "PUT",
    });
  }

  async rejectRider(riderId: string) {
    return this.request(`/admin/riders/${riderId}/reject`, {
      method: "PUT",
    });
  }

  async suspendRider(riderId: string) {
    return this.request(`/admin/riders/${riderId}/suspend`, {
      method: "PUT",
    });
  }

  async unsuspendRider(riderId: string) {
    return this.request(`/admin/riders/${riderId}/unsuspend`, {
      method: "PUT",
    });
  }

  async recordRiderPayout(riderId: string, amount: number, method: string) {
    return this.requestOnce(`/admin/riders/payouts/record`, {
      rider_id: riderId, amount, method,
    });
  }

  async getRiderPayouts(riderId: string) {
    return this.request(`/admin/riders/${riderId}/detail`);
  }

  // Users
  async getUsers() {
    return this.request("/admin/users");
  }

  async createUser(userData: any) {
    return this.request("/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: any) {
    return this.request(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string) {
    return this.request(`/admin/users/${userId}`, {
      method: "DELETE",
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

  async getPayoutsReport(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/reports/payouts?${params}`);
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

  async closeHub(hubId: string) {
    return this.request(`/admin/hubs/${hubId}`, { method: "DELETE" });
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
    const p = new URLSearchParams({ order_status: "delivered" });
    if (opts.code) p.set("delivery_code", opts.code);
    if (opts.bypassReason) p.set("bypass_reason", opts.bypassReason);
    return this.request(`/orders/${orderId}/status?${p.toString()}`, {
      method: "PUT",
    });
  }

  /// Send a stuck parcel back to "waiting to be dropped off".
  async resetParcel(orderId: string, reason: string) {
    const p = new URLSearchParams({ reason });
    return this.request(`/orders/${orderId}/hub/reset?${p.toString()}`, {
      method: "PUT",
    });
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

  private settlementQuery(p: { from?: string; to?: string; period?: string }) {
    const qs = new URLSearchParams();
    if (p.period) qs.set("period", p.period);
    if (p.from) qs.set("date_from", p.from);
    if (p.to) qs.set("date_to", p.to);
    const s = qs.toString();
    return s ? `?${s}` : "";
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

  async updateSettings(settings: any) {
    return this.request("/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  // Notifications
  async broadcastNotification(payload: { role?: string | null; title: string; body: string; type?: string }) {
    return this.request("/admin/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Current admin profile (role + permissions)
  async getMe() {
    return this.request(`/admin/me`);
  }

  // Customers
  async getCustomers() {
    return this.request(`/admin/customers`);
  }

  async getCustomerDetail(customerId: string) {
    return this.request(`/admin/customers/${customerId}/detail`);
  }

  async updateCustomer(customerId: string, payload: any) {
    return this.request(`/admin/customers/${customerId}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  async deleteCustomer(customerId: string) {
    return this.request(`/admin/customers/${customerId}`, { method: "DELETE" });
  }

  // Detail views
  async getRestaurantDetail(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/detail`);
  }

  async getRiderDetail(riderId: string) {
    return this.request(`/admin/riders/${riderId}/detail`);
  }

  // Refunds (record-only)
  async refundOrder(orderId: string, payload: { amount: number; reason?: string }) {
    return this.requestOnce(`/admin/orders/${orderId}/refund`, payload);
  }

  // Sent broadcast history
  async getNotificationsHistory() {
    return this.request(`/admin/notifications/history`);
  }

  // Reviews moderation
  async getReviews() {
    return this.request(`/admin/reviews`);
  }

  async deleteReview(reviewId: string) {
    return this.request(`/admin/reviews/${reviewId}`, { method: "DELETE" });
  }

  // Menu management (admin can edit any restaurant's menu)
  async toggleMenuItem(itemId: string) {
    return this.request(`/menu/${itemId}/toggle`, { method: "PUT" });
  }

  async updateMenuItem(itemId: string, payload: any) {
    return this.request(`/menu/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) });
  }

  // Full product management (admin acting on any store).
  async createProduct(restaurantId: string, payload: any) {
    return this.request(`/restaurants/${restaurantId}/menu`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteProduct(itemId: string) {
    return this.request(`/menu/${itemId}`, { method: "DELETE" });
  }

  async getProduct(itemId: string) {
    return this.request(`/menu/${itemId}`);
  }

  // Upload an image file (from the admin's device) to Supabase Storage and get
  // back a public URL. Uses multipart/form-data, so it bypasses the JSON
  // `request()` helper (the browser must set the multipart boundary itself).
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${this.base}/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  // Upload a video file (reuses the existing video upload endpoint).
  async uploadVideo(file: File): Promise<{ video_url: string; duration_seconds?: number }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${this.base}/restaurants/upload-video`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Video upload failed (${res.status})`);
    }
    return res.json();
  }

  async setProductImages(itemId: string, images: { url: string; position: number }[]) {
    return this.request(`/menu/${itemId}/images`, {
      method: "PUT",
      body: JSON.stringify({ images }),
    });
  }

  async setProductVariants(itemId: string, variants: any[]) {
    return this.request(`/menu/${itemId}/variants`, {
      method: "PUT",
      body: JSON.stringify({ variants }),
    });
  }

  async getCategoryTree(vendorType?: string) {
    const qs = vendorType ? `?vendor_type=${encodeURIComponent(vendorType)}` : "";
    return this.request(`/categories/tree${qs}`);
  }

  // ── Category editor (Categories page) ────────────────────────────────────
  // The ADMIN list, not /categories/tree: it includes hidden categories, which
  // the public tree filters out. Without them a category switched off could
  // never be switched back on from any screen.
  // version: "v2" = the new list, "v1" = the old one, left out = both.
  async getAdminCategories(version?: string) {
    const qs = version ? `?version=${encodeURIComponent(version)}` : "";
    return this.request(`/admin/categories${qs}`);
  }

  // The kinds of shop that can exist. Until the new list this lived only
  // inside the three apps' code, so it could not be changed without a release.
  async getAdminShopTypes() {
    return this.request(`/admin/shop-types`);
  }

  // Which kinds of shop may sell in one department. Sent as the WHOLE list
  // every time, so the screen never has to work out what to add and remove.
  async setCategoryShopTypes(categoryId: string, codes: string[]) {
    return this.request(`/admin/categories/${categoryId}/shop-types`, {
      method: "PUT",
      body: JSON.stringify({ codes }),
    });
  }

  async createCategory(payload: {
    name: string;
    name_ur?: string | null;
    parent_id?: string | null;
    slug?: string | null;
    icon?: string | null;
    vendor_type?: string | null;
    // "v2" puts the new row in the new list. Left out = the old list.
    taxonomy_version?: string | null;
    display_order?: number;
    is_active?: boolean;
  }) {
    return this.request(`/admin/categories`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Send ONLY the fields being changed. The server uses exclude_unset, so a key
  // that is present with the value null really does clear that column (that is
  // how a sub-category is moved back to the top level), while a key left out is
  // untouched. Spreading a whole row in here would rewrite every column.
  async updateCategory(categoryId: string, payload: Record<string, unknown>) {
    return this.request(`/admin/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // force=true is only ever sent after the server has already refused once and
  // the admin has read exactly what would be affected.
  async deleteCategory(categoryId: string, force = false) {
    const qs = force ? "?force=true" : "";
    return this.request(`/admin/categories/${categoryId}${qs}`, {
      method: "DELETE",
    });
  }

  // Restock helpers used by the Inventory screen.
  async updateProductStock(productId: string, stock: number) {
    return this.request(`/menu/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ stock }),
    });
  }

  async updateVariantStock(variantId: string, stockQuantity: number) {
    return this.request(`/variants/${variantId}`, {
      method: "PATCH",
      body: JSON.stringify({ stock_quantity: stockQuantity }),
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

  // Rider payouts
  async getRiderPayoutsReport() {
    return this.request(`/admin/riders/payouts`);
  }

  async getRiderPayoutHistory() {
    return this.request(`/admin/riders/payouts/history`);
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
}

// Create singleton instance
export const apiClient = new APIClient();
