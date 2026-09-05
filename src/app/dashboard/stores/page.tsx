"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Clock, Edit2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { StatusBadge, ConfirmDialog, ErrorState, useDialogKeys } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { toast } from "@/lib/toast";
import { moneyExact } from "@/lib/format";
import { VERTICALS, verticalLabel, verticalEmoji } from "@/lib/verticals";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actioningRestaurantId, setActioningRestaurantId] = useState<string | null>(null);
  const [editCommissionId, setEditCommissionId] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState("");
  const [editFeeId, setEditFeeId] = useState<string | null>(null);
  const [feeValue, setFeeValue] = useState("");
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Let another page hand us a store to look at, e.g. Store Reliability linking
  // "Habib Cafe" straight here instead of asking you to find it in a long list.
  //
  // Read from window rather than useSearchParams: that hook forces the page
  // into a Suspense boundary at build time, and a missing one has already
  // broken a Vercel build on this project once.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
    } catch {
      /* no query string; nothing to prefill */
    }
  }, []);

  /** Open or close a store from the list, without opening it.
   *  A closed store still exists and is still approved — customers simply
   *  cannot order from it right now. */
  const toggleOpen = async (r: any) => {
    try {
      setTogglingId(r.id);
      await apiClient.toggleRestaurantOpen(String(r.id));
      toast(r.is_open ? `${r.name} is now Closed` : `${r.name} is now Open`, "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change open/closed", "error");
    } finally {
      setTogglingId(null);
    }
  };

  // Create-store modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<any>(null);
  const emptyForm = { owner_name: "", phone: "", email: "", store_name: "", vendor_type: "restaurant", address: "" };
  const [form, setForm] = useState({ ...emptyForm });

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submitCreate = async () => {
    if (!form.owner_name.trim() || !form.phone.trim() || !form.store_name.trim()) {
      toast("Owner name, phone, and store name are required", "error");
      return;
    }
    try {
      setCreating(true);
      const res = (await apiClient.createStore(form)) as any;
      setCreds(res?.credentials || null);
      toast("Store created", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create store", "error");
    } finally {
      setCreating(false);
    }
  };

  useDialogKeys(createOpen, () => closeCreate(), creating);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreds(null);
    setForm({ ...emptyForm });
  };

  const vendorTypeOf = (r: any) => (r.vendor_type || "").trim() || "restaurant";

  const saveVendorType = async (restaurantId: string, vendorType: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.setRestaurantVendorType(restaurantId, vendorType);
      setEditTypeId(null);
      toast("Store type updated", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update store type", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  /** Set this shop's delivery fee, or clear it back to the standard rule.
   *
   *  Mock 30, approved 5 September 2026 (audit finding P-7).
   *
   *  An EMPTY box means "use the rule in Settings" — base + per km, capped —
   *  which is how every shop works unless somebody decides otherwise. It is not
   *  the same as 0, and it must not be saved as 0: a shop on the rule and a
   *  shop deliberately set to free delivery look identical the moment those two
   *  are confused, and one of them is charging nothing. The commission column
   *  beside this one carries the same warning for the same reason.
   */
  const saveDeliveryFee = async (restaurantId: string) => {
    const raw = feeValue.trim();
    let fee: number | null = null;
    if (raw !== "") {
      const val = parseFloat(raw);
      if (!Number.isFinite(val) || val < 0) {
        toast("Enter a delivery fee of 0 or more, or leave it empty for the standard rule", "error");
        return;
      }
      fee = val;
    }
    try {
      await apiClient.setShopDeliveryFee(restaurantId, fee);
      setEditFeeId(null);
      toast(
        fee === null
          ? "Back on the standard delivery fee rule"
          : `Delivery fee set to ${moneyExact(fee)} for this shop`,
        "success"
      );
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not change the delivery fee", "error");
    }
  };

  const saveCommission = async (restaurantId: string) => {
    if (!commissionValue.trim()) {
      toast(
        "Type a rate between 0 and 100, or press the X to leave this shop on "
          + "the global rate.",
        "error"
      );
      return;
    }
    const val = parseFloat(commissionValue);
    if (isNaN(val) || val < 0 || val > 100) {
      toast("Enter a commission between 0 and 100", "error");
      return;
    }
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.setRestaurantCommission(restaurantId, val);
      setEditCommissionId(null);
      toast("Commission updated", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update commission", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [statusFilter]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;

      const response = await apiClient.getRestaurants(filters) as any;
      setRestaurants(response?.restaurants || response?.data || []);
    } catch (err) {
      setError(readFailure(err, "the shop list"));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (restaurantId: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.approveRestaurant(restaurantId);
      toast("Store approved", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to approve", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  // REJECT USED TO FIRE ON THE FIRST CLICK. It sat six lines away from
  // Suspend, which asked first - and turning a shop away is at least as final
  // as suspending one. Both now go through the same confirmation, which names
  // the shop, so you can see what you are about to do to whom.
  //
  // Suspend previously used the browser's own confirm() box: a grey operating
  // system panel that cannot show the shop's name and looks nothing like the
  // rest of Takal.
  const [pending, setPending] = useState<{ store: any; action: "reject" | "suspend" } | null>(null);

  const runPending = async () => {
    if (!pending) return;
    const { store, action } = pending;
    try {
      setActioningRestaurantId(store.id);
      if (action === "reject") {
        await apiClient.rejectRestaurant(store.id);
        toast("Store rejected", "success");
      } else {
        await apiClient.suspendRestaurant(store.id);
        toast("Store suspended", "success");
      }
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setActioningRestaurantId(null);
      setPending(null);
    }
  };

  // The backend stores is_approved / is_suspended, not a single status string.
  const deriveStatus = (r: any) =>
    r.is_suspended ? "suspended" : r.is_approved ? "approved" : "pending";

  const handleUnsuspend = async (restaurantId: string) => {
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.unsuspendRestaurant(restaurantId);
      toast("Store unsuspended", "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unsuspend", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch = (r.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || deriveStatus(r) === statusFilter;
    const matchesType = typeFilter === "all" || vendorTypeOf(r) === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // The colours that used to be listed here disagreed with the Riders page:
  // "suspended" was GREY here and RED there, for one meaning. Both now read
  // from the single map in src/components/ui/theme.ts. The icons are kept.
  const getStatusBadge = (status: string) => {
    const Icon =
      status === "approved" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
    return <StatusBadge status={status} icon={<Icon className="w-3 h-3" />} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* This page manages every vendor type, not only restaurants. */}
          <h2 className="text-xl font-bold text-takal-ink">All Stores</h2>
          <p className="text-takal-ink-soft mt-1">
            All vendors — restaurants, grocery, pharmacy, fashion, electronics and the rest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition font-medium"
          >
            + Create store
          </button>
          <button
            onClick={fetchRestaurants}
            className="px-4 py-2 border border-takal-line hover:bg-takal-page rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchRestaurants} denied={error.denied} />
      )}

      <div className="bg-white rounded-lg border border-takal-line p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-takal-disabled-text" />
              <input
                type="text"
                placeholder="Search by store name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          >
            <option value="all">All Store Types</option>
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Store Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Owner</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Open now</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Commission</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Delivery fee</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-takal-ink">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* 8 headings above, so 8 here. It said 6 once, which drew a
                   skeleton one column narrower than the table it stood in. */
                <SkeletonRows rows={8} cols={8} />
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-takal-ink-soft">
                    The shop list could not be read, so nothing can be listed here.
                    Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-takal-ink-soft">
                    No stores found
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-6 py-4 text-sm font-semibold text-takal-ink">
                      <Link href={`/dashboard/stores/${restaurant.id}`} className="text-takal-ink hover:underline">
                        {restaurant.name || "N/A"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {editTypeId === restaurant.id ? (
                        <select
                          autoFocus
                          defaultValue={vendorTypeOf(restaurant)}
                          disabled={actioningRestaurantId === restaurant.id}
                          onChange={(e) => saveVendorType(restaurant.id, e.target.value)}
                          onBlur={() => setEditTypeId(null)}
                          className="px-2 py-1 border border-takal-line rounded text-sm"
                        >
                          {VERTICALS.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.emoji} {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-takal-ink">
                            {verticalEmoji(vendorTypeOf(restaurant))} {verticalLabel(vendorTypeOf(restaurant))}
                          </span>
                          <button
                            onClick={() => setEditTypeId(restaurant.id)}
                            className="text-takal-ink hover:text-takal-ink"
                            title="Change store type"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {restaurant.owner_name || restaurant.email || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(deriveStatus(restaurant))}
                        {/* An express store with no map point is invisible to
                            customers. Nothing used to say so. */}
                        {restaurant.hidden_no_location && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                            title="No map point set. Customers cannot see this store, because we cannot measure the delivery distance or route a rider. Open the store to set it."
                          >
                            ⚠ No map point
                          </span>
                        )}
                        {!restaurant.hidden_no_location &&
                          restaurant.has_location === false && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                              title="No map point set. This store ships over days, so customers can still see it."
                            >
                              No map point
                            </span>
                          )}
                      </div>
                    </td>
                    {/* Open / Closed — a dot you can read at a glance, and a
                        button to flip it without opening the store.
                        The BUTTON shows the owner's switch, because that is what
                        clicking it changes. The line underneath shows what a
                        CUSTOMER sees, which is the switch AND the opening hours.
                        They disagreed on the live site — habib cafe read "Open"
                        here while the app correctly showed it shut, because its
                        hours start at 12:00 — and nothing on this page explained
                        why. `open_now` is worked out by the server with the same
                        function the customer app and checkout use. */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleOpen(restaurant)}
                        disabled={togglingId === restaurant.id}
                        title={
                          restaurant.is_open
                            ? "Open — customers can order. Click to close."
                            : "Closed — customers cannot order. Click to open."
                        }
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
                          restaurant.is_open
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                            : "bg-takal-page border-takal-line text-takal-ink-soft hover:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            restaurant.is_open ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {togglingId === restaurant.id
                          ? "..."
                          : restaurant.is_open
                          ? "Open"
                          : "Closed"}
                      </button>
                      {restaurant.is_open && restaurant.open_now === false && (
                        <div className="mt-1 text-[11px] leading-tight text-amber-700">
                          Customers see it <strong>closed</strong>
                          {restaurant.opening_time && restaurant.closing_time
                            ? ` — hours are ${restaurant.opening_time}–${restaurant.closing_time}`
                            : " right now"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {editCommissionId === restaurant.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={commissionValue}
                            onChange={(e) => setCommissionValue(e.target.value)}
                            placeholder="global"
                            className="w-20 px-2 py-1 border border-takal-line rounded"
                          />
                          %
                          <button onClick={() => saveCommission(restaurant.id)} className="text-takal-green hover:opacity-80" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditCommissionId(null)} className="text-takal-ink-soft hover:text-takal-ink" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {/* "NO OVERRIDE" IS NOT THE SAME AS 0%.
                              A shop with no rate of its own simply uses the
                              global rate, and this column drew it as a real
                              0% - identical on screen to the pharmacy that was
                              deliberately set to zero. */}
                          {restaurant.commission_percent == null ? (
                            <span className="text-takal-ink-soft">
                              Global rate
                            </span>
                          ) : (
                            `${restaurant.commission_percent}%`
                          )}
                          <button
                            onClick={() => {
                              setEditCommissionId(restaurant.id);
                              // An empty box, not "0". Pre-filling with 0 is
                              // how "uses the global rate" quietly became a
                              // genuine 0% override the moment somebody
                              // pressed Save.
                              setCommissionValue(
                                restaurant.commission_percent == null
                                  ? ""
                                  : String(restaurant.commission_percent)
                              );
                            }}
                            className="text-takal-ink hover:text-takal-ink"
                            title="Edit commission"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                    {/* DELIVERY FEE — Mock 30, approved 5 September 2026.
                        Empty means this shop uses the one rule in Settings.
                        A number means the customer pays exactly that, at any
                        distance. The rider is still paid from the real
                        distance, so a low flat fee on a far shop comes out of
                        the platform's margin, not the rider's pay. */}
                    <td className="px-6 py-4 text-sm text-takal-ink-soft">
                      {editFeeId === restaurant.id ? (
                        <span className="inline-flex items-center gap-1">
                          Rs
                          <input
                            type="number"
                            min={0}
                            value={feeValue}
                            onChange={(e) => setFeeValue(e.target.value)}
                            placeholder="rule"
                            className="w-20 px-2 py-1 border border-takal-line rounded"
                          />
                          <button onClick={() => saveDeliveryFee(restaurant.id)} className="text-takal-green hover:opacity-80" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditFeeId(null)} className="text-takal-ink-soft hover:text-takal-ink" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {restaurant.admin_delivery_fee == null ? (
                            <span className="text-takal-ink-soft">Standard rule</span>
                          ) : (
                            <span className="font-semibold text-takal-ink">
                              {/* moneyExact, not money(): this is a SETTING.
                                  A fee of Rs 12.5 rounded to "Rs 13" would be
                                  a wrong number on screen, not a rounded one. */}
                              Fixed &middot; {moneyExact(restaurant.admin_delivery_fee)}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setEditFeeId(restaurant.id);
                              // Empty, not "0". Pre-filling 0 is how "uses the
                              // standard rule" quietly becomes free delivery
                              // the moment somebody presses Save.
                              setFeeValue(
                                restaurant.admin_delivery_fee == null
                                  ? ""
                                  : String(restaurant.admin_delivery_fee)
                              );
                            }}
                            className="text-takal-ink hover:text-takal-ink"
                            title="Set a fee for this shop, or clear it for the standard rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                    {/* THE ACTION LINKS WERE TAILWIND'S COLOURS, NOT TAKAL'S,
                        and "Suspend" was yellow - the one thing the Brand Kit
                        forbids, because yellow is Takal's own colour and never
                        means a warning. Suspend is now the orange chip the
                        Brand Kit gives to "needs you", with black writing on
                        it, so it is both on-brand and readable. */}
                    <td className="px-6 py-4 text-sm flex gap-2">
                      {deriveStatus(restaurant) === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(restaurant.id)}
                            disabled={actioningRestaurantId === restaurant.id}
                            className="text-takal-green hover:underline font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setPending({ store: restaurant, action: "reject" })}
                            disabled={actioningRestaurantId === restaurant.id}
                            className="text-takal-red hover:underline font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {deriveStatus(restaurant) === "approved" && (
                        <button
                          onClick={() => setPending({ store: restaurant, action: "suspend" })}
                          disabled={actioningRestaurantId === restaurant.id}
                          className="rounded-md bg-takal-orange-soft px-2 py-1 font-semibold text-takal-ink ring-1 ring-[#FFD2BF] hover:bg-[#FFE2D6] disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      )}
                      {deriveStatus(restaurant) === "suspended" && (
                        <button
                          onClick={() => handleUnsuspend(restaurant.id)}
                          disabled={actioningRestaurantId === restaurant.id}
                          className="text-takal-green hover:underline font-medium disabled:opacity-50"
                        >
                          Unsuspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeCreate}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {creds ? (
              <div>
                <h2 className="text-xl font-bold text-takal-ink mb-1">Store created</h2>
                <p className="text-sm text-takal-ink-soft mb-4">
                  Share these with the vendor. They sign into the vendor app with their phone and password.
                </p>
                <div className="bg-takal-page border border-takal-line rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-takal-ink-soft">Phone</span><span className="font-mono font-medium text-takal-ink">{creds.phone}</span></div>
                  <div className="flex justify-between"><span className="text-takal-ink-soft">Password</span><span className="font-mono font-medium text-takal-ink">{creds.password}</span></div>
                  <div className="flex justify-between"><span className="text-takal-ink-soft">Email</span><span className="font-mono text-xs text-takal-ink">{creds.email}</span></div>
                </div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`Phone: ${creds.phone}\nPassword: ${creds.password}`); toast("Copied", "success"); }}
                  className="mt-3 w-full px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page text-sm"
                >
                  Copy phone and password
                </button>
                <button onClick={closeCreate} className="mt-2 w-full px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-takal-ink mb-4">Create a store</h2>
                <div className="space-y-3">
                  <input placeholder="Owner name" value={form.owner_name} onChange={(e) => setF("owner_name", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
                  <input placeholder="Phone (used to sign in)" value={form.phone} onChange={(e) => setF("phone", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
                  <input placeholder="Email (optional)" value={form.email} onChange={(e) => setF("email", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
                  <input placeholder="Store name" value={form.store_name} onChange={(e) => setF("store_name", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
                  <select value={form.vendor_type} onChange={(e) => setF("vendor_type", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm">
                    {VERTICALS.map((v) => (
                      <option key={v.value} value={v.value}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                  <input placeholder="Address (optional)" value={form.address} onChange={(e) => setF("address", e.target.value)} className="w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm" />
                  <p className="text-xs text-takal-ink-soft">A secure password is generated automatically. The store is approved instantly, so the vendor can sign in right away.</p>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={closeCreate} className="flex-1 px-4 py-2 border border-takal-line rounded-lg hover:bg-takal-page">Cancel</button>
                  <button onClick={submitCreate} disabled={creating} className="flex-1 px-4 py-2 bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink rounded-lg">
                    {creating ? "Creating…" : "Create store"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        busy={actioningRestaurantId !== null}
        onCancel={() => setPending(null)}
        onConfirm={runPending}
        title={pending?.action === "reject" ? "Reject this store?" : "Suspend this store?"}
        confirmLabel={pending?.action === "reject" ? "Yes, reject" : "Yes, suspend"}
        message={
          pending?.action === "reject" ? (
            <>
              <strong>{pending?.store?.name || "This store"}</strong> will be
              turned down. Their shop will not appear to customers and they
              would have to apply again.
            </>
          ) : (
            <>
              <strong>{pending?.store?.name || "This store"}</strong> will stop
              taking orders straight away. You can un-suspend them later.
            </>
          )
        }
      />
    </div>
  );
}
