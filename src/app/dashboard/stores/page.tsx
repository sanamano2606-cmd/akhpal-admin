"use client";

import { LICENCE_STATE, type LicenceState } from "@/lib/shop-licence";
import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Clock, Edit2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { Badge, StatusBadge, ConfirmDialog, ErrorState } from "@/components/ui";
import {
  RejectReasonDialog, SHOP_REASONS, rejectedLine,
} from "@/components/RejectReasonDialog";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { toast } from "@/lib/toast";
import { canAccess, getMyPerms } from "@/lib/perms";
import { approveState, approveWithChecklist, missingForApproval, MIN_PRODUCTS } from "@/lib/approve-rule";
import { moneyExact, money } from "@/lib/format";
import type { FoundProduct } from "@/lib/api-stores";
import { VERTICALS, verticalLabel, verticalEmoji, verticalOptions } from "@/lib/verticals";
import { STORE_SORTS, DEFAULT_STORE_SORT, readStoreSort, sortStores, type StoreSort } from "@/lib/store-sort";
import { groupByMall, shortStoreName } from "@/lib/store-groups";
import { listQuery, rememberListQuery } from "@/lib/stores-list-address";
import { refreshWaitingShopsCount } from "@/lib/hooks/useWaitingShopsCount";
import { READY_FILTERS, approveAllLabel, approveAllResult, passesReady, shopPhone, waitingOrder, whatIsLeftMessage, whatsappLink, type ReadyFilter } from "@/lib/vendor-queue";
// The map lives on the shop page; the two things borrowed here are the list
// of rider-carried shop types (so "no pin" can say whether the shop is
// merely untidy or actually invisible) and the Google-Maps link reader.
import { expressShopTypes } from "./[id]/parts-map";
import CreateStoreWizard from "./parts-create-store";
import { CustomersSeeSwitch, CustomersSeeChip } from "./parts-customers-see";
import { reviewStateOf, reviewingLine, sortByReview } from "@/lib/shop-review";

/** The licence states the list shows (Mock 208-4); "waiting" is the Review page's. */
const LICENCE_FLAG = ["missing", "expired", "expiring"];

// ── THE FIVE LISTS (Stores page fix 1, Sana 12 Oct 2026) ──────────────────────
//
// "Reject mean remove it from here and add a rejected store list separate."
// The page used to show every shop in one long list with a Status dropdown, so
// a turned-down shop sat between the live ones with a red label. Now the shops
// are sorted into lists, shown as count boxes at the top; one is open at a
// time, and a rejected shop is ONLY in Rejected. Mock 182, picture 1.
//
// "attention" is not a status: it is LIVE shops selling fewer than 5 products
// (11 of them on 12 Oct 2026), which nothing on this page used to show.
type StoreView = "live" | "hidden" | "pending" | "suspended" | "rejected" | "attention";

const VIEWS: { key: StoreView; label: string; hint: string; dot: string }[] = [
  { key: "live", label: "Live", hint: "selling now", dot: "bg-emerald-500" },
  // MOCK 207-6 (Sana 23 Oct 2026): approved by Takal, not switched on for
  // customers yet. Only the Main Admin switches them on.
  { key: "hidden", label: "Hidden from customers", hint: "approved, not shown yet", dot: "bg-takal-orange" },
  { key: "pending", label: "Waiting for approval", hint: "need your OK", dot: "bg-orange-500" },
  { key: "suspended", label: "Suspended", hint: "stopped by Takal", dot: "bg-red-600" },
  { key: "rejected", label: "Rejected", hint: "turned down", dot: "bg-slate-500" },
  { key: "attention", label: "Need attention", hint: `live, under ${MIN_PRODUCTS} products`, dot: "bg-amber-400" },
];

/** ?status= in the address -> a list. The Dashboard's "Stores awaiting
 *  approval" opens ?status=pending. Anything else opens Live. */
function readView(raw: string | null | undefined): StoreView {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "approved") return "live";
  return (VIEWS.some((x) => x.key === v) ? v : "live") as StoreView;
}

/** One waiting shop's seven checks, as the server sends them (fix 2). */
type Checklist = {
  id: string; done: number; total: number; ready: boolean; what_is_left: string[];
  days_waiting: number | null;
  steps: { key: string; label: string; done: boolean; note: string }[];
};

/** The Approve button for a WAITING shop: the products rule (approveState)
 *  AND the whole checklist (fix 2, Sana 12 Oct 2026 - "Approve unlocks when
 *  everything is ticked"). The server decides the same way. No checklist
 *  read: the products rule alone, as before. */
function withChecklist<T extends { button: string; why: string; enough: boolean }>(
  a: T, list: Checklist | undefined, isMainAdmin: boolean): T {
  if (!list || list.ready || a.button !== "approve") return a;
  const left = list.what_is_left.filter((x) => !/products$/.test(x));
  if (left.length === 0) return a;
  return { ...a, button: isMainAdmin ? "anyway" : "none",
           why: `Still missing: ${left.join(", ")}` };
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Each waiting shop's seven checks, by shop id (fix 2).
  const [checklists, setChecklists] = useState<Record<string, Checklist>>({});
  // Inside Waiting: every shop, only the READY ones, or only the ones still
  // missing something (audit 23 October 2026).
  const [readyFilter, setReadyFilter] = useState<ReadyFilter>("all");
  const [error, setError] = useState<ReadFailure>(null);
  const [search, setSearch] = useState("");
  // ── MOCK 203-1 v2 (approved by Sana 20 Oct 2026): the search box finds
  //    PRODUCTS in every store too. "Products" mode keeps the store list as
  //    it is and shows what it found under the box; "Open ›" goes into that
  //    store with the product found. The red "📷 No picture" button lists
  //    every store's products that still need one.
  const [findMode, setFindMode] = useState<"stores" | "products">("stores");
  const [productWords, setProductWords] = useState("");
  const [found, setFound] = useState<null | { items: FoundProduct[]; total: number | null; show: "all" | "no_picture"; words: string }>(null);
  const [findBusy, setFindBusy] = useState(false);
  const [findLimit, setFindLimit] = useState(8);
  const [noPic, setNoPic] = useState<Record<string, number | null>>({});
  const findAsked = useRef(0);
  // Which list is open (see VIEWS above). Kept in the address (?status=) so
  // Back from a store returns to the same list.
  const [view, setView] = useState<StoreView>("live");
  const [typeFilter, setTypeFilter] = useState("all");
  // SORT BY (Mock 178, Sana 10 Oct 2026: "the default is by A-Z"). Kept in the
  // address (?sort=newest) so Back from a store page returns to the same order;
  // a fresh visit has no ?sort= and so opens at Name A-Z.
  const [sortBy, setSortBy] = useState<StoreSort>(DEFAULT_STORE_SORT);
  const [actioningRestaurantId, setActioningRestaurantId] = useState<string | null>(null);
  const [editCommissionId, setEditCommissionId] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState("");
  const [editFeeId, setEditFeeId] = useState<string | null>(null);
  const [feeValue, setFeeValue] = useState("");
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Malls folded away with the ▾ arrow (fix 5). Searching opens them again.
  const [closedMalls, setClosedMalls] = useState<Set<string>>(new Set());
  const toggleMall = (id: string) => setClosedMalls((was) => {
    const now = new Set(was);
    if (now.has(id)) now.delete(id); else now.add(id);
    return now;
  });

  // Let another page hand us a store to look at, e.g. Store Reliability linking
  // "Habib Cafe" straight here instead of asking you to find it in a long list.
  //
  // Read from window rather than useSearchParams: that hook forces the page
  // into a Suspense boundary at build time, and a missing one has already
  // broken a Vercel build on this project once.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) setSearch(q);
      setSortBy(readStoreSort(params.get("sort")));
      setView(readView(params.get("status")));
      const t = params.get("type");
      if (t && VERTICALS.some((v) => v.value === t)) setTypeFilter(t);
    } catch {
      /* no query string; nothing to prefill */
    }
    setAddressRead(true);
  }, []);

  // THE LIST REMEMBERS ITSELF (fix 7, audit O7). Which list, the order, the
  // search and the store type are kept in the address - no new Back step - and
  // remembered for this tab, so "← All stores" on a store's page comes back to
  // exactly this. Not written until the address above has been read, so the
  // first, empty draw never wipes it.
  const [addressRead, setAddressRead] = useState(false);
  useEffect(() => {
    if (!addressRead) return;
    const query = listQuery({ view, sort: sortBy, defaultSort: DEFAULT_STORE_SORT, search, type: typeFilter });
    try {
      const url = new URL(window.location.href);
      if (url.search !== query) {
        window.history.replaceState(window.history.state, "", `${url.pathname}${query}${url.hash}`);
      }
    } catch {
      /* the list still works; only the memory is skipped */
    }
    rememberListQuery(query);
  }, [addressRead, view, sortBy, search, typeFilter]);

  /** Choose an order, and write it into the address WITHOUT a new history
   *  step - so Back still leaves the page, but returns to this order. */
  const chooseSort = (value: string) => {
    const next = readStoreSort(value);
    setSortBy(next);
    try {
      const url = new URL(window.location.href);
      if (next === DEFAULT_STORE_SORT) url.searchParams.delete("sort");
      else url.searchParams.set("sort", next);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* the order still changes on screen; only the memory is skipped */
    }
  };

  /** Open one list, and write it into the address the same way as the sort. */
  const chooseView = (next: StoreView) => {
    setView(next);
    try {
      const url = new URL(window.location.href);
      if (next === "live") url.searchParams.delete("status");
      else url.searchParams.set("status", next);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* the list still changes on screen; only the memory is skipped */
    }
  };

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

  // Create-store form — Mock 74 + Mock 75 (parts-create-store.tsx).
  const [createOpen, setCreateOpen] = useState(false);

  const vendorTypeOf = (r: any) => (r.vendor_type || "").trim() || "restaurant";

  /** Is this shop on the map at all? 0,0 is in the Atlantic, not in Swat, and
   *  it is what an unset pin looks like in the database. */
  const hasPin = (r: any) => {
    const la = Number(r?.latitude ?? 0);
    const lo = Number(r?.longitude ?? 0);
    return isFinite(la) && isFinite(lo) && !(la === 0 && lo === 0);
  };

  // Which shop types a RIDER carries, from the server. The difference matters
  // on this screen: a shop with no pin that ships by parcel is untidy, and one
  // a rider carries is invisible.
  const [expressTypes, setExpressTypes] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    expressShopTypes().then((t) => { if (alive) setExpressTypes(t); });
    return () => { alive = false; };
  }, []);

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

  /*  COMMISSION - AN EMPTY BOX MEANS "USE THE GLOBAL RATE".
   *
   *  Same rule as the delivery fee beside it: empty is NOT zero. A shop with
   *  no rate of its own is charged the global rate from Settings; a shop
   *  deliberately set to 0 is charged nothing. Confuse the two and a shop
   *  stops paying commission without anybody noticing - which is exactly what
   *  happened to one pharmacy, saved as 0% and then impossible to put back.
   *
   *  This used to REFUSE an empty box and tell the admin to "press the X",
   *  but the X is Cancel: it closed the editor and changed nothing, so there
   *  was no way at all to clear a rate once it had been set. Now an empty box
   *  clears it, through the same endpoint, recorded in the audit trail.
   */
  const saveCommission = async (restaurantId: string) => {
    const raw = commissionValue.trim();
    let val: number | null = null;
    if (raw !== "") {
      val = parseFloat(raw);
      if (isNaN(val) || val < 0 || val > 100) {
        toast("Enter a commission between 0 and 100, or leave it empty for the global rate", "error");
        return;
      }
    }
    try {
      setActioningRestaurantId(restaurantId);
      await apiClient.setRestaurantCommission(restaurantId, val);
      setEditCommissionId(null);
      toast(
        val === null
          ? "This shop is back on the global rate"
          : `Commission set to ${val}% for this shop`,
        "success"
      );
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update commission", "error");
    } finally {
      setActioningRestaurantId(null);
    }
  };

  // ONE read when the page opens. Changing list no longer asks the server
  // again: the server never filtered by status (it ignored ?status=), so every
  // change of the old dropdown reloaded the whole list for nothing.
  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getRestaurants({}) as any;
      setRestaurants(response?.restaurants || response?.data || []);
      // THE WAITING SHOPS' CHECKLISTS (fix 2). Their own read, after the
      // list: if it fails, the list still shows and only the checklist rows
      // are missing.
      try {
        const w = await apiClient.getWaitingChecklists() as any;
        const by: Record<string, Checklist> = {};
        for (const s of (w?.shops || []) as Checklist[]) by[String(s.id)] = s;
        setChecklists(by);
      } catch {
        setChecklists({});
      }
    } catch (err) {
      setError(readFailure(err, "the shop list"));
    } finally {
      setLoading(false);
    }
  };

  // MAIN ADMIN may approve a shop with fewer than 5 products, after a window
  // that asks first (Mock 165, Sana 6 Oct 2026). The server checks it too.
  const [isMain, setIsMain] = useState(false);
  useEffect(() => setIsMain(getMyPerms().isSuper), []);
  const [anyway, setAnyway] = useState<any>(null);
  // THE SERVER'S REFUSAL, KEPT UNDER THE SHOP IT IS ABOUT (audit 202, A3).
  // A toast fades in a few seconds; "still missing: Shop logo" or "the
  // checklist could not be read" (503) is what the person needs to act on.
  const [refused, setRefused] = useState<{ id: string; message: string } | null>(null);

  const handleApprove = async (restaurantId: string, approveAnyway = false) => {
    try {
      setActioningRestaurantId(restaurantId);
      setRefused(null);
      const res: any = await apiClient.approveRestaurant(restaurantId, approveAnyway);
      setAnyway(null);
      // Mock 207: the server says whether it stays hidden from customers.
      toast(res?.shown_to_customers === false
        ? "Store approved - hidden from customers until you switch on Show to customers"
        : "Store approved", "success");
      await fetchRestaurants();
      refreshWaitingShopsCount();
    } catch (err) {
      const said = err instanceof Error ? err.message : "Failed to approve";
      toast(said, "error");
      // Close the "anyway" box so the message under the row can be seen.
      setAnyway(null);
      setRefused({ id: String(restaurantId), message: said });
    } finally {
      setActioningRestaurantId(null);
    }
  };

  // APPROVE ALL READY (audit 23 October 2026). One approve per shop, one
  // after another - the server checks every one exactly as for a single
  // click, and a shop it refuses keeps its reason under its row. Asked
  // first, because approving opens shops to customers.
  const [bulkAsk, setBulkAsk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const approveAllReady = async () => {
    setBulkBusy(true);
    setRefused(null);
    let ok = 0;
    const failed: { name: string; why: string }[] = [];
    for (const r of readyToApprove) {
      try {
        await apiClient.approveRestaurant(String(r.id), false);
        ok++;
      } catch (err) {
        failed.push({ name: r.name || "A shop", why: err instanceof Error ? err.message : "refused" });
      }
    }
    setBulkBusy(false);
    setBulkAsk(false);
    const res = approveAllResult(ok, failed);
    toast(res.text, res.kind);
    await fetchRestaurants();
    refreshWaitingShopsCount();
  };

  // "APPROVE AFTER ALL" FOR A REJECTED SHOP (audit 202, A3). The waiting
  // list's checklists leave rejected shops out, but the server checks the
  // whole checklist for them too. So this ONE shop's checklist is read when
  // the button is pressed - never one read per row for the whole list.
  const approveAfterAll = async (restaurant: any) => {
    const id = String(restaurant.id);
    let list: Checklist | undefined;
    try {
      setActioningRestaurantId(id);
      setRefused(null);
      list = await apiClient.getShopChecklist(id) as Checklist;
      setChecklists((was) => ({ ...was, [id]: list as Checklist }));
    } catch {
      list = undefined;   // not read: the server checks it on Approve
    } finally {
      setActioningRestaurantId(null);
    }
    const a = approveWithChecklist(approveState(restaurant, isMain), missingForApproval(list), isMain);
    if (a.button === "approve") return handleApprove(id);
    if (a.button === "anyway") return setAnyway(restaurant);
    setRefused({ id, message: `Not ready yet. ${a.why}.` });
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

  // REJECT CARRIES THE REASON THE OWNER IS TOLD (Mock 161, admin audit M14).
  const runPending = async (reason?: string) => {
    if (!pending) return;
    const { store, action } = pending;
    try {
      setActioningRestaurantId(store.id);
      if (action === "reject") {
        await apiClient.rejectRestaurant(store.id, reason || "");
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
  // A shop turned down is REJECTED, not pending (migration 121, Mock 161).
  // MOCK 207 (migration 146): "hidden" = Takal approved it (approved_at),
  // customers do not see it yet. lib/store-status.ts holds the same rule.
  const deriveStatus = (r: any) =>
    r.is_suspended ? "suspended"
      : r.is_approved ? "approved"
      : r.rejected_at ? "rejected"
      : r.approved_at ? "hidden"
      : "pending";

  // APPROVE ALL READY - which shops. It MUST stay BELOW deriveStatus: it runs
  // while the page draws, and deriveStatus does not exist until its line has
  // run. Above it, the Stores page crashed for everyone ("Cannot access
  // before initialization") the moment a shop was waiting (26 Oct 2026).
  // Never a shop Takal SENT BACK for changes (Mock 207): its checklist only says
  // things are THERE - the vendor has not yet fixed what the reviewer asked for.
  const readyToApprove = restaurants.filter((r) => deriveStatus(r) === "pending"
    && reviewStateOf(r) !== "sent_back"
    // Half-way through a review with something marked Needs fix: the Review
    // page will not approve it, so neither does this button (26 Oct 2026).
    && !(Number(r.review_to_fix) > 0)
    && withChecklist(approveState(r, isMain), checklists[String(r.id)], isMain).button === "approve"
    && !!checklists[String(r.id)]?.ready);

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

  // REMOVE FOR GOOD (D1, Sana 12 Oct 2026): Main Admin only, a rejected shop
  // with no orders and no reviews. The server checks all of that again and
  // keeps a full copy in the office record before anything is removed.
  const [removing, setRemoving] = useState<any>(null);
  // CLOSING A SHOP ASKS FIRST (fix 8, Sana 12 Oct 2026: "OK fix 8"; audit O9).
  // One stray click on the green "Open" used to stop a shop's orders at once.
  // Opening stays one click: it harms nobody.
  const [closing, setClosing] = useState<any>(null);
  const handleRemoveForGood = async () => {
    if (!removing) return;
    try {
      setActioningRestaurantId(removing.id);
      const res = await apiClient.removeRestaurantForGood(String(removing.id)) as any;
      toast(res?.message || `${removing.name} was removed for good`, "success");
      await fetchRestaurants();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove the shop", "error");
    } finally {
      setActioningRestaurantId(null);
      setRemoving(null);
    }
  };

  /** Live, with fewer than 5 products - the "Need attention" list. */
  const needsAttention = (r: any) =>
    deriveStatus(r) === "approved" && typeof r.product_count === "number"
    && r.product_count < MIN_PRODUCTS;
  const inView = (r: any, v: StoreView) =>
    v === "attention" ? needsAttention(r)
      : v === "live" ? deriveStatus(r) === "approved"
      : deriveStatus(r) === v;
  const viewCount = (v: StoreView) => restaurants.filter((r) => inView(r, v)).length;

  // The Rejected list leaves out Open now, Commission and Delivery fee.
  // ── MOCK 203-1 v2: finding products in every store ───────────────────────
  const findProducts = async (words: string, show: "all" | "no_picture", limit: number) => {
    const mine = ++findAsked.current;
    if (show === "all" && !words.trim()) { setFound(null); return; }
    setFindBusy(true);
    try {
      const res = await apiClient.findProductsInEveryStore(words, show, limit);
      if (mine === findAsked.current) setFound({ ...res, show, words });
    } catch (err) {
      if (mine === findAsked.current) {
        setFound(null);
        toast(err instanceof Error ? err.message : "The products could not be searched", "error");
      }
    } finally {
      if (mine === findAsked.current) setFindBusy(false);
    }
  };
  // Typing waits until the person stops, so a word is one request.
  useEffect(() => {
    if (findMode !== "products") return;
    const t = setTimeout(() => findProducts(productWords, "all", findLimit), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productWords, findMode, findLimit]);
  // Each store's "📷 No picture" number - asked AFTER the list is drawn, so
  // the list is never slower.
  useEffect(() => {
    const ids = restaurants.map((r) => String(r.id)).filter(Boolean);
    if (!ids.length) return;
    let alive = true;
    apiClient.getNoPictureCounts(ids).then((r) => { if (alive) setNoPic(r.counts || {}); }).catch(() => { /* a dash */ });
    return () => { alive = false; };
  }, [restaurants]);
  const noPicTotal = Object.values(noPic).reduce<number>((a, b) => a + (b || 0), 0);
  const flipFound = async (p: FoundProduct) => {
    const wanted = !p.is_available;
    try {
      const res = (await apiClient.toggleMenuItem(p.id, wanted)) as any;
      const on = res?.is_available !== undefined ? res.is_available === true : wanted;
      setFound((f) => (f ? { ...f, items: f.items.map((x) => (x.id === p.id ? { ...x, is_available: on } : x)) } : f));
      toast(on ? `${p.name} is ON` : `${p.name} is OFF`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Not changed - try again", "error");
    }
  };

  const slim = view === "rejected";
  const cols = slim ? 4 : 7;   // fix 4: shop, type and owner are one column

  const filteredRestaurants = restaurants.filter((r) => {
    // The mall's name counts too (fix 5): "wakeel" finds every Wakeel store.
    const matchesSearch = `${r.name || ""} ${r.mall_name || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = inView(r, view);
    const matchesType = typeFilter === "all" || vendorTypeOf(r) === typeFilter;
    const matchesReady = view !== "pending" || passesReady(checklists[String(r.id)], readyFilter);
    return matchesSearch && matchesStatus && matchesType && matchesReady;
  });
  // The boxes above chose WHICH stores; this puts them in the chosen order.
  const sortedByChoice = sortStores(filteredRestaurants, sortBy, {
    statusOf: deriveStatus,
    typeLabelOf: (r) => verticalLabel(vendorTypeOf(r)),
  });
  // THE WAITING LIST IN THE ORDER TO WORK IT (audit 23 October 2026 + Mock 207):
  // FIXED shops first, then New, then Sent back - and inside each group the
  // audit's order (ready first, then waiting longest) unless a person chose a
  // sort. sortByReview keeps the order it is given inside a group.
  const sortedRestaurants = view === "pending"
    ? sortByReview(sortBy === DEFAULT_STORE_SORT ? waitingOrder(sortedByChoice, checklists) : sortedByChoice)
    : sortedByChoice;
  // MALL STORES UNDER THEIR MALL (fix 5): a yellow mall row, its stores
  // indented under it. While searching nothing is folded away.
  // THE WAITING LIST BY REVIEW (Mock 207-1): shops a vendor has FIXED come
  // first, then new ones, then the ones sent back and waiting for the vendor.
  // Inside each, the order chosen above is kept.
  const fixedWaiting = restaurants.filter((r) => deriveStatus(r) === "pending" && reviewStateOf(r) === "fixed");
  const listRows = groupByMall(sortedRestaurants, restaurants, deriveStatus,
    search.trim() ? new Set<string>() : closedMalls);

  // The colours that used to be listed here disagreed with the Riders page:
  // "suspended" was GREY here and RED there, for one meaning. Both now read
  // from the single map in src/components/ui/theme.ts. The icons are kept.
  const getStatusBadge = (status: string) => {
    // "rejected" is also an ORDER status ("Shop refused"), so the application
    // label is written here rather than looked up.
    if (status === "rejected") {
      return <Badge tone="bad" icon={<XCircle className="w-3 h-3" />}>Rejected</Badge>;
    }
    if (status === "hidden") {
      return <Badge tone="good" icon={<CheckCircle2 className="w-3 h-3" />}>Approved</Badge>;
    }
    const Icon =
      status === "approved" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
    return <StatusBadge status={status} icon={<Icon className="w-3 h-3" />} />;
  };

  return (
    <div className="space-y-2.5">
      {/* MOCK 188/189 (Sana 14 Oct 2026: "This screen also too spreader"): the
          "All Stores" heading and its sentence are gone - the tab above
          already says it - and "+ Create store" / "Refresh" sit at the end of
          the search row. */}
      {error && (
        <ErrorState message={error.message} onRetry={fetchRestaurants} denied={error.denied} />
      )}

      {/* A VENDOR SENT A SHOP BACK FIXED (Mock 207-1). Said at the top of the
          page, not only on the row - the browser alert is missed when the
          panel is already open. */}
      {!loading && fixedWaiting.length > 0 && (
        <div data-fixed-shops className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-takal-yellow bg-black px-3 py-2 text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-takal-yellow" />
          <b className="text-[13.5px] text-takal-yellow">
            {fixedWaiting.length === 1 ? "A shop was fixed - ready to check" : `${fixedWaiting.length} shops were fixed - ready to check`}
          </b>
          <span className="text-[12.5px]">
            {fixedWaiting.slice(0, 3).map((r) => r.name).join(", ")}{fixedWaiting.length > 3 ? ` and ${fixedWaiting.length - 3} more` : ""} changed what you asked and sent it back.
          </span>
          <Link href={`/dashboard/stores/${fixedWaiting[0].id}/review`}
            className="ml-auto rounded-lg bg-takal-yellow px-3 py-1 text-[12.5px] font-bold text-black hover:bg-takal-yellow-dark">
            Review now
          </Link>
        </div>
      )}

      {/* THE LISTS, AS COUNT BUTTONS (fix 1; one small row since Mock 189).
          Click one to open it. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => {
          const on = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => chooseView(v.key)}
              aria-pressed={on}
              title={`${v.label} - ${v.hint}`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] text-takal-ink transition ${
                on ? "border-2 border-takal-ink shadow-[0_2px_0_#111]" : "border-[1.5px] border-takal-line hover:border-takal-ink-soft"}`}
            >
              <span className={`h-2 w-2 rounded-full ${v.dot}`} />
              <b className="text-[15px] font-extrabold">{loading ? "…" : viewCount(v.key)}</b>
              <span className="font-semibold">{v.label}</span>
              {v.key === "attention" && <span className="text-[11.5px] text-takal-ink-soft">· {v.hint}</span>}
            </button>
          );
        })}
        {/* Inside Waiting: ready to approve / still missing something. */}
        {view === "pending" && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border-[1.5px] border-takal-line bg-white p-0.5" role="group" aria-label="Which waiting shops">
            {READY_FILTERS.map((f) => (
              <button key={f.key} type="button" aria-pressed={readyFilter === f.key}
                onClick={() => setReadyFilter(f.key)}
                className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${
                  readyFilter === f.key ? "bg-takal-ink text-white" : "text-takal-ink hover:bg-takal-page"}`}>
                {f.label}
              </button>
            ))}
          </span>
        )}
        {view === "pending" && readyToApprove.length > 0 && canAccess("stores.approve") && (
          <button type="button" data-approve-all-ready onClick={() => setBulkAsk(true)} disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-takal-green px-3 py-1 text-[13px] font-extrabold text-white disabled:opacity-60">
            ✓ {approveAllLabel(readyToApprove.length)}
          </button>
        )}
        {/* MOCK 203-1 v2: every store's products that still need a picture. */}
        <button type="button" data-no-picture-everywhere
          onClick={() => { setFindLimit(40); findProducts("", "no_picture", 40); }}
          title="List the products of every store that still have no picture"
          className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#F5B5BC] bg-takal-red-soft px-3 py-1 text-[13px] font-semibold text-takal-red hover:border-takal-red">
          📷 No picture <b className="text-[14px] font-extrabold">{Object.keys(noPic).length ? noPicTotal.toLocaleString() : "…"}</b>
        </button>
      </div>

      {/* ONE ROW (fix 1, audit S4). Every select in the panel is 100% wide by
          default (globals.css), so these three each took a whole row; w-auto
          gives them their own width again. */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[12rem]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-takal-disabled-text" />
              <input
                type="text"
                placeholder={findMode === "products" ? "Find a product in any store…" : "Search by store name…"}
                value={findMode === "products" ? productWords : search}
                onChange={(e) => (findMode === "products" ? setProductWords(e.target.value) : setSearch(e.target.value))}
                aria-label={findMode === "products" ? "Find a product in any store" : "Search stores"}
                className="w-full pl-9 pr-[150px] py-1.5 text-sm bg-white border-2 border-takal-ink rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
              />
              {/* Products | Stores (MOCK 203-1 v2). */}
              <span className="absolute right-1 top-1 inline-flex overflow-hidden rounded-md border border-takal-line text-[12px] font-bold" role="group" aria-label="Search for">
                {(["products", "stores"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={findMode === m}
                    onClick={() => { setFindMode(m); if (m === "stores") setFound(null); setFindLimit(8); }}
                    className={`px-2.5 py-0.5 ${findMode === m ? "bg-black text-takal-yellow" : "bg-white text-takal-ink-soft hover:bg-takal-page"}`}>
                    {m === "products" ? "Products" : "Stores"}
                  </button>
                ))}
              </span>
              {found && (
                <div data-found-products className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[60vh] overflow-auto rounded-xl border border-takal-line bg-white shadow-xl">
                  <div className="flex items-center gap-2 border-b border-takal-line px-3 py-1.5 text-[12px] text-takal-ink-soft">
                    {found.show === "no_picture" ? <>Products with <b className="text-takal-ink">no picture</b> in every store</>
                      : <>Products matching &ldquo;<b className="text-takal-ink">{found.words}</b>&rdquo; in all stores</>}
                    {" · "}{found.total == null ? "–" : found.total.toLocaleString()} found
                    {findBusy && <span className="ml-1">…</span>}
                    <button type="button" onClick={() => setFound(null)} className="ml-auto rounded px-1.5 hover:bg-takal-page" aria-label="Close">✕</button>
                  </div>
                  {/* read-safe: `found` is set only by a search that answered - a failed one clears it. */}
                  {found.items.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-takal-ink-soft">Nothing found.</p>
                  ) : found.items.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 border-b border-[#F0F0F0] px-3 py-1.5 text-sm">
                      {p.image_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        : <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-[#C9C600] bg-takal-yellow-soft font-black">＋</span>}
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-takal-ink">{p.name}</b>
                        <span className="block truncate text-[11.5px] text-takal-ink-soft">{[p.store_name, p.shelf].filter(Boolean).join(" · ")}</span>
                      </div>
                      <b className="whitespace-nowrap">{p.price != null ? money(p.price) : "–"}</b>
                      <button role="switch" aria-checked={p.is_available} aria-label={`${p.is_available ? "Turn off" : "Turn on"} ${p.name}`}
                        onClick={() => flipFound(p)}
                        className={`relative inline-block h-[20px] w-9 rounded-full ${p.is_available ? "bg-takal-green" : "bg-[#C9C9C9]"}`}>
                        <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white transition-all ${p.is_available ? "right-[3px]" : "left-[3px]"}`} />
                      </button>
                      <Link href={`/dashboard/stores/${p.restaurant_id}?product=${encodeURIComponent(p.id)}&find=${encodeURIComponent(p.name)}`}
                        className="rounded-lg border border-takal-line px-2 py-0.5 text-[12px] font-bold hover:bg-takal-page">Open ›</Link>
                    </div>
                  ))}
                  {found.total != null && found.total > found.items.length && (
                    <button type="button" onClick={() => {
                      const more = Math.min(40, found.items.length + 20);
                      setFindLimit(more);
                      findProducts(found.words, found.show, more);
                    }} className="w-full px-3 py-2 text-left text-[12.5px] font-bold text-takal-blue hover:bg-takal-page">
                      Show more ({Math.min(40, found.total).toLocaleString()} at most here) ›
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Store type"
            className="w-auto max-w-[180px] px-3 py-1.5 text-sm bg-white border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          >
            <option value="all">All Store Types</option>
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>

          {/* SORT BY (Mock 178): the same look as the two boxes above, bold so
              it reads as the order, not another filter. */}
          <select
            aria-label="Sort by"
            title="Sort by"
            value={sortBy}
            onChange={(e) => chooseSort(e.target.value)}
            className="w-auto max-w-[190px] px-3 py-1.5 text-sm bg-white border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none font-semibold"
          >
            {STORE_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-3 py-1.5 text-sm bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition font-bold whitespace-nowrap"
          >
            + Create store
          </button>
          <button
            onClick={fetchRestaurants}
            className="px-3 py-1.5 text-sm bg-white border border-takal-line hover:bg-takal-page rounded-lg transition font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Shop · type · owner</th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Status</th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Products</th>
                {!slim && (<>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Open now</th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Commission</th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft">Delivery fee</th>
                </>)}
                {/* ACTIONS STAY IN SIGHT (fix 4): pinned to the right edge, so on a
                    laptop the buttons are never scrolled off the screen. */}
                <th className="sticky right-0 z-10 bg-takal-page px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-takal-ink-soft shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.15)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                /* As many as the headings above (7, or 4 in Rejected). It said 6 once, which drew a
                   skeleton one column narrower than the table it stood in. */
                <SkeletonRows rows={8} cols={cols} />
              ) : error ? (
                <tr>
                  <td colSpan={cols} className="px-6 py-10 text-center text-takal-ink-soft">
                    The shop list could not be read, so nothing can be listed here.
                    Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="px-6 py-8 text-center text-takal-ink-soft">
                    {search.trim() || typeFilter !== "all"
                      ? "No shop in this list matches your search."
                      : view === "rejected" ? "No rejected shops."
                      : view === "pending" ? "No shop is waiting for approval."
                      : view === "hidden" ? "Every approved shop is shown to customers."
                      : view === "suspended" ? "No shop is suspended."
                      : view === "attention" ? `Every live shop has at least ${MIN_PRODUCTS} products.`
                      : "No live shops."}
                  </td>
                </tr>
              ) : (
                listRows.map((row) => row.kind === "mall" ? (
                  <tr key={`mall-${row.mallId}`} className="border-b border-[#F2D27A] bg-takal-yellow-soft">
                    <td colSpan={cols} className="px-4 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button type="button" onClick={() => toggleMall(row.mallId)}
                          aria-expanded={!closedMalls.has(row.mallId) || !!search.trim()}
                          title={closedMalls.has(row.mallId) ? "Show this mall's stores" : "Fold this mall's stores away"}
                          className="rounded px-1 text-base leading-none text-takal-ink hover:bg-white/60">
                          {closedMalls.has(row.mallId) && !search.trim() ? "▸" : "▾"}
                        </button>
                        <span className="font-bold text-takal-ink">🛍 {row.mallName}</span>
                        <span className="rounded-full bg-takal-ink px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">MALL</span>
                        <span className="text-xs text-takal-ink">
                          {row.total} store{row.total === 1 ? "" : "s"} · {row.live} live
                          {row.suspended > 0 ? ` · ${row.suspended} suspended` : ""}
                          {row.shown < row.total ? ` · ${row.shown} in this list` : ""}
                        </span>
                        {row.owner && <span className="text-xs text-takal-ink-soft">· {row.owner}</span>}
                        <Link href={`/dashboard/stores/malls/${row.mallId}`}
                          className="ml-auto rounded-lg border border-takal-ink bg-white px-3 py-1 text-xs font-semibold text-takal-ink hover:bg-takal-page">
                          Open mall ›
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (() => { const restaurant = row.r; return (
                  <Fragment key={restaurant.id}>
                  <tr className={`${deriveStatus(restaurant) === "pending" && checklists[String(restaurant.id)] ? "" : "border-b"} border-takal-line hover:bg-takal-page`}>
                    {/* SHOP · TYPE · OWNER IN ONE CELL (fix 4, 12 Oct 2026). Three
                        columns used to hold these, and a long mall-store name
                        wrapped onto 4-6 lines. Now: the name on at most two
                        lines (the whole name on hover), then the type (still
                        changeable with the pencil) and the owner in small
                        writing underneath. */}
                    <td className={`py-1.5 pr-3 text-sm min-w-[240px] max-w-[320px] ${row.inMall ? "pl-10 border-l-4 border-l-[#F2D27A]" : "pl-4"}`}>
                      <div className="flex items-center gap-2">
                      {/* The store's logo (MOCK 203-1 v2). */}
                      <span className="h-[26px] w-[26px] shrink-0 overflow-hidden rounded-md bg-[#F2F2EE] text-center text-sm leading-[26px]">
                        {restaurant.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={restaurant.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : verticalEmoji(vendorTypeOf(restaurant))}
                      </span>
                      <Link href={`/dashboard/stores/${restaurant.id}`} title={restaurant.name || ""}
                        className="line-clamp-1 font-semibold leading-snug text-takal-ink hover:underline">
                        {row.inMall ? `↳ ${shortStoreName(restaurant.name, restaurant.mall_name)}` : (restaurant.name || "N/A")}
                      </Link>
                      </div>
                      {/* NO MAP PIN — SAID HERE, NOT ONLY INSIDE THE SHOP.
                          A shop with no map point is INVISIBLE to customers if
                          a rider carries its orders: there is no distance to
                          measure. The shop's own page has said so for a while,
                          but nobody opens forty shops one at a time to find
                          out, so it could sit there for weeks. It is on the
                          list now, in red, next to the name. */}
                      {!hasPin(restaurant) && (
                        <Link
                          href={`/dashboard/stores/${restaurant.id}`}
                          title={expressTypes.includes(vendorTypeOf(restaurant))
                            ? "This shop is hidden from customers until it is placed on the map."
                            : "This shop has no map point, so distances to it are wrong."}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        >
                          No map pin
                          {expressTypes.includes(vendorTypeOf(restaurant)) && " · hidden"}
                        </Link>
                      )}
                      {/* A PHARMACY'S LICENCE (Mock 208-4): missing, run out
                          or about to - said on the list, in its colour. A
                          licence that is fine says nothing here. */}
                      {LICENCE_FLAG.includes(restaurant.licence_state) && (
                        <Link href={`/dashboard/stores/${restaurant.id}?tab=settings`} data-licence-flag={restaurant.licence_state}
                          title="Open the store - Settings - Pharmacy licence"
                          className={`ml-1 mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold hover:underline ${LICENCE_STATE[restaurant.licence_state as LicenceState].tone}`}>
                          {LICENCE_STATE[restaurant.licence_state as LicenceState].label}
                        </Link>
                      )}
                      <div className="mt-0.5 flex items-center gap-x-2 whitespace-nowrap overflow-hidden text-xs text-takal-ink-soft">
                      {editTypeId === restaurant.id ? (
                        <select
                          autoFocus
                          defaultValue={vendorTypeOf(restaurant)}
                          disabled={actioningRestaurantId === restaurant.id}
                          onChange={(e) => saveVendorType(restaurant.id, e.target.value)}
                          onBlur={() => setEditTypeId(null)}
                          className="px-2 py-1 border border-takal-line rounded text-sm"
                        >
                          {/* verticalOptions: the shop's CURRENT type is always
                              an option, even one this list does not offer, so the
                              box never pretends a shop is "Food". */}
                          {verticalOptions(vendorTypeOf(restaurant)).map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.emoji} {v.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-px rounded-full text-[11px] font-medium bg-slate-100 text-takal-ink">
                            {verticalEmoji(vendorTypeOf(restaurant))} {verticalLabel(vendorTypeOf(restaurant))}
                          </span>
                          {/* The type picks the commission rate: "Shop money"
                              only (money audit B19, 13 Oct 2026). */}
                          {canAccess("stores.money") && (
                          <button
                            onClick={() => setEditTypeId(restaurant.id)}
                            className="text-takal-ink hover:text-takal-ink"
                            title="Change store type"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          )}
                        </span>
                      )}
                        <span className="truncate">· {restaurant.owner_name || restaurant.email || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(deriveStatus(restaurant))}
                        {/* SHOW TO CUSTOMERS (Mock 207-6): the switch and what
                            it means, on every approved shop. Main Admin only. */}
                        {(deriveStatus(restaurant) === "approved" || deriveStatus(restaurant) === "hidden") && (
                          <span className="inline-flex items-center gap-1.5">
                            <CustomersSeeSwitch shop={restaurant} isMain={isMain} onChanged={fetchRestaurants} />
                            <CustomersSeeChip shop={restaurant} />
                          </span>
                        )}
                        {/* THE REVIEW (Mock 207-1): New, Sent back, FIXED. */}
                        {deriveStatus(restaurant) === "pending" && (() => {
                          const rs = reviewStateOf(restaurant);
                          if (rs === "fixed") return (
                            <span className="whitespace-nowrap rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-takal-yellow"
                              title={restaurant.resubmitted_at ? `Sent back fixed ${new Date(restaurant.resubmitted_at).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}` : ""}>
                              ● FIXED · check again
                            </span>);
                          if (rs === "sent_back") return (
                            <span className="whitespace-nowrap rounded-full bg-takal-orange-soft px-2 py-0.5 text-[11px] font-bold text-[#B23E10]">
                              Sent back · {restaurant.review_fixes || 0} to fix
                            </span>);
                          // Started but not sent back yet: say how far it got.
                          const half = reviewingLine(restaurant);
                          if (half) return (
                            <span data-reviewing className="whitespace-nowrap rounded-full border border-black bg-takal-yellow-soft px-2 py-0.5 text-[11px] font-bold text-black">
                              {half}
                            </span>);
                          return (
                            <span className="whitespace-nowrap rounded-full bg-takal-blue-soft px-2 py-0.5 text-[11px] font-bold text-takal-blue">
                              New · not reviewed yet
                            </span>);
                        })()}
                        {deriveStatus(restaurant) === "rejected" && (
                          <p className="mt-1 max-w-xs text-xs leading-snug text-takal-red">
                            {rejectedLine(restaurant.rejected_reason, restaurant.rejected_at)}
                          </p>
                        )}
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
                    {/* PRODUCTS (Mock 165; fix 1). Counted for EVERY shop now -
                        a live shop with too few products used to show a dash.
                        Live and under 5: an orange warning. Not live yet: how
                        far it is from the 5 it needs before approval. */}
                    <td className="px-3 py-1.5 text-sm">
                      {(() => {
                        const a = approveState(restaurant, isMain);
                        // MOCK 203-1 v2: "📷 3" - this store's products still with no picture.
                        const np = noPic[String(restaurant.id)];
                        const picChip = np ? (
                          <Link href={`/dashboard/stores/${restaurant.id}`} title={`${np} product${np === 1 ? "" : "s"} with no picture`}
                            className="ml-1.5 inline-flex items-center rounded-full bg-takal-red-soft px-2 py-0.5 text-[11px] font-bold text-takal-red hover:underline">
                            📷 {np.toLocaleString()}
                          </Link>
                        ) : null;
                        if (a.count === null) return <span className="text-takal-ink-soft">—{picChip}</span>;
                        if (deriveStatus(restaurant) !== "pending") return (
                          <span className="inline-flex items-center whitespace-nowrap">
                            <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              a.enough ? "text-takal-ink" : "bg-takal-orange-soft text-takal-ink"}`}>
                              {a.enough ? "" : "⚠ "}{a.count} product{a.count === 1 ? "" : "s"}
                            </span>
                            {picChip}
                          </span>
                        );
                        return (
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            a.enough ? "bg-takal-green-soft text-takal-green" : "bg-takal-orange-soft text-takal-ink"}`}>
                            {a.enough ? `✓ ${a.count} products` : `${a.count} of ${MIN_PRODUCTS}`}
                          </span>
                        );
                      })()}
                    </td>
                    {/* A REJECTED shop sells nothing: no Open switch, rate or fee to
                        show - and its two buttons then fit on a laptop (fix 1). */}
                    {!slim && (<>
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
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <button
                        onClick={() => restaurant.is_open ? setClosing(restaurant) : toggleOpen(restaurant)}
                        disabled={togglingId === restaurant.id}
                        title={
                          restaurant.is_open
                            ? "Open — customers can order. Click to close."
                            : "Closed — customers cannot order. Click to open."
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
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
                        // Beside the switch, on the same line (Mock 189).
                        <span className="ml-1.5 whitespace-nowrap text-[11px] text-amber-700"
                          title={`The switch is on, but customers see it closed because of its opening hours${
                            restaurant.opening_time && restaurant.closing_time ? ` (${restaurant.opening_time}–${restaurant.closing_time})` : ""}`}>
                          closed by hours
                          {/* The hours themselves from 1280 px; on a smaller
                              screen they are in the hover text. */}
                          <span className="hidden xl:inline">
                            {restaurant.opening_time && restaurant.closing_time
                              ? ` ${restaurant.opening_time}–${restaurant.closing_time}`
                              : " now"}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-sm text-takal-ink-soft">
                      {restaurant.price_mode === "fixed" ? (
                        // A FIXED-PRICE store (Mock 171-3, Step 5d): Takal earns
                        // selling - buying, so there is no commission to set and
                        // the server refuses one (restaurants_admin.py). Locked.
                        <span className="inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-0.5 text-xs font-bold text-takal-yellow"
                          title="Fixed-price store - no commission, no markup. Its prices are set on the store's Products tab.">
                          🔒 Fixed-price - no commission
                        </span>
                      ) : editCommissionId === restaurant.id ? (
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
                            <span className="text-takal-ink-soft whitespace-nowrap">
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
                    <td className="px-3 py-1.5 text-sm text-takal-ink-soft">
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
                            <span className="text-takal-ink-soft whitespace-nowrap">Standard rule</span>
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
                    </>)}
                    {/* THE ACTION LINKS WERE TAILWIND'S COLOURS, NOT TAKAL'S,
                        and "Suspend" was yellow - the one thing the Brand Kit
                        forbids, because yellow is Takal's own colour and never
                        means a warning. Suspend is now the orange chip the
                        Brand Kit gives to "needs you", with black writing on
                        it, so it is both on-brand and readable. */}
                    <td className="sticky right-0 bg-white px-3 py-1.5 text-sm shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.15)]"><div className="flex flex-wrap items-center gap-2">
                      {deriveStatus(restaurant) === "pending" && (
                        <>
                          {/* REVIEW (Mock 207-2): everything on one page, OK or
                              Needs fix, then Approve or Send back. */}
                          {canAccess("stores.approve") && (
                            <Link href={`/dashboard/stores/${restaurant.id}/review`}
                              className={`whitespace-nowrap rounded-md border-[1.5px] border-takal-ink px-2.5 py-1 font-bold ${
                                reviewStateOf(restaurant) === "sent_back" ? "bg-white text-takal-ink hover:bg-takal-page"
                                : "bg-takal-yellow text-takal-ink hover:bg-takal-yellow-dark"}`}>
                              {reviewStateOf(restaurant) === "fixed" ? "Review again"
                                : reviewStateOf(restaurant) === "sent_back" ? "Open review" : "Review"}
                            </Link>
                          )}
                          {(() => {
                            const a = withChecklist(approveState(restaurant, isMain),
                              checklists[String(restaurant.id)], isMain);
                            if (a.button === "approve") return (
                              <button
                                onClick={() => handleApprove(restaurant.id)}
                                disabled={actioningRestaurantId === restaurant.id}
                                className="text-takal-green hover:underline font-medium disabled:opacity-50"
                              >
                                Approve
                              </button>);
                            if (a.button === "anyway") return (
                              <button
                                onClick={() => setAnyway(restaurant)}
                                disabled={actioningRestaurantId === restaurant.id}
                                className="rounded-md border border-takal-ink bg-white px-2 py-1 font-semibold text-takal-ink hover:bg-takal-page disabled:opacity-50"
                              >
                                Approve anyway
                              </button>);
                            return (
                              <span className="flex flex-col">
                                <button disabled className="text-left font-medium text-takal-disabled-text cursor-not-allowed">
                                  Approve
                                </button>
                                <span className="text-xs text-takal-ink-soft">{a.why}</span>
                              </span>);
                          })()}
                          <button
                            onClick={() => setPending({ store: restaurant, action: "reject" })}
                            disabled={actioningRestaurantId === restaurant.id}
                            className="text-takal-red hover:underline font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {/* Changed your mind: approves the shop, tells the owner,
                          and the red label and reason go away. */}
                      {deriveStatus(restaurant) === "rejected" && (
                        (() => {
                          // The same 5-product rule (Mock 165).
                          const a = approveState(restaurant, isMain);
                          if (a.button === "none") return (
                            <span className="text-xs text-takal-ink-soft">{a.why}</span>);
                          return (
                            <button
                              onClick={() => a.button === "anyway"
                                ? setAnyway(restaurant) : approveAfterAll(restaurant)}
                              disabled={actioningRestaurantId === restaurant.id}
                              className="rounded-md border border-takal-line bg-white px-2 py-1 font-semibold text-takal-ink hover:bg-takal-page disabled:opacity-50"
                            >
                              {a.button === "anyway" ? "Approve anyway" : "Approve after all"}
                            </button>);
                        })()
                      )}
                      {/* REMOVE FOR GOOD (D1) - the Main Admin only; asks first. */}
                      {deriveStatus(restaurant) === "rejected" && isMain && (
                        <button
                          onClick={() => setRemoving(restaurant)}
                          disabled={actioningRestaurantId === restaurant.id}
                          className="whitespace-nowrap rounded-md border border-red-200 bg-red-50 px-2 py-1 font-semibold text-takal-red hover:bg-red-100 disabled:opacity-50"
                        >
                          Remove for good
                        </button>
                      )}
                      {(deriveStatus(restaurant) === "approved" || deriveStatus(restaurant) === "hidden") && (
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
                      {/* Why the server said no to Approve, in its own words. */}
                      {refused?.id === String(restaurant.id) && (
                        <p role="alert" data-testid="approve-refused"
                          className="basis-full max-w-[20rem] rounded-md border-l-4 border-takal-red bg-takal-red-soft px-2 py-1 text-xs font-semibold text-takal-red">
                          {refused.message}
                        </p>
                      )}
                      </div>
                    </td>
                  </tr>
                  {/* WHAT IS STILL MISSING (fix 2): the seven checks of a
                      waiting shop, right under it - green ticks done, orange
                      crosses still to do - and how long it has waited. */}
                  {deriveStatus(restaurant) === "pending" && checklists[String(restaurant.id)] && (() => {
                    const c = checklists[String(restaurant.id)];
                    return (
                      <tr className="border-b border-takal-line">
                        <td colSpan={cols} className="px-6 pb-4 pt-0">
                          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-takal-page px-3 py-2">
                            <span className={`mr-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              c.ready ? "bg-takal-green-soft text-takal-green" : "bg-takal-orange-soft text-takal-ink"}`}>
                              {c.done} of {c.total} done
                            </span>
                            {c.steps.map((s) => (
                              <span key={s.key} title={s.note || s.label}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  s.done ? "bg-takal-green-soft text-takal-green" : "bg-red-50 text-takal-red"}`}>
                                {s.done ? "✓" : "✕"} {s.label}
                                {!s.done && s.key === "products" && s.note ? ` (${s.note})` : ""}
                              </span>
                            ))}
                            {/* TELL THE VENDOR WHAT IS LEFT - without rejecting
                                the shop to say it (audit 23 October 2026). */}
                            {(() => {
                              const wa = whatsappLink(shopPhone(restaurant), whatIsLeftMessage(restaurant.name, c.what_is_left));
                              return wa ? (
                                <a href={wa} target="_blank" rel="noopener noreferrer"
                                  title="Open WhatsApp with the list of what is still missing, ready to send"
                                  className="inline-flex items-center gap-1 rounded-full border border-[#25D366] bg-white px-2.5 py-0.5 text-xs font-bold text-[#128C7E] hover:bg-[#E9FBEF]">
                                  WhatsApp what is left
                                </a>
                              ) : null;
                            })()}
                            {c.days_waiting != null && (
                              <span className="ml-auto text-xs text-takal-ink-soft">
                                Waiting {c.days_waiting === 0 ? "since today" : `${c.days_waiting} day${c.days_waiting === 1 ? "" : "s"}`}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                  </Fragment>
                ); })())
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreateStoreWizard
          onClose={() => setCreateOpen(false)}
          onCreated={() => { fetchRestaurants(); }}
        />
      )}

      <RejectReasonDialog
        open={pending?.action === "reject"}
        busy={actioningRestaurantId !== null}
        title="Reject this store?"
        name={pending?.store?.name || "This store"}
        who="the owner"
        consequence="will be turned down. Their shop will not appear to customers."
        suggestions={SHOP_REASONS}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => runPending(reason)}
      />

      {/* APPROVE ANYWAY - the main admin only, a shop with fewer than 5
          products (Mock 165, Sana 6 Oct 2026). */}
      <ConfirmDialog
        open={anyway !== null}
        busy={actioningRestaurantId !== null}
        onCancel={() => setAnyway(null)}
        onConfirm={() => anyway && handleApprove(anyway.id, true)}
        title={`Approve ${anyway?.name || "this shop"} as it is?`}
        confirmLabel="Approve anyway"
        message={
          <>
            Shops normally need at least {MIN_PRODUCTS} products, and everything on
            their checklist, before they go live. Only the main admin can approve
            without them.
            {/* What is still missing, from the waiting shop's checklist (fix 2). */}
            {anyway && (checklists[String(anyway.id)]?.what_is_left || []).length > 0 && (
              <span className="mt-3 block text-takal-ink">
                <b>Still missing:</b> {checklists[String(anyway.id)].what_is_left.join(", ")}.
              </span>
            )}
            <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
              It stays <b>hidden from customers</b> until the main admin switches on
              Show to customers (Mock 207) — it has {anyway?.product_count ?? 0}{" "}
              product{anyway?.product_count === 1 ? "" : "s"} now.
            </span>
          </>
        }
      />
      {/* APPROVE ALL READY - asked first (audit 23 October 2026). */}
      <ConfirmDialog
        open={bulkAsk}
        busy={bulkBusy}
        title={approveAllLabel(readyToApprove.length) + "?"}
        message={`These shops have every check ticked. They will be approved and stay HIDDEN from customers until the main admin switches on Show to customers: ${
          readyToApprove.slice(0, 8).map((r) => r.name).join(", ")}${readyToApprove.length > 8 ? ` and ${readyToApprove.length - 8} more` : ""}.`}
        confirmLabel="Yes, approve them"
        cancelLabel="Not now"
        onCancel={() => setBulkAsk(false)}
        onConfirm={approveAllReady}
      />

      <ConfirmDialog
        open={removing !== null}
        busy={actioningRestaurantId !== null}
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemoveForGood}
        title={`Remove ${removing?.name || "this shop"} for good?`}
        confirmLabel="Yes, remove for good"
        message={
          <>
            <strong>{removing?.name || "This shop"}</strong> and its products will be
            deleted. <strong>This cannot be undone.</strong>
            <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
              Only a rejected shop with no orders and no reviews can be removed.
              A full copy is kept in the office record first. If the owner has no
              other shop, his login is switched off.
            </span>
          </>
        }
      />

      <ConfirmDialog
        open={pending?.action === "suspend"}
        busy={actioningRestaurantId !== null}
        onCancel={() => setPending(null)}
        onConfirm={() => runPending()}
        title="Suspend this store?"
        confirmLabel="Yes, suspend"
        message={
          <>
            <strong>{pending?.store?.name || "This store"}</strong> will stop
            taking orders straight away. You can un-suspend them later.
          </>
        }
      />

      <ConfirmDialog
        open={closing !== null}
        busy={togglingId !== null}
        onCancel={() => setClosing(null)}
        onConfirm={async () => { const r = closing; setClosing(null); if (r) await toggleOpen(r); }}
        title={`Close ${closing?.name || "this store"}?`}
        confirmLabel="Yes, close it"
        message={
          <>
            Customers cannot order from <strong>{closing?.name || "this store"}</strong> until
            it is opened again. Orders already placed carry on as normal.
          </>
        }
      />
    </div>
  );
}
