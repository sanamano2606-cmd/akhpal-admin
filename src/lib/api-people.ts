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
  // ─── The Support Inbox ────────────────────────────────────────────────
  // Plan 52, 10 September 2026. Lives in api-people because a support
  // conversation is a person talking, not an order or a shop.

  /** The support list. Waiting for a reply first, then newest. */
  async getSupportThreads(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/support/threads?${params}`);
  }

  /** One conversation, everything said in it, and who it is from. */
  async getSupportThread(threadId: string) {
    return this.request(`/admin/support/threads/${threadId}`);
  }

  /** Reply to a customer. The server pushes it to their phone. */
  async replySupport(
    threadId: string,
    body: string,
    imageUrl?: string,
    replyToId?: string,
  ) {
    return this.request(`/admin/support/threads/${threadId}/reply`, {
      method: "POST",
      body: JSON.stringify({
        body,
        image_url: imageUrl || null,
        reply_to_id: replyToId || null,
      }),
    });
  }

  /**
   * Take back one of Takal's own replies.
   *
   * Plan 55, Mock 55. The server decides, not the panel: Takal's own side
   * only, within five minutes, and once. It refuses in a plain sentence,
   * which is what the screen shows — there is no second copy of the rule here.
   */
  async unsendSupportMessage(messageId: string) {
    return this.request(`/admin/support/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  /** Mark a conversation finished. The customer can still write again. */
  async closeSupportThread(threadId: string) {
    return this.request(`/admin/support/threads/${threadId}/close`, {
      method: "PUT",
    });
  }

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

  /**
   * LET A LOCKED-OUT ADMIN BACK IN.  (Mock 110, 22 September 2026.)
   *
   * Main Admin only - refused on the server three times over, not merely
   * hidden here. It refuses your OWN account too: your own password is changed
   * through changeMyPassword below, where the current one is required.
   *
   * The new password is sent, never received. The server answers with a
   * message and nothing else; the only plain copy that ever exists is the one
   * already on this screen. Handing it back would put it in one more log, one
   * more cache and one more browser history entry for no gain.
   *
   * The account is marked so the panel makes them choose their own on their
   * very next sign-in, and every device they were signed in on is signed out.
   */
  async resetAdminPassword(userId: string, newPassword: string) {
    return this.request(`/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  /**
   * Change YOUR OWN password. Not anybody else's - there is no door for that
   * here, and there should not be.
   *
   * The server checks the current password, holds admins to ten characters,
   * locks the account for fifteen minutes after five wrong tries, writes every
   * wrong try to the Audit Log, and signs every other device out. None of that
   * is repeated in the browser, where it could be stepped around; the browser
   * only says the two new ones match before it bothers the server.
   *
   * It hands back a FRESH TOKEN, because changing the password revokes the one
   * this tab is holding. Storing it is what keeps the person signed in where
   * they are standing instead of being thrown back to the login page for doing
   * the right thing.
   */
  async changeMyPassword(currentPassword: string, newPassword: string) {
    const out: any = await this.request(`/auth/change-password`, {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (out && out.token) {
      try {
        localStorage.setItem("admin_token", out.token);
      } catch {
        /* A browser with storage switched off. The password IS changed; this
           tab will simply be asked to sign in again on its next call, which
           is the safe way for this to fail. */
      }
    }
    return out;
  }

  // ── Reviews moderation ────────────────────────────────────────────────
  //
  // Rebuilt 13 September 2026. `getReviews()` used to take nothing and hand
  // back the last 200 rows; it now asks WHICH opinion (shop, rider or Takal)
  // and WHICH state, because one delivered order carries all three and the
  // panel has a tab for each.
  //
  // The old call still works: both arguments have defaults.
  async getReviews(opts?: { kind?: string; status?: string }) {
    const kind = opts?.kind || "shop";
    const status = opts?.status || "all";
    return this.request(`/admin/reviews?kind=${encodeURIComponent(kind)}&status=${encodeURIComponent(status)}`);
  }

  /** Every rider's star average and how many 1-2 star ratings they have. */
  async getRiderReviewScores() {
    return this.request(`/admin/reviews/rider-scores`);
  }

  /** Approve, hide, or put a review back in the waiting list. */
  async setReviewStatus(reviewId: string, status: "waiting" | "published" | "hidden") {
    return this.request(`/admin/reviews/${reviewId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  async deleteReview(reviewId: string) {
    return this.request(`/admin/reviews/${reviewId}`, { method: "DELETE" });
  }

  // Reviews left on ONE product. These are the ones that carry photographs,
  // and until this date no screen in the panel could see them at all.
  async getProductReviews(opts?: { status?: string }) {
    const status = opts?.status || "all";
    return this.request(`/admin/product-reviews?status=${encodeURIComponent(status)}`);
  }

  async setProductReviewStatus(reviewId: string, status: "waiting" | "published" | "hidden") {
    return this.request(`/admin/product-reviews/${reviewId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  async deleteProductReview(reviewId: string) {
    return this.request(`/admin/product-reviews/${reviewId}`, { method: "DELETE" });
  }

  // QUESTIONS ABOUT A PRODUCT (Mock 93, 17 September 2026). Every question a
  // customer asks reaches the shop AND this panel; whoever answers first, the
  // customer is told.
  async getProductQuestions(opts?: { status?: string; limit?: number; offset?: number }) {
    const status = opts?.status || "waiting";
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    return this.request(
      `/admin/product-questions?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`,
    );
  }

  async answerProductQuestion(questionId: string, answer: string) {
    return this.request(`/admin/product-questions/${questionId}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
  }

  async setProductQuestionHidden(questionId: string, hidden: boolean) {
    return this.request(
      `/admin/product-questions/${questionId}/${hidden ? "hide" : "show"}`,
      { method: "POST" },
    );
  }

  // The three switches on Reviews -> Settings.
  async getReviewSettings() {
    return this.request(`/admin/reviews/settings`);
  }

  async updateReviewSettings(patch: Record<string, unknown>) {
    return this.request(`/admin/reviews/settings`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  }
}
