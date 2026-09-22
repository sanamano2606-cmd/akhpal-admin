/**
 * Shops, their products, and the categories those products sit under.\n *\n * Approving and suspending a shop, editing its menu, adding products, uploading\n * pictures and videos, stock levels, and the category editor.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { APIClientOrders } from "./api-orders";
import { shrinkPictureForUpload, MAX_PICTURE_BYTES, pictureTooBigMessage }
  from "@/lib/picture-upload";
import { serverDetailText } from "./api-errors";
import type { FoundPlace } from "./shop-location";

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

  /** Find places by name for the "Shop location" search bar (Mock 85).
   *  Always answers {results: [...]}, empty when nothing matched. */
  async searchPlaces(q: string): Promise<{ results: FoundPlace[] }> {
    return this.request(`/geocode/search?q=${encodeURIComponent(q)}`);
  }

  // Create a vendor's shop(s) from the office — Mock 74 + Mock 75 (approved
  // 15–16 September 2026). One call can make:
  //   * a NEW vendor with one shop,
  //   * a NEW vendor with several shops (a mall: one shop per kind),
  //   * more shops for an EXISTING vendor (`existing_owner_id`).
  // Returns the shops made and, for a new login only, the password to share.
  async createStore(payload: CreateStorePayload) {
    return this.request(`/admin/stores`, {
      method: "POST",
      body: JSON.stringify(payload),
    }) as Promise<CreateStoreResult>;
  }

  // Find an existing vendor login by name or phone (at least 2 characters).
  async findVendors(text: string) {
    return this.request(
      `/admin/stores/vendors?q=${encodeURIComponent(text)}`
    ) as Promise<{ vendors: VendorMatch[] }>;
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

  // ── Bringing a vendor on board.  (Mock 109, 22 September 2026.) ──────────
  //
  // Three calls behind ONE permission, "Stores -> Add & edit shops". They show
  // an onboarder his own work; they grant nothing he could not already see,
  // and sending a shop for approval APPROVES NOTHING.

  /** Only the shops THIS admin created from the office, newest first. */
  async getMyIntakeShops() {
    return this.request(`/admin/vendor-intake/my-shops`);
  }

  /** The six checks for one shop, each with a sentence saying what is missing. */
  async getShopChecklist(restaurantId: string) {
    return this.request(`/admin/vendor-intake/shop/${restaurantId}`);
  }

  // ── Adding a whole catalogue.  (Mock 107 v2, 22 September 2026.) ─────────

  /** Every product name this shop already sells — so the office can be shown
   *  what will happen BEFORE anything is saved. The real refusal still happens
   *  on the server, where it cannot be stepped around. */
  async getShopProductNames(restaurantId: string) {
    return this.request(`/admin/vendor-intake/shop/${restaurantId}/product-names`);
  }

  /**
   * Read an Excel file into rows. It writes nothing.
   *
   * Multipart, so it goes past the JSON `request()` helper — the browser must
   * set the boundary itself. A .csv and a paste out of Excel never come here:
   * they are plain text and the panel reads them itself, instantly, without
   * waiting for a free-tier server to wake up.
   */
  async readSheetFile(file: File): Promise<{
    columns: string[]; rows: string[][]; total: number;
    truncated: boolean; max_rows: number;
  }> {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await fetch(`${this.base}/admin/vendor-intake/read-sheet`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(serverDetailText(e.detail)
        || `That sheet could not be read (${res.status})`);
    }
    return res.json();
  }

  /**
   * Write the products.
   *
   * The SAME door the vendor's own app uses, deliberately: it already refuses
   * a name the shop has and a name repeated inside one file, and one door that
   * writes products is far easier to keep right than two.
   *
   * It answers with the ids it made, which is what makes Undo possible.
   */
  async bulkImportProducts(restaurantId: string, csv: string): Promise<{
    created: number; created_ids: string[];
    failed: { row: number; error: string }[]; total: number;
  }> {
    return this.request(`/restaurants/${restaurantId}/menu/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
  }

  // ── Where Takal sends a vendor his money. (Mock 111, 22 Sep 2026.) ──────

  /**
   * Read this shop's payout details.
   *
   * The account number comes back MASKED — "0315 **** 0000" — unless the
   * person may see Payments → Balances. The masking happens on the server, so
   * the real number is never sent to a browser that may not show it.
   */
  async getPayoutDetails(restaurantId: string) {
    return this.request(`/admin/payout-details/${restaurantId}`);
  }

  /** Save where this shop's money goes. There is no CNIC field, on purpose. */
  async savePayoutDetails(restaurantId: string, details: {
    method: string; account_title: string; account_number: string;
    bank_name: string;
  }) {
    return this.request(`/admin/payout-details/${restaurantId}`, {
      method: "PUT",
      body: JSON.stringify(details),
    });
  }

  /** Take a whole upload back. The server refuses anything not in this shop,
   *  older than an hour, or already ordered. */
  async undoCatalogueUpload(restaurantId: string, productIds: string[]) {
    return this.request(
      `/admin/vendor-intake/shop/${restaurantId}/undo-upload`,
      { method: "POST", body: JSON.stringify({ product_ids: productIds }) },
    );
  }

  /**
   * Hand a finished shop to the Main Admin.
   *
   * The server refuses a shop that is not finished and names what is left.
   * That refusal is the whole value of the button, so there is deliberately no
   * "send anyway" here either.
   *
   * It is NOT cached and must never be: it changes something.
   */
  async submitShopForApproval(restaurantId: string) {
    return this.request(`/admin/vendor-intake/shop/${restaurantId}/submit`, {
      method: "POST",
    });
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
  //
  // THE PICTURE IS MADE SMALLER HERE, NOT ON EACH SCREEN. (21 September 2026.)
  // The three phone apps have done this since 9 September; the panel sent the
  // file exactly as it was, so a 12 MB shop photo took a minute to upload and
  // ended up stored at about 300 KB anyway. Putting it in this one function
  // means no screen can forget it, and a screen added next month gets it
  // without knowing it exists. See src/lib/picture-upload.ts.
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const small = await shrinkPictureForUpload(file);
    // ONE size limit in the whole panel, and it is the server's own. Checked
    // AFTER shrinking, because a 12 MB photo that becomes 300 KB is a picture
    // Takal is happy with - refusing it on its original size would be the old
    // wrong answer in a new place.
    if (small.size > MAX_PICTURE_BYTES) {
      throw new Error(pictureTooBigMessage(small.size));
    }
    const fd = new FormData();
    fd.append("file", small, small.name);
    const res = await fetch(`${this.base}/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(serverDetailText(e.detail) || `Upload failed (${res.status})`);
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
      throw new Error(serverDetailText(e.detail) || `Video upload failed (${res.status})`);
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
  // THE ONE CATALOGUE. Retired 4 September 2026: this used to take a
  // `version` — "v2" for the new list, "v1" for the one it replaced — because
  // the Catalogue screen had a New / Old toggle. The old list had 139
  // categories and not one of them was switched on, so customers had been
  // seeing only the new one for some time. The parameter is gone rather than
  // ignored: an argument nobody sends is a door the next reader assumes still
  // opens something. The server no longer accepts it either.
  async getAdminCategories() {
    return this.request(`/admin/categories`);
  }

  // Give the pictures uploaded before Plan 48 their missing small copy.
  // Safe to press twice: the server skips anything that already has one.
  async makeSmallPictureCopies() {
    return this.request(`/admin/pictures/make-small-copies`, { method: "POST" });
  }

  // The kinds of shop that can exist. Until the new list this lived only
  // inside the three apps' code, so it could not be changed without a release.
  async getAdminShopTypes() {
    return this.request(`/admin/shop-types`);
  }

  // The Urdu name of one kind of shop. ONLY the Urdu name: the delivery speed
  // decides whether a rider is sent and what the customer pays, and a screen
  // that can change a word and a price at once is a screen where the wrong
  // click costs money. (Audit finding P-9, Mock 33.)
  async setShopTypeUrduName(code: string, nameUr: string | null) {
    return this.request(`/admin/shop-types/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ name_ur: nameUr }),
    });
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

/** One shop in the "Create store" form. */
export interface CreateStoreShop {
  store_name: string;
  vendor_type: string;
  /** Restaurants only — the same list as the vendor app. */
  cuisine_type?: string;
}

export interface CreateStorePayload {
  /** Add the shops to this vendor instead of making a new login. */
  existing_owner_id?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  /** Blank = the server makes one. */
  password?: string;
  shops: CreateStoreShop[];
  address: string;
  description?: string;
  // WHERE THE SHOP IS. Compulsory since Plan 45 (9 September 2026).
  latitude: number;
  longitude: number;
  minimum_order?: number;
  opening_time?: string;
  closing_time?: string;
  image_url?: string;
  /** Mock 74: "Open for orders straight away". Off = Closed. */
  open_now?: boolean;
}

export interface CreateStoreResult {
  message: string;
  store_id: string;
  stores: { id: string; name: string; vendor_type: string; cuisine_type?: string | null }[];
  owner_id: string;
  owner_name: string;
  new_login: boolean;
  is_open: boolean;
  credentials: { phone: string; email: string | null; password: string | null };
}

export interface VendorMatch {
  id: string;
  full_name: string;
  phone: string;
  is_suspended: boolean;
  shops: { id: string; name: string; vendor_type: string }[];
}
