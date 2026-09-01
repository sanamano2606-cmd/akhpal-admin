/**
 * Shops, their products, and the categories those products sit under.\n *\n * Approving and suspending a shop, editing its menu, adding products, uploading\n * pictures and videos, stock levels, and the category editor.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientOrders } from "./api-orders";

export class APIClientStores extends APIClientOrders {

  // Restaurants
  async getRestaurants(filters: any = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/restaurants?${params}`);
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

  // Detail views
  async getRestaurantDetail(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/detail`);
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
}
