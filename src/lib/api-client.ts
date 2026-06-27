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
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

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
    return this.request(`/admin/restaurants/${restaurantId}/commission`, {
      method: "PUT",
      body: JSON.stringify({ commission_percentage: commission }),
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
}

// Create singleton instance
export const apiClient = new APIClient();
