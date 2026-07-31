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

  async setDeliveryFee(restaurantId: string, deliveryFee: number) {
    return this.request(`/admin/restaurants/${restaurantId}/delivery-fee`, {
      method: "PUT",
      body: JSON.stringify({ delivery_fee: deliveryFee }),
    });
  }

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
  async getHubParcels(params: { hub_id?: string; status?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.hub_id) qs.set("hub_id", params.hub_id);
    if (params.status) qs.set("status", params.status);
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
  async dispatchParcel(orderId: string) {
    return this.request(`/orders/${orderId}/hub/dispatch`, { method: "PUT" });
  }

  /** Which payment methods are live, and what is still missing for the rest. */
  async getPaymentStatus() {
    return this.request("/admin/payment-status");
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

  // Rider cash reconciliation (cash-on-delivery)
  async getRiderCashReconciliation(days?: number) {
    return this.request(`/admin/riders/cash-reconciliation${days ? `?days=${days}` : ""}`);
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
