/**
 * Everybody with a login: riders, customers and admin staff.\n *\n * Approving a rider, suspending one, the customer list and one customer's full\n * history, admin accounts and their permissions, and removing a bad review.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientStores } from "./api-stores";

export class APIClientPeople extends APIClientStores {

  /** Set the delivery fee for ONE shop, or clear it back to the standard rule.
   *
   *  Mock 30, approved 5 September 2026 (audit finding P-7).
   *
   *  This method existed once, was removed because the address did not exist,
   *  and is back because the address now does — and, more to the point, because
   *  the fee it sets is now actually charged.
   *
   *  Pass a number for a flat fee this shop charges at any distance, or `null`
   *  to put it back on the rule in Settings (base + per km, capped).
   *
   *  `0` is a real answer, meaning free delivery from this shop. Only `null`
   *  means "use the rule", which is why the argument is `number | null` and not
   *  a falsy check.
   *
   *  The "set the same fee for every shop" route it used to point at is gone.
   *  It overwrote a column that no order ever charged from, reported success,
   *  and moved no price — and it could have changed every price on the platform
   *  with one request. */
  async setShopDeliveryFee(restaurantId: string, fee: number | null) {
    return this.request(`/admin/restaurants/${restaurantId}/delivery-fee`, {
      method: "PATCH",
      body: JSON.stringify({ delivery_fee: fee }),
    });
  }

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
