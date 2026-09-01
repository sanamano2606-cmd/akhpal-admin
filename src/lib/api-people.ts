/**
 * Everybody with a login: riders, customers and admin staff.\n *\n * Approving a rider, suspending one, the customer list and one customer's full\n * history, admin accounts and their permissions, and removing a bad review.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientStores } from "./api-stores";

export class APIClientPeople extends APIClientStores {

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

  async getRiderDetail(riderId: string) {
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

  // Current admin profile (role + permissions)
  async getMe() {
    return this.request(`/admin/me`);
  }

  // Reviews moderation
  async getReviews() {
    return this.request(`/admin/reviews`);
  }

  async deleteReview(reviewId: string) {
    return this.request(`/admin/reviews/${reviewId}`, { method: "DELETE" });
  }
}
