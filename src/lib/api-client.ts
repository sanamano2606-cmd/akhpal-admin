/**
 * API Client for Admin Panel
 * Handles all communication with backend API
 */

export class APIClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = typeof window !== "undefined"
      ? localStorage.getItem("api_url") || "https://swat-delivery-api.onrender.com"
      : "https://swat-delivery-api.onrender.com";
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
    return (typeof window !== "undefined" ? localStorage.getItem("api_url") : "") || this.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}, attempt = 0): Promise<T> {
    const url = `${this.base}${path}`;
    // The free backend sleeps after inactivity and takes ~50s to wake, during
    // which it can refuse the connection or return a gateway error. Wait it out
    // with several retries (up to ~55s) instead of giving up in a few seconds.
    const MAX_ATTEMPTS = 12;
    const WAIT_MS = 5000;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
        return this.request<T>(path, options, attempt + 1);
      }
      throw new Error("Can't reach the server. Check your connection and try again.");
    }

    // 502/503/504 = the server is still waking or restarting — retry, don't fail.
    if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, WAIT_MS));
      return this.request<T>(path, options, attempt + 1);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
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
    return this.request(`/admin/returns/${orderId}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? null, amount: amount ?? null }),
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
    return this.request(`/admin/riders/payouts/record`, {
      method: "POST",
      body: JSON.stringify({ rider_id: riderId, amount, method }),
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
    return this.request(`/admin/orders/${orderId}/refund`, { method: "POST", body: JSON.stringify(payload) });
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
    return this.request(`/admin/riders/cash-handovers/record`, { method: "POST", body: JSON.stringify(payload) });
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
    return this.request("/admin/payouts/record", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

// Create singleton instance
export const apiClient = new APIClient();
