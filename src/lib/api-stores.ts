/**
 * Shops, their products, and the categories those products sit under.\n *\n * Approving and suspending a shop, editing its menu, adding products, uploading\n * pictures and videos, stock levels, and the category editor.
 *
 * Split out of api-client.ts on 2026-08-30. Not one line of any call changed.
 * Each of these files adds its calls by extending the one before it, so
 * `apiClient.getOrders()` still means exactly what it always did.
 */
import { signedInAsStaff } from "./staff-sign-in";
import { APIClientOrders } from "./api-orders";
import { shrinkPictureForUpload, MAX_PICTURE_BYTES, pictureTooBigMessage }
  from "@/lib/picture-upload";
import { serverDetailText } from "./api-errors";
import type { FoundPlace } from "./shop-location";
import type { NameEntry } from "./picture-match";
import type { PriceChangeRow, StorePrices } from "./fixed-prices";
import type { TidyCheck, TidyDone } from "./tidy-removed";
import type { ShopReviewPage, ReviewMark, SendBackAnswer } from "./shop-review";
import type { ShopLicence } from "./shop-licence";

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

  /** Approve a shop. The server needs 5 products first (Mock 165, Sana
   *  6 Oct 2026); `anyway` is the main admin's "Approve anyway", sent only
   *  from the window that asks first. A sub-admin's is refused by the server. */
  async approveRestaurant(restaurantId: string, anyway = false) {
    return this.request(
      `/admin/restaurants/${restaurantId}/approve${anyway ? "?anyway=true" : ""}`,
      { method: "PUT" },
    );
  }

  /** Reject, WITH the reason the owner is told (Mock 161, admin audit M14).
   *  The server refuses a reject without one. */
  async rejectRestaurant(restaurantId: string, reason: string) {
    return this.request(`/admin/restaurants/${restaurantId}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  }

  async suspendRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/suspend`, {
      method: "PUT",
    });
  }

  /** REMOVE FOR GOOD (Stores page fix 1, Sana 12 Oct 2026). Main Admin only,
   *  a REJECTED shop with no orders and no reviews; the server keeps a full
   *  copy in the office record first. It cannot be undone. */
  async removeRestaurantForGood(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/remove-for-good`, {
      method: "POST",
    });
  }

  async unsuspendRestaurant(restaurantId: string) {
    return this.request(`/admin/restaurants/${restaurantId}/unsuspend`, {
      method: "PUT",
    });
  }

  /** Set a shop's own commission rate, or CLEAR it so the shop falls back to
   *  the global rate set in Settings.
   *
   *  Pass a number to charge that rate. Pass null to clear it: the backend
   *  (PUT /admin/restaurants/{id}/commission) treats a MISSING percent as
   *  "clear the override", and writes NULL to the column. Sending
   *  `?percent=0` is a different thing entirely - it charges the shop nothing
   *  - so the null case must send no percent at all. */
  async setRestaurantCommission(restaurantId: string, commission: number | null) {
    // Backend expects the value as a query param (?percent=), not a JSON body.
    const path = commission === null
      ? `/admin/restaurants/${restaurantId}/commission`
      : `/admin/restaurants/${restaurantId}/commission?percent=${commission}`;
    return this.request(path, { method: "PUT" });
  }

  // ── Managing a store the way its owner would ──────────────────────────────
  // These all hit the same endpoints the vendor app uses. The backend already
  // lets an admin through (`_assert_owns_restaurant` returns early for the
  // admin role), so nothing new was needed server-side.

  /** Just a shop's name, for a heading (Stores page fix 13). The shop's own
   *  page data, which admins and the shop's own people may read even while it
   *  waits for approval. A failure is the caller's to ignore. */
  async getShopName(restaurantId: string): Promise<string> {
    const r = (await this.request(`/restaurants/${encodeURIComponent(restaurantId)}`)) as any;
    return String(r?.name || "");
  }

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

  /** EVERY shop waiting for approval, each with its seven checks and how many
   *  days it has waited (Stores page fix 2, 12 Oct 2026). Not only the shops
   *  this admin created - a Partners-app sign-up too. */
  async getWaitingChecklists() {
    return this.request(`/admin/vendor-intake/waiting`);
  }

  /** The seven checks for one shop, each with a sentence saying what is missing. */
  async getShopChecklist(restaurantId: string) {
    return this.request(`/admin/vendor-intake/shop/${restaurantId}`);
  }

  // ── MOCK 207 (Sana 23 Oct 2026): review a new shop, send it back for
  //    changes, and switch an approved shop on for customers. ─────────────

  /** Everything about one waiting shop on one page, with what the reviewer
   *  ticked. Products come 60 at a time. */
  async getShopReview(restaurantId: string, page = 1): Promise<ShopReviewPage> {
    return this.request(`/admin/restaurants/${restaurantId}/review?page=${page}`);
  }

  /** Save the reviewer's OK / Needs fix ticks (so a refresh keeps them). */
  async saveShopReviewMarks(restaurantId: string, marks: Record<string, ReviewMark>) {
    return this.request(`/admin/restaurants/${restaurantId}/review-marks`, {
      method: "PUT",
      body: JSON.stringify({ marks }),
    });
  }

  /** "Send back for changes": the shop stays waiting; its vendor is told. */
  async sendShopBack(restaurantId: string,
                     fixes: { key: string; reason: string; words?: string }[]): Promise<SendBackAnswer> {
    return this.request(`/admin/restaurants/${restaurantId}/send-back`, {
      method: "POST",
      body: JSON.stringify({ fixes }),
    });
  }

  // ── MOCK 208-4 (Sana 26 Oct 2026): a pharmacy's licence. ──────────────

  /** A pharmacy's licence: number, valid-until, its state, and a 10-minute
   *  link to the photo (the photo itself stays private). */
  async getShopLicence(restaurantId: string): Promise<ShopLicence> {
    return this.request(`/admin/restaurants/${restaurantId}/licence`);
  }

  /** Add or correct a pharmacy's licence. `ok` = the office has looked at the
   *  real licence (needs "Approve shops"); saved without it, any old OK goes. */
  async saveShopLicence(restaurantId: string,
                        body: { number: string; valid_until: string; photo?: string; ok: boolean }) {
    return this.request(`/admin/restaurants/${restaurantId}/licence`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  /** Send a photo of a licence. It goes into a PRIVATE store; the answer is
   *  only where it is kept, to send with the shop. Never a public picture. */
  async uploadLicencePhoto(file: File): Promise<{ licence_photo: string }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const small = await shrinkPictureForUpload(file);
    if (small.size > MAX_PICTURE_BYTES) {
      throw new Error(pictureTooBigMessage(small.size));
    }
    const fd = new FormData();
    fd.append("file", small, small.name);
    const res = await fetch(`${this.base}/licences/photo`, {
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

  /** "Show to customers" ON or OFF - the Main Admin only (the server checks). */
  async setShownToCustomers(restaurantId: string, show: boolean) {
    return this.request(`/admin/restaurants/${restaurantId}/customers-see`, {
      method: "PUT",
      body: JSON.stringify({ show }),
    });
  }

  // ── Adding a whole catalogue.  (Mock 107 v2, 22 September 2026.) ─────────

  /** Every product name this shop already sells — so the office can be shown
   *  what will happen BEFORE anything is saved. The real refusal still happens
   *  on the server, where it cannot be stepped around. */
  async getShopProductNames(restaurantId: string) {
    // A Mall's own staff use the shop-side door (Sana: "Yes Catalogue",
    // 1 Oct 2026) - every /admin door refuses them. Same answer, same code.
    return this.request(signedInAsStaff()
      ? `/restaurants/${encodeURIComponent(restaurantId)}/catalogue/product-names`
      : `/admin/vendor-intake/shop/${restaurantId}/product-names`);
  }

  /**
   * Read an Excel file into rows. It writes nothing.
   *
   * Multipart, so it goes past the JSON `request()` helper — the browser must
   * set the boundary itself. A .csv and a paste out of Excel never come here:
   * they are plain text and the panel reads them itself, instantly, without
   * waiting for a free-tier server to wake up.
   */
  async readSheetFile(file: File, restaurantId?: string): Promise<{
    columns: string[]; rows: string[][]; total: number;
    truncated: boolean; max_rows: number;
  }> {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file, file.name);
    // Mall staff read the sheet through THEIR shop's door (needs the shop id).
    const path = signedInAsStaff() && restaurantId
      ? `/restaurants/${encodeURIComponent(restaurantId)}/catalogue/read-sheet`
      : `/admin/vendor-intake/read-sheet`;
    const res = await fetch(`${this.base}${path}`, {
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
    // ── ADDED 27 SEPTEMBER 2026 ──────────────────────────────────────────
    // All optional, because a panel deployed before the server is is a real
    // situation and must not break on a key that is not there yet.
    //
    // `nothing_was_added` is the one that matters: the server now checks the
    // WHOLE file before writing anything, so one bad row means the shop is
    // untouched. "0 added" on its own does not say that, and a vendor reading
    // it wonders whether half went in.
    nothing_was_added?: boolean;
    rows_read?: number;
    rows_ready?: number;
    // Rows this shop already had. NOT faults - he re-uploaded his whole sheet
    // after fixing one row, which is the obvious thing to do. They are inside
    // `failed` as well (every older screen reads that key), and sent again
    // here on their own so a screen never has to recognise them by matching
    // the sentence "is already in this shop".
    already_there?: number;
    already_there_rows?: { row: number; error: string }[];
    // Pictures that live on somebody else's website and are being fetched,
    // shrunk and stored as Takal's own, in the background.
    pictures_queued?: number;
    message?: string;
  }> {
    return this.request(`/restaurants/${restaurantId}/menu/bulk-import`, {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
  }

  /**
   * How the catalogue's picture fetching is going for this shop.
   *
   * The products went in at once and are already selling; the pictures arrive
   * behind them. This is what the screen asks every few seconds so it can say
   * "1,240 of 5,000" instead of "please wait".
   *
   * It also returns the FAILURES with a reason for each. "12 pictures could
   * not be fetched" is not useful; "12 could not be fetched and here they are
   * with why" is something a vendor can act on.
   */
  async getCataloguePictureProgress(restaurantId: string): Promise<{
    waiting: number; working: number; done: number; failed: number;
    total: number; still_going: boolean; could_not_be_read?: boolean;
    failures: { product_id: string; source_url: string; last_error: string }[];
  }> {
    return this.request(`/restaurants/${restaurantId}/pictures-progress`);
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
      signedInAsStaff()
        ? `/restaurants/${encodeURIComponent(restaurantId)}/catalogue/undo-upload`
        : `/admin/vendor-intake/shop/${restaurantId}/undo-upload`,
      { method: "POST", body: JSON.stringify({ product_ids: productIds }) },
    );
  }

  // ── A WHOLE CATALOGUE: big lists, every option, stock, safe prices ───────
  // (Mock 184, Sana 13 Oct 2026.) The shop-side doors, for the office AND a
  // Mall's staff alike - the server asks whose shop it is on every one. The
  // reading of the list is the SERVER's (catalogue_engine.py), the same as
  // the Partners app's, so the panel and the phone can never disagree.

  /** An .xlsx or .csv into rows - up to 20,000. Writes nothing. */
  async catalogueReadSheet(file: File, restaurantId: string): Promise<{
    columns: string[]; rows: string[][]; total: number; truncated: boolean; max_rows: number;
  }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file, file.name);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(
        `${this.base}/restaurants/${encodeURIComponent(restaurantId)}/catalogue/read-sheet`,
        { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
          signal: controller.signal });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(serverDetailText(e.detail) || `That sheet could not be read (${res.status})`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  protected catalogueDoor(restaurantId: string, what: string) {
    return `/restaurants/${encodeURIComponent(restaurantId)}/catalogue/${what}`;
  }

  /** His headings -> what Takal uses each one for (every guess can be changed). */
  async catalogueColumns(restaurantId: string, columns: string[], rows: string[][]) {
    return this.request<{ mapping: string[]; notes: string[]; roles: { key: string; label: string }[];
      examples: string[] }>(this.catalogueDoor(restaurantId, "columns"), {
      method: "POST", body: JSON.stringify({ columns, rows: rows.slice(0, 50) }), timeoutMs: 60000,
    });
  }

  /** Every category word once, with a suggested Takal sub-category. */
  async catalogueWords(restaurantId: string, columns: string[], rows: string[][], mapping: string[]) {
    return this.request<{ words: any[]; leaves: any[]; food_shop: boolean; needs_category: boolean }>(
      this.catalogueDoor(restaurantId, "words"), {
        method: "POST", body: JSON.stringify({ columns, rows, mapping }), timeoutMs: 120000,
      });
  }

  /** Remember "Tablet" -> Over the Counter for the next list. */
  async catalogueRememberWords(restaurantId: string, words: Record<string, string>) {
    return this.request(this.catalogueDoor(restaurantId, "remember-words"), {
      method: "POST", body: JSON.stringify({ words }), timeoutMs: 60000,
    });
  }

  /** Every row checked, nothing written. Slow by nature on 15,000 rows. */
  async catalogueCheck(restaurantId: string, body: {
    columns: string[]; rows: string[][]; mapping: string[]; mode: "add" | "update";
    words: Record<string, string>;
  }) {
    return this.request<any>(this.catalogueDoor(restaurantId, "check"), {
      // loss_rows "warn": a buying price above the selling price is shown as
      // a LOSS to confirm, not a row to fix (Mock 186).
      method: "POST", body: JSON.stringify({ ...body, include_products: true, loss_rows: "warn" }), timeoutMs: 180000,
    });
  }

  /** ONE part, saved in one transaction. Never resent by itself (a POST): the
   *  page offers "Save again", which is safe - nothing is added twice. */
  async catalogueSavePart(restaurantId: string, mode: "add" | "update", products: unknown[],
    confirmLoss = false) {
    // confirm_loss is ALWAYS sent (Mock 186): false = the server checks for a
    // loss again and refuses one (409, detail.losses); true = a person ticked
    // "I know these sell at a loss".
    return this.request<any>(this.catalogueDoor(restaurantId, "save-part"), {
      method: "POST", body: JSON.stringify({ mode, products, confirm_loss: confirmLoss }), timeoutMs: 120000,
    });
  }

  /** Take a whole upload back - up to 20,000 products in one call. */
  async catalogueUndo(restaurantId: string, productIds: string[]) {
    return this.request<{ removed: number; kept: string[]; message: string }>(
      this.catalogueDoor(restaurantId, "undo"), {
        method: "POST", body: JSON.stringify({ product_ids: productIds }), timeoutMs: 120000,
      });
  }

  /** The rows to fix as an Excel file, in his own columns plus "What to fix". */
  async catalogueFixFile(restaurantId: string, columns: string[], rows: string[][],
                         problems: { row: number; error: string }[]): Promise<Blob> {
    const res = await fetch(`${this.base}${this.catalogueDoor(restaurantId, "fix-file")}`, {
      method: "POST", headers: this.getHeaders(),
      body: JSON.stringify({ columns, rows, problems }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(serverDetailText(e.detail) || `The file could not be made (${res.status})`);
    }
    return res.blob();
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
  /** Switch a product on or off. `wanted` is the state the person asked
   *  for and is SENT (audit 203, A9): the server sets exactly that, so two
   *  quick clicks, or a list that is a minute old, can never end on the
   *  opposite of what was shown. */
  async toggleMenuItem(itemId: string, wanted?: boolean) {
    return this.request(`/menu/${itemId}/toggle`, wanted === undefined
      ? { method: "PUT" }
      : { method: "PUT", body: JSON.stringify({ is_available: wanted }) });
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

  /** One product. `fresh` asks the server itself, never the panel's saved
   *  copy of an earlier answer (up to a minute old) - the editor needs what
   *  the product is NOW, because Save sends only what differs from it. */
  async getProduct(itemId: string, opts: { fresh?: boolean } = {}) {
    return this.request(`/menu/${itemId}${opts.fresh ? `?fresh=${Date.now()}` : ""}`);
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
      const err = new Error(serverDetailText(e.detail) || `Upload failed (${res.status})`);
      // The status travels with the error, so "Many pictures" can tell "the
      // server says slow down" (429) from a picture it refused.
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }

  // Upload a video file (reuses the existing video upload endpoint).
  // A PRODUCT video by default: 15 seconds and 10 MB at most (19 Oct 2026).
  // The welcome screen's video says purpose "welcome" and keeps 100 MB.
  async uploadVideo(file: File, purpose: "product" | "welcome" = "product"): Promise<{ video_url: string; duration_seconds?: number; file_size_mb?: number }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${this.base}/restaurants/upload-video?purpose=${purpose}`, {
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

  // ── A SHOP'S PRODUCTS, ONE PAGE AT A TIME.  (Mock 132, 30 September 2026.)
  //
  // The store page used to take its products from getRestaurantDetail, which
  // stopped at 100 - Cupbar.cafe had 61 products nobody could reach. This asks
  // the server for one page, with the search, the filter button and the
  // category, and gets back the number for every filter button as well.
  // Server: routers/shop_products.py.
  async getShopProducts(
    restaurantId: string,
    opts: {
      page?: number;
      perPage?: number;
      search?: string;
      show?: ShopProductShow;
      categoryId?: string;
    } = {},
  ): Promise<ShopProductsPage> {
    const p = new URLSearchParams();
    p.set("page", String(opts.page ?? 1));
    p.set("per_page", String(opts.perPage ?? 50));
    if (opts.search && opts.search.trim()) p.set("search", opts.search.trim());
    if (opts.show && opts.show !== "all") p.set("show", opts.show);
    if (opts.categoryId) p.set("category_id", opts.categoryId);
    return this.request(
      `/restaurants/${encodeURIComponent(restaurantId)}/products/manage?${p.toString()}`,
    ) as Promise<ShopProductsPage>;
  }

  /** Move a product to another store of the SAME mall (Step 3d door, Step 5
   *  screen, Mock 172-5). Its pictures, sizes, extras and stock go with it.
   *  `categoryId` = its category in the new store (left out = it keeps its
   *  own). Refused by the server across malls, across price kinds, or while
   *  it is in an order that is not finished - the words say which. */
  async moveProductToStore(fromStoreId: string, productId: string, toStoreId: string, categoryId?: string | null) {
    return this.request(
      `/restaurants/${encodeURIComponent(fromStoreId)}/products/${encodeURIComponent(productId)}/move`,
      {
        method: "POST",
        body: JSON.stringify({ to_restaurant_id: toStoreId, ...(categoryId ? { category_id: categoryId } : {}) }),
      },
    ) as Promise<{ message: string; product_id: string; restaurant_id: string }>;
  }

  /** Every live product's id, name and "has a picture" - for matching a
   *  folder of photos by file name (Mock 132 step 4). Server:
   *  routers/shop_products.py, shop_product_names. */
  // NOT getShopProductNames - that name is the catalogue page's own call
  // (/admin/vendor-intake/.../product-names). Same name twice in one class
  // and the later one silently replaces the earlier one.
  async getProductsForPictures(restaurantId: string): Promise<{ total: number; items: NameEntry[] }> {
    // `fresh` makes the address new each time, so the panel's saved copy of an
    // earlier answer is never used: a product that got its picture a minute
    // ago must not be offered again as "no picture".
    return this.request(
      `/restaurants/${encodeURIComponent(restaurantId)}/products/names?fresh=${Date.now()}`,
    ) as Promise<{ total: number; items: NameEntry[] }>;
  }

  /** The live kinds of shop - the PUBLIC door the phone apps use (no
   *  sign-in needed). The Mall staff Shop panel asks this one, never
   *  /admin/shop-types, which refuses them. */
  async getPublicShopTypes() {
    return this.request(`/shop-types`);
  }

  /** A shop's OWN money, as the shop sees it (GET /restaurants/{id}/earnings -
   *  the Partners app's Earnings tab reads the same door). Used by the Mall
   *  staff Shop panel, view only (Mock 133). The server also sends Takal's
   *  commission; the type below leaves it out ON PURPOSE so no staff screen
   *  can show it by accident - commission belongs to Takal (Sana, 30 Sep). */
  async getShopEarnings(restaurantId: string): Promise<ShopEarnings> {
    return this.request(
      `/restaurants/${encodeURIComponent(restaurantId)}/earnings`,
    ) as Promise<ShopEarnings>;
  }

  /** ONE thing done to up to 100 of a shop's products (Mock 132 step 3).
   *  On/Off SET the state, they never flip it. The server checks every id
   *  belongs to this shop and reports the ones that do not. */
  async bulkChangeProducts(
    restaurantId: string,
    ids: string[],
    action: BulkProductAction,
    value?: number | string,
  ): Promise<BulkProductResult> {
    return this.request(`/restaurants/${encodeURIComponent(restaurantId)}/products/bulk`, {
      method: "POST",
      body: JSON.stringify(value === undefined ? { ids, action } : { ids, action, value }),
    }) as Promise<BulkProductResult>;
  }

  /** ADD one photo to a product, leaving its other photos exactly as they
   *  are. setProductImages REPLACES the whole list, which is right for the
   *  editor and wrong for the one-click picture square. */
  async addProductPhoto(itemId: string, url: string, position: number) {
    return this.request(`/menu/${itemId}/images`, {
      method: "POST",
      body: JSON.stringify({ url, position }),
    });
  }

  /** Every size, colour and extra of ONE product - switched-off ones too, at
   *  the shop's own prices (an admin or the shop is the "owner" here).
   *  Edit in the list, Step 5a. Server: routers/variants.py list_variants. */
  async getProductVariants(itemId: string, opts: { fresh?: boolean } = {}): Promise<{ variants: ProductOptionRow[] }> {
    return this.request(
      `/menu/${encodeURIComponent(itemId)}/variants?include_unavailable=true${opts.fresh ? `&fresh=${Date.now()}` : ""}`,
    ) as Promise<{ variants: ProductOptionRow[] }>;
  }

  /** Change ONE size / colour / extra: its price, its stock or on/off. The
   *  other options of the product are not touched (unlike setProductVariants,
   *  which replaces them all). Server: routers/variants.py update_variant. */
  async updateVariant(
    variantId: string,
    payload: { price_override?: number; stock_quantity?: number; is_available?: boolean },
  ): Promise<{ variant: ProductOptionRow | null }> {
    return this.request(`/variants/${encodeURIComponent(variantId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }) as Promise<{ variant: ProductOptionRow | null }>;
  }

  // ── FIXED-PRICE STORES (plan Steps 5b-5c, Mock 171). Server:
  //    routers/fixed_prices.py. Reading needs "Add & edit shops"; changing
  //    needs "Store prices" (app_guard.py).

  /** Every product, size and extra with its buying and selling price and what
   *  Takal earns, with the red flags. */
  async getStorePrices(restaurantId: string): Promise<StorePrices> {
    return this.request(`/admin/restaurants/${encodeURIComponent(restaurantId)}/prices`) as Promise<StorePrices>;
  }

  /** MOCK 203-1 v2: products of EVERY store matching the words, with their
   *  store - or the ones with no picture yet (`show: "no_picture"`). */
  async findProductsInEveryStore(search: string, show: "all" | "no_picture" = "all", limit = 20) {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (show !== "all") p.set("show", show);
    p.set("limit", String(limit));
    return this.request(`/admin/stores/find-products?${p.toString()}`) as Promise<{ items: FoundProduct[]; total: number | null }>;
  }

  /** MOCK 203-1 v2: how many products of each store still need a picture. */
  async getNoPictureCounts(storeIds: string[]) {
    return this.request(`/admin/stores/no-picture-counts?ids=${storeIds.map(encodeURIComponent).join(",")}`) as
      Promise<{ counts: Record<string, number | null> }>;
  }

  /** Who changed which price, when, from what to what. */
  async getPriceHistory(restaurantId: string, productId?: string): Promise<{ changes: PriceChangeRow[] }> {
    const qs = productId ? `?product_id=${encodeURIComponent(productId)}` : "";
    return this.request(
      `/admin/restaurants/${encodeURIComponent(restaurantId)}/price-history${qs}`,
    ) as Promise<{ changes: PriceChangeRow[] }>;
  }

  /** Make a store fixed-price, or standard again. NOT cached - it changes
   *  something. Refused (409) while the store has unfinished orders. */
  async setPriceMode(restaurantId: string, mode: "fixed" | "standard") {
    return this.request(`/admin/restaurants/${encodeURIComponent(restaurantId)}/price-mode`, {
      method: "PUT",
      body: JSON.stringify({ mode }),
    }) as Promise<{ price_mode: string; changed: boolean; message?: string; selling_prices_set?: number;
      /** Buying prices the vendor typed himself (money audit M9): checked by the office. */
      vendor_buying_prices?: { product_id: string; variant_id: string | null; name: string; buying_price: number; typed_at?: string }[];
      vendor_buying_prices_checked?: boolean;
      vendor_buying_prices_message?: string }>;
  }

  /** Change buying prices, selling prices and discounts - one or many. A loss
   *  is refused (409, with the list in `detail.losses`) unless confirmLoss. */
  async setStorePrices(
    restaurantId: string,
    changes: {
      product_id: string; variant_id?: string | null; buying_price?: number;
      clear_buying?: boolean; selling_price?: number; discount_percent?: number;
    }[],
    confirmLoss = false,
  ): Promise<{ saved: number; losses_confirmed: any[] }> {
    return this.request(`/admin/restaurants/${encodeURIComponent(restaurantId)}/set-prices`, {
      method: "PUT",
      body: JSON.stringify({ changes, confirm_loss: confirmLoss }),
    }) as Promise<{ saved: number; losses_confirmed: any[] }>;
  }

  /** Save a product's options. `more` (audit 203): remove_ids takes those
   *  options off even when they are switched off; drop_choices removes every
   *  choice (a restaurant dish set to One price) and keeps the extras. */
  async setProductVariants(
    itemId: string,
    variants: any[],
    more: { remove_ids?: string[]; drop_choices?: true } = {},
  ) {
    return this.request(`/menu/${itemId}/variants`, {
      method: "PUT",
      body: JSON.stringify({ variants, ...more }),
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

  // Settings > Tidy up removed products (audit 204 fix 7, Mock 203).
  // Check first changes nothing; Remove needs the number the check showed.
  async checkRemovedProducts(): Promise<TidyCheck> {
    return this.request(`/admin/products/tidy-removed`);
  }

  async tidyRemovedProducts(expected: number): Promise<TidyDone> {
    return this.request(`/admin/products/tidy-removed`, {
      method: "POST",
      body: JSON.stringify({ expected }),
    });
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

  // ── EVERY PRODUCT ON ITS RIGHT SHELF (Mock 201, Sana 19 Oct 2026) ────────
  // The shelf picker: EVERY department, the shop's own first ("a pharmacy can
  // put Surf Excel on Laundry Detergent"). An older server ignores the flag
  // and answers with the shop's own department, exactly as before. Shop
  // sign-up and moving a product to another store still use getCategoryTree.
  async getShelfTree(vendorType?: string) {
    const p = new URLSearchParams({ all_departments: "true" });
    if (vendorType) p.set("vendor_type", vendorType);
    return this.request<{ tree: any[]; own_slugs?: string[] }>(`/categories/tree?${p.toString()}`);
  }

  /** "Takal suggests" - a shelf from the product's name. */
  async suggestShelf(name: string, restaurantId?: string) {
    const p = new URLSearchParams({ name });
    if (restaurantId) p.set("restaurant_id", restaurantId);
    return this.request<ShelfSuggestion>(`/shelf/suggest?${p.toString()}`);
  }

  // Stores › Shelf check. Every move is saved in a backup list on the server
  // first; Undo puts a whole batch back.
  async getShelfCheck(show = "to_check") {
    return this.request<{ groups: any[]; ran_at?: string | null; totals?: Record<string, number> }>(
      `/admin/shelf-check?show=${encodeURIComponent(show)}`);
  }

  /** Read every product again and regroup. Slow by nature on 22,000 products. */
  async runShelfCheck() {
    return this.request<{ groups: any[]; checked: number }>(`/admin/shelf-check/run`, {
      method: "POST", timeoutMs: 180000,
    });
  }

  async getShelfCheckItems(groupKey: string, offset = 0, limit = 100) {
    return this.request<{ items: ShelfCheckItem[]; total: number }>(
      `/admin/shelf-check/groups/${encodeURIComponent(groupKey)}/items?offset=${offset}&limit=${limit}`);
  }

  async moveShelfCheck(body: { group: string } | { items: { id: string; to: string }[] }) {
    return this.request<{ moved: number; batch_id: string }>(`/admin/shelf-check/move`, {
      method: "POST", body: JSON.stringify(body), timeoutMs: 120000,
    });
  }

  async getShelfCheckHistory() {
    return this.request<{ batches: ShelfBatch[] }>(`/admin/shelf-check/history`);
  }

  async undoShelfCheck(batchId: string) {
    return this.request<{ put_back: number }>(`/admin/shelf-check/undo`, {
      method: "POST", body: JSON.stringify({ batch_id: batchId }), timeoutMs: 120000,
    });
  }

  /** The pharmacist's list of medicines that are safe without a prescription. */
  async sendPharmacistList(words: string[]) {
    return this.request<{ safe: number; still_rx: number }>(`/admin/shelf-check/pharmacist-list`, {
      method: "POST", body: JSON.stringify({ words }), timeoutMs: 120000,
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

  // ── MALLS (migration 127, Mock 172-6, 9 Oct 2026) ────────────────────────
  // A mall = one name and logo with several of ONE owner's parcel stores
  // inside, one delivery for the whole basket. The rules (same owner, same
  // speed, not in another mall, a logo, whole rupees) are the SERVER's
  // (routers/malls.py); the panel only offers what the server will take.

  /** Every mall, its stores and (Main Admin only) its staff logins. */
  async getMalls(): Promise<{ malls: Mall[]; total: number }> {
    return this.request(`/admin/malls`) as Promise<{ malls: Mall[]; total: number }>;
  }

  async getMall(mallId: string): Promise<Mall> {
    return this.request(`/admin/malls/${encodeURIComponent(mallId)}`) as Promise<Mall>;
  }

  /** One owner's stores, each saying whether it can go into a mall. */
  async getMallStoreChoices(ownerId: string): Promise<{ owner: MallOwner | null; stores: MallStoreChoice[] }> {
    return this.request(`/admin/malls/choices?owner_id=${encodeURIComponent(ownerId)}`) as
      Promise<{ owner: MallOwner | null; stores: MallStoreChoice[] }>;
  }

  /** Make a mall from stores that already exist (and from Create store with
   *  several kinds ticked). No logo = the first store's; none at all = refused. */
  async createMall(body: NewMall): Promise<{ message: string; mall: Mall }> {
    return this.request(`/admin/malls`, {
      method: "POST",
      body: JSON.stringify(body),
    }) as Promise<{ message: string; mall: Mall }>;
  }

  /** Change anything but the owner. admin_delivery_fee null = the normal fee. */
  async updateMall(mallId: string, patch: MallPatch): Promise<{ message: string; mall: Mall; renamed?: StoreRename[] }> {
    return this.request(`/admin/malls/${encodeURIComponent(mallId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }) as Promise<{ message: string; mall: Mall; renamed?: StoreRename[] }>;
  }

  async addMallStores(mallId: string, storeIds: string[]): Promise<{ message: string; added: number }> {
    return this.request(`/admin/malls/${encodeURIComponent(mallId)}/stores`, {
      method: "POST",
      body: JSON.stringify({ store_ids: storeIds }),
    }) as Promise<{ message: string; added: number }>;
  }

  /** The delivery a basket from this mall is charged - the SAME public quote
   *  the customer app asks (a parcel mall's fee does not depend on where the
   *  customer is). Used to print "Rs 150 (standard fee)" with the real figure. */
  async getMallDeliveryQuote(mallId: string): Promise<{ delivery_fee: number; minimum_order: number }> {
    return this.request(`/delivery-fee/preview-mall?mall_id=${encodeURIComponent(mallId)}&lat=0&lon=0`) as
      Promise<{ delivery_fee: number; minimum_order: number }>;
  }

  /** Take a store out. Refused while one of its mall orders is unfinished.
   *  Deletes nothing: its products, orders and payouts stay as they are. */
  async removeMallStore(mallId: string, storeId: string): Promise<{ message: string }> {
    return this.request(
      `/admin/malls/${encodeURIComponent(mallId)}/stores/${encodeURIComponent(storeId)}`,
      { method: "DELETE" },
    ) as Promise<{ message: string }>;
  }
}

/** A mall's owner, as the store page already shows him to the office. */
export type MallOwner = { id: string; full_name?: string | null; phone?: string | null };

/** One store inside a mall (GET /admin/malls). */
/** A store name the server changed with the mall (Mock 177). */
export type StoreRename = { id: string; from: string | null; to: string | null };

export type MallStore = {
  id: string;
  name: string;
  vendor_type: string;
  speed: "standard" | "instant";
  image_url: string | null;
  has_own_logo: boolean;
  is_approved: boolean;
  is_open: boolean;
  /** approved / hidden / pending / rejected / suspended (Mock 207). Absent
   *  from an older server. */
  status?: string;
  /** The store's own rate, or null = its department's rate. */
  commission_percent: number | null;
  products: number;
};

export type MallStoreChoice = MallStore & {
  mall_id: string | null;
  can_join: boolean;
  why_not: string | null;
  /** The kind's name - "Fashion", one of the 13 (Mock 177). "" when unknown. */
  kind_name?: string;
};

/** One store on the "Store names" card (Mock 177, migration 129). */
export type StoreNameRow = {
  id: string;
  kind: string;
  /** "Fashion" - the kind's name from Stores -> Catalogue; "" = not a named kind. */
  kind_name: string;
  saved_as: string;
  /** "Wakeel Shopping Mall — Fashion"; null = the rule does not touch it. */
  will_be: string | null;
  matches: boolean;
};

/** "Name stores after their kind" (Mock 177). Missing before migration 129. */
export type StoreNames = {
  follow: boolean;
  stores: StoreNameRow[];
  all_match: boolean;
  /** A kind two of its stores share ("Fashion"), or null. */
  kind_taken: string | null;
};

/** One staff login of a mall's stores (Main Admin only). */
export type MallStaffLine = {
  id: string;
  full_name: string;
  restaurant_id: string;
  whole_mall: boolean;
  is_active: boolean;
};

export type Mall = {
  id: string;
  name: string;
  owner_id: string;
  owner: MallOwner | null;
  image_url: string | null;
  cover_url: string | null;
  phone: string | null;
  address: string | null;
  minimum_order: number;
  /** null = the normal fee (Rs 150 for a parcel today). */
  admin_delivery_fee: number | null;
  is_active: boolean;
  created_at?: string;
  stores: MallStore[];
  store_count: number;
  product_count: number;
  speed: "standard" | "instant" | null;
  /** Present for the Main Admin only. */
  staff?: MallStaffLine[];
  /** The "Store names" card - absent before migration 129. */
  store_names?: StoreNames;
};

export type NewMall = {
  name: string;
  store_ids: string[];
  image_url?: string;
  minimum_order?: number;
  admin_delivery_fee?: number | null;
  address?: string;
};

export type MallPatch = Partial<{
  name: string;
  image_url: string;
  cover_url: string | null;
  phone: string | null;
  address: string | null;
  minimum_order: number;
  admin_delivery_fee: number | null;
  is_active: boolean;
  /** Mock 177: "Name stores after their kind". */
  store_names_follow_kind: boolean;
}>;

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
  /** A pharmacy's licence (Mock 208-4) - required by the server for a pharmacy. */
  licence_number?: string;
  licence_valid_until?: string;   // "YYYY-MM-DD"
  licence_photo?: string;         // from uploadLicencePhoto - a private path
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


/** The filter buttons on a store's Products tab. Same words as the server. */
export type ShopProductShow = "all" | "no_picture" | "out_of_stock" | "off" | "featured"
  // MOCK 203 v2 (20 Oct 2026): 1 to 5 left, and any discount on.
  | "low" | "discount"
  // The two red buttons (Step 5b): no buying price yet, and sold at a loss.
  // Every store since MOCK 203 v2 - a big standard store's numbers are null.
  | "missing_buying" | "loss";

/** One product found by the All Stores search (MOCK 203-1 v2). */
export type FoundProduct = {
  id: string; name: string; price: number | null; discount_percent: number;
  stock: number | null; is_available: boolean; image_url: string | null;
  restaurant_id: string; store_name: string; store_logo: string | null;
  shelf?: string; department_name?: string;
};

export type ShopProduct = {
  id: string;
  name: string;
  price: number | null;
  discount_percent: number;
  stock: number | null;
  is_available: boolean;
  is_featured: boolean;
  image_url: string | null;
  photo_count: number;
  option_count: number;
  /** Step 5a (Mock 171-2): sizes / colours, and extras, without opening it.
   *  Optional: a server from before 8 Oct 2026 does not send them. */
  choice_count?: number;
  extra_count?: number;
  /** Every choice is of type "Size". */
  sizes?: boolean;
  /** The cheapest choice when every choice has a price of its own, else null. */
  from_price?: number | null;
  category_id: string | null;
  category_name: string;
  created_at?: string;
  /** Needs a prescription - set by its shelf or the medicine rules (audit
   *  203). Optional: shown as "Rx" when the server sends it. */
  needs_prescription?: boolean;
  /** A FIXED-PRICE store, seen by its own Mall staff (money audit AREA-7-9,
   *  21 Oct 2026): what the store is paid for one - the buying price. The
   *  staff screen shows only this, never Takal's selling price. Optional:
   *  until the server sends it the screen shows "—". */
  you_get?: number | null;
};

/** One size, colour or extra of a product, as the server stores it. */
export type ProductOptionRow = {
  id: string;
  product_id: string;
  variant_type: string;
  variant_value: string;
  sku?: string | null;
  stock_quantity: number | null;
  price_override: number | null;
  is_available: boolean;
};

export type ShopProductsPage = {
  restaurant_id: string;
  page: number;
  per_page: number;
  show: ShopProductShow;
  search: string;
  category_id: string | null;
  /** null = could not be counted just now. Never show it as 0. */
  total: number | null;
  counts: Partial<Record<ShopProductShow, number | null>> & Record<"all" | "no_picture" | "out_of_stock" | "off" | "featured", number | null>;
  /** Step 5b. Missing from a server before 8 Oct 2026 = standard. */
  price_mode?: "fixed" | "standard";
  /** false = the price type could not be read just now, so price_mode is
   *  the 30-second list's answer (fixer H, 22 Oct 2026). Missing = checked. */
  price_mode_checked?: boolean;
  has_more: boolean;
  items: ShopProduct[];
};

export type BulkProductAction = "on" | "off" | "stock" | "discount" | "category" | "remove";

export type BulkProductResult = {
  action: BulkProductAction;
  asked: number;
  changed: string[];
  not_in_this_shop: string[];
  failed: { id: string; name: string; error: string }[];
  message: string;
};

/** What the Shop panel's Money tab shows. Commission is NOT here on purpose. */
export type ShopEarnings = {
  earned: number;                 // all time: what the shop keeps on delivered orders
  paid: number;                   // all time: what Takal has paid the shop
  pending: number;                // earned - paid: still to come from Takal
  delivered_orders: number;
  history: {
    amount: number; method: string | null; reference: string | null;
    paid_at: string | null; cancelled: boolean;
  }[];
  period?: { from: string | null; to: string | null; orders: number; earned: number };
  incomplete?: boolean;           // the server could not read everything
};

/** "Takal suggests" (Mock 201). category_id null = no idea, choose a shelf. */
export type ShelfSuggestion = {
  name: string;
  category_id: string | null;
  slug?: string;
  shelf?: string;
  shelf_ur?: string;
  path?: string;
  path_ur?: string;
  department_slug?: string;
  own_department?: boolean;
  sure?: boolean;
  why?: string;
  why_ur?: string;
  needs_prescription?: boolean;
  is_medicine?: boolean;
};

/** One product of a Shelf check group, for "Look one by one". */
export type ShelfCheckItem = {
  id: string;
  name: string;
  shop?: string;
  from_shelf?: string;
  to_shelf?: string;
  to_category_id?: string | null;
  sure?: boolean;
  rx?: boolean;
};

/** One press of "Move all" (or one "Move" of chosen products), kept for Undo. */
export type ShelfBatch = {
  batch_id: string;
  label?: string;
  count: number;
  moved_at?: string | null;
  by?: string | null;
  undone_at?: string | null;
};
