"use client";

/**
 * ORDERS — the list.
 *
 * REBUILT 2 September 2026, after the audit in ORDERS-AUDIT.md. Approved by
 * Sana as mock-up 12.
 *
 * WHAT WAS WRONG WITH THE OLD ONE, in the order it mattered:
 *
 *  1. Customer and Restaurant said "N/A" on EVERY row of EVERY order ever
 *     placed. The server sent the order row, which carries a customer NUMBER
 *     and no name, and nothing looked the name up.
 *  2. Two of its six status filters - "Cooking" and "Delivering" - are words
 *     this system has never used. Choosing either showed an empty page, for
 *     ever. Seven statuses that DO exist were missing from the list: on the
 *     real 34 test orders, five orders were unreachable by any filter here.
 *  3. Search filtered the fifty rows already on the screen, on the two fields
 *     that were always empty. An order from last week could not be found.
 *  4. It never said how many orders there are. Just "Page 1" - while the
 *     server was already sending the real total and the panel threw it away.
 *  5. Cancelling asked `window.prompt()`, the browser's grey box, which cannot
 *     show the order and can be switched off entirely by the browser.
 *  6. Six columns out of the sixty-one things an order knows. Nothing said
 *     whether it was an Express order or a Standard parcel, who was carrying
 *     it, what Takal earned, or how long it had been sitting.
 *
 * THE ONE IDEA BEHIND THE NEW ONE: the chips along the top are the questions
 * the office actually asks - "who is waiting on the shop", "what is ready with
 * nobody to carry it", "what is late". Each carries its live count, so nobody
 * presses one to find an empty page.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Download, UserPlus, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { toast } from "@/lib/toast";
import { money, fmtDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { errorMessage } from "@/lib/api-errors";
import {
  ErrorState,
  Button,
  Badge,
  OrderStatusBadge,
  ORDER_STATUS_ORDER,
  orderStatusLabel,
} from "@/components/ui";
import { OrderPanel } from "./parts-order-panel";
import {
  CancelOrderDialog,
  MoveOrderDialog,
  AssignRiderDialog,
} from "./parts-order-dialogs";

const PAGE_SIZE = 50;

/** The chips, in the order they are shown. The keys must match QUEUES in the
 *  backend's routers/orders_desk.py - the count and the list you get when you
 *  press one come from the same place on purpose, so they cannot disagree. */
const CHIPS: { key: string; label: string; alert?: boolean }[] = [
  { key: "", label: "All" },
  { key: "needs_shop", label: "Needs the shop" },
  { key: "cooking", label: "Cooking" },
  { key: "ready_no_rider", label: "Ready, no rider" },
  { key: "on_the_way", label: "On the way" },
  { key: "at_office", label: "At an office" },
  { key: "late", label: "Late", alert: true },
  { key: "refund_return", label: "Refund or return", alert: true },
  { key: "delivered_today", label: "Delivered today" },
];

/** THE LITTLE MARKS ON A ROW.
 *
 * Approved by Sana on mock-up 12. Each one is something that would otherwise
 * be invisible until somebody opened the order - and the whole point of a list
 * is not having to open every order to find the one that needs you.
 *
 * The 0% mark is INFORMATION, not a warning. Sana confirmed on 2 September
 * 2026 that the pharmacy is deliberately on no commission. It is shown so that
 * nobody looks at a delivered order earning nothing and assumes something is
 * broken - and so that nobody "fixes" it either. */
function flagsFor(o: any): { key: string; text: string; title: string; tone: string }[] {
  const out: { key: string; text: string; title: string; tone: string }[] = [];
  if (o.delivery_code_bypassed_by)
    out.push({
      key: "code",
      text: "NO CODE",
      title: "Closed without the customer's 4-digit code",
      tone: "bg-takal-ink text-takal-yellow",
    });
  if (o.refunded || o.return_status)
    out.push({
      key: "back",
      text: "↩",
      title: o.return_status ? `Return: ${o.return_status}` : "Refunded",
      tone: "bg-takal-red-soft text-takal-red",
    });
  if (o.notes)
    out.push({
      key: "note",
      text: "✎",
      title: o.notes,
      tone: "bg-slate-100 text-takal-ink-soft",
    });
  if (o.status === "delivered" && Number(o.commission || 0) === 0 && Number(o.subtotal || 0) > 0)
    out.push({
      key: "zero",
      text: "0%",
      title: "No commission is taken from this shop. This is deliberate.",
      tone: "bg-takal-blue-soft text-takal-blue",
    });
  return out;
}

/** A whole day, in the shape the date inputs use. */
const today = () => new Date().toISOString().slice(0, 10);

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [counts, setCounts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  // Filters
  const [searchBox, setSearchBox] = useState("");
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [payment, setPayment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");

  // Selection, for the one bulk action there is.
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Windows
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelOrder, setCancelOrder] = useState<any | null>(null);
  const [moveOrder, setMoveOrder] = useState<any | null>(null);
  const [moveTo, setMoveTo] = useState<string[]>([]);
  const [assignFor, setAssignFor] = useState<any[] | null>(null);
  const [riders, setRiders] = useState<any[]>([]);
  const [riderError, setRiderError] = useState("");

  // THE SEARCH BOX WAITS. Every keystroke used to be a filter; now every
  // keystroke would be a request. A short pause after typing stops is the
  // difference between one request and fifteen.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchBox.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [searchBox]);

  const filters = useMemo(
    () => ({
      queue,
      status,
      search,
      delivery_type: type,
      payment_method: payment,
      date_from: dateFrom,
      date_to: dateTo,
      sort,
    }),
    [queue, status, search, type, payment, dateFrom, dateTo, sort]
  );

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        setError("");
        const res = (await apiClient.getOrders(page, PAGE_SIZE, filters)) as any;
        setOrders(res?.orders || res?.data || []);
        // The server sends the REAL total. The old page ignored it and said
        // "Page 1" for ever.
        setTotal(
          typeof res?.total === "number"
            ? res.total
            : typeof res?.count === "number"
            ? res.count
            : null
        );
        setPicked(new Set());
      } catch (err) {
        if (!silent) {
          setError(errorMessage(err, "the orders"));
          setOrders([]);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, filters]
  );

  const loadCounts = useCallback(async () => {
    try {
      const res = (await apiClient.getOrderCounts()) as any;
      setCounts(res?.queues || {});
    } catch {
      // A chip with no number is a smaller loss than a page that will not open.
      setCounts({});
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Quietly, every 30 seconds - but never while a window is open, because
  // refreshing the list under somebody's hands is how a wrong order gets
  // cancelled.
  useEffect(() => {
    const t = setInterval(() => {
      if (!openId && !cancelOrder && !moveOrder && !assignFor) {
        load(true);
        loadCounts();
      }
    }, 30000);
    return () => clearInterval(t);
  }, [openId, cancelOrder, moveOrder, assignFor, load, loadCounts]);

  const chipCount = (key: string) => {
    if (!key) return counts.all?.count;
    return counts[key]?.count;
  };

  const pressChip = (key: string) => {
    setPage(1);
    setStatus("");
    if (key === "delivered_today") {
      setQueue("");
      setStatus("delivered");
      setDateFrom(today());
      setDateTo(today());
      return;
    }
    setDateFrom("");
    setDateTo("");
    setQueue(queue === key ? "" : key);
  };

  const clearFilters = () => {
    setQueue("");
    setStatus("");
    setType("");
    setPayment("");
    setDateFrom("");
    setDateTo("");
    setSearchBox("");
    setSort("newest");
    setPage(1);
  };

  const anyFilter =
    queue || status || type || payment || dateFrom || dateTo || search;

  const openAssign = async (list: any[]) => {
    setAssignFor(list);
    setRiderError("");
    try {
      const res = (await apiClient.getRiders({})) as any;
      setRiders(
        (res?.riders || res?.data || []).filter(
          (r: any) => r.is_approved && !r.is_suspended
        )
      );
    } catch (err) {
      // The rider list is guarded by the "riders" permission, not "orders". An
      // admin who handles orders and nothing else used to be told "No approved
      // riders available", which is a false statement about the world and
      // leaves them nothing to do about it.
      setRiders([]);
      setRiderError(errorMessage(err, "riders"));
    }
  };

  const doAssign = async (riderId: string) => {
    const list = assignFor || [];
    try {
      if (list.length === 1) {
        await apiClient.assignRider(list[0].id, riderId);
        toast("Rider assigned", "success");
      } else {
        const res = (await apiClient.bulkAssignRider(
          riderId,
          list.map((o) => o.id)
        )) as any;
        toast(res?.message || "Done.", res?.refused?.length ? "info" : "success");
        // Say WHICH ones could not be given, not just how many. "3 of 5" with
        // no names is not something anybody can act on.
        (res?.refused || []).forEach((r: any) =>
          toast(`#${String(r.order_id).slice(0, 8)} — ${r.why}`, "error")
        );
      }
      setAssignFor(null);
      await load();
      await loadCounts();
    } catch (err) {
      toast(errorMessage(err, "the rider"), "error");
    }
  };

  const doCancel = async (reason: string) => {
    try {
      await apiClient.cancelOrder(cancelOrder.id, reason);
      toast("Order cancelled", "success");
      setCancelOrder(null);
      setOpenId(null);
      await load();
      await loadCounts();
    } catch (err) {
      toast(errorMessage(err, "the cancellation"), "error");
    }
  };

  const doMove = async (newStatus: string, reason: string) => {
    try {
      await apiClient.moveOrder(moveOrder.id, newStatus, reason);
      toast(`Moved to ${orderStatusLabel(newStatus)}`, "success");
      setMoveOrder(null);
      setOpenId(null);
      await load();
      await loadCounts();
    } catch (err) {
      toast(errorMessage(err, "the move"), "error");
    }
  };

  const toggle = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignable = orders.filter(
    (o) => !["delivered", "cancelled", "rejected"].includes(o.status) && !o.is_pickup
  );
  const pickedOrders = orders.filter((o) => picked.has(o.id));

  const pageSum = orders.reduce((a, o) => a + Number(o.total_amount || 0), 0);
  const pageKeep = orders.reduce(
    (a, o) => a + Number(o.takal?.earned || 0),
    0
  );

  return (
    <div className="space-y-5">
      {/* ── HEAD ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">All Orders</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-takal-ink-soft">
            {total == null ? "Manage all orders and tracking" : (
              <>
                <b className="text-takal-ink">{total.toLocaleString()}</b> orders
              </>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-takal-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-takal-green" />
              Live
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() =>
              downloadCsv("orders.csv", orders, [
                { key: "id", label: "Order ID" },
                { key: "created_at", label: "Placed" },
                { key: "delivery_type", label: "Type" },
                { key: "customer_name", label: "Customer" },
                { key: "customer_phone", label: "Customer phone" },
                { key: "restaurant_name", label: "Shop" },
                { key: "rider_name", label: "Rider" },
                { key: "hub_name", label: "Office" },
                { key: "status", label: "Status" },
                { key: "payment_method", label: "Payment" },
                { key: "total_amount", label: "Amount" },
                { key: "delivery_fee", label: "Delivery fee" },
                { key: "refund_amount", label: "Refunded" },
                { key: "delivery_address", label: "Address" },
              ]) || toast("Nothing to export.", "info")
            }
          >
            Export this page
          </Button>
          <Button icon={<RefreshCw className="h-4 w-4" />} onClick={() => { load(); loadCounts(); }}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} denied={error.includes("permission")} onRetry={load} />}

      {/* ── THE QUESTIONS THE OFFICE ASKS ── */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const n = chipCount(c.key);
          const on = c.key === "delivered_today"
            ? status === "delivered" && dateFrom === today()
            : queue === c.key && !status;
          return (
            <button
              key={c.key || "all"}
              onClick={() => pressChip(c.key)}
              className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-bold transition ${
                on
                  ? "border-takal-ink bg-takal-yellow text-takal-ink"
                  : c.alert
                  ? "border-[#F0C0C6] bg-white text-takal-red hover:bg-takal-red-soft"
                  : "border-takal-line bg-white text-takal-ink-soft hover:bg-takal-page"
              }`}
            >
              {c.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  on
                    ? "bg-takal-ink text-takal-yellow"
                    : c.alert
                    ? "bg-takal-red text-white"
                    : "bg-slate-100 text-takal-ink"
                }`}
              >
                {n == null ? "…" : n < 0 ? "?" : n}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── FILTERS ── */}
      <div className="rounded-lg border border-takal-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-takal-disabled-text" />
            <input
              value={searchBox}
              onChange={(e) => setSearchBox(e.target.value)}
              placeholder="Search any order, customer, phone, shop, rider or address — across all orders"
              className="w-full rounded-lg border-2 border-takal-line py-2 pl-10 pr-4 outline-none focus:border-takal-yellow"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setPage(1); setQueue(""); setStatus(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          >
            {/* Every status the system really has, and only those. */}
            <option value="">Status: all</option>
            {ORDER_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{orderStatusLabel(s)}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => { setPage(1); setType(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          >
            <option value="">Type: all</option>
            <option value="instant">Express</option>
            <option value="standard">Parcel</option>
          </select>
          <select
            value={payment}
            onChange={(e) => { setPage(1); setPayment(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          >
            <option value="">Payment: all</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setPage(1); setDateFrom(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setPage(1); setDateTo(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          />
          <select
            value={sort}
            onChange={(e) => { setPage(1); setSort(e.target.value); }}
            className="rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="biggest">Biggest first</option>
            <option value="smallest">Smallest first</option>
          </select>
          {anyFilter ? (
            <button
              onClick={clearFilters}
              className="rounded-lg border-2 border-[#F0C0C6] px-3 py-2 text-sm font-bold text-takal-red hover:bg-takal-red-soft"
            >
              Clear filters ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* ── THE ONE BULK ACTION ── */}
      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-takal-ink px-4 py-3 text-sm font-bold text-white">
          <span>
            {picked.size} order{picked.size === 1 ? "" : "s"} selected
          </span>
          <button
            onClick={() => openAssign(pickedOrders)}
            className="rounded-lg border-2 border-takal-yellow bg-takal-yellow px-3 py-1.5 text-xs font-bold text-takal-ink"
          >
            Assign a rider
          </button>
          <button
            onClick={() => setPicked(new Set())}
            className="rounded-lg border-2 border-slate-600 px-3 py-1.5 text-xs"
          >
            Clear selection
          </button>
          <span className="ml-auto text-xs font-normal text-slate-400">
            Cancel and refund are deliberately not here — those stay one order at
            a time
          </span>
        </div>
      )}

      {/* ── THE LIST ── */}
      <div className="overflow-hidden rounded-lg border border-takal-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page text-left">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select every order that can take a rider"
                    checked={assignable.length > 0 && picked.size === assignable.length}
                    onChange={(e) =>
                      setPicked(
                        e.target.checked ? new Set(assignable.map((o) => o.id)) : new Set()
                      )
                    }
                  />
                </th>
                {["ORDER", "TYPE", "CUSTOMER", "SHOP", "CARRIED BY"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-black tracking-wide text-takal-ink-soft">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-black tracking-wide text-takal-ink-soft">AMOUNT</th>
                <th className="px-4 py-3 text-right text-xs font-black tracking-wide text-takal-ink-soft">TAKAL KEEPS</th>
                {["PAY", "STATUS", "AGE", "FLAGS", ""].map((h, i) => (
                  <th key={h || i} className="px-4 py-3 text-xs font-black tracking-wide text-takal-ink-soft">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={13} />
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-10 text-center text-takal-ink-soft">
                    {anyFilter ? (
                      <>
                        No orders match what you asked for.{" "}
                        <button onClick={clearFilters} className="font-bold underline">
                          Clear the filters
                        </button>{" "}
                        to see everything.
                      </>
                    ) : (
                      "No orders yet."
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const canTakeRider =
                    !["delivered", "cancelled", "rejected"].includes(o.status) &&
                    !o.is_pickup;
                  return (
                    <tr key={o.id} className="border-b border-takal-line hover:bg-takal-page">
                      <td className="px-4 py-3">
                        {canTakeRider && (
                          <input
                            type="checkbox"
                            aria-label={`Select order ${String(o.id).slice(0, 8)}`}
                            checked={picked.has(o.id)}
                            onChange={() => toggle(o.id)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setOpenId(o.id)}
                          className="font-mono text-[13px] font-bold text-takal-ink hover:underline"
                        >
                          #{String(o.id).slice(0, 8)}
                        </button>
                        <div className="text-[11.5px] text-takal-ink-soft">
                          {fmtDate(o.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={o.delivery_type === "standard" ? "parcel" : "warn"}>
                          {o.delivery_type === "standard" ? "Parcel" : "Express"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-bold text-takal-ink">
                          {o.customer_name || <span className="text-takal-ink-soft">not named</span>}
                        </div>
                        {o.customer_phone && (
                          <div className="text-[11.5px] text-takal-ink-soft">{o.customer_phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-takal-ink-soft">
                        {o.restaurant_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {o.rider_name ? (
                          <>
                            <div className="font-bold text-takal-ink">{o.rider_name}</div>
                            <div className="text-[11.5px] text-takal-ink-soft">
                              rider {o.rider_is_online ? "· online" : "· offline"}
                            </div>
                          </>
                        ) : o.hub_name ? (
                          <>
                            <div className="font-bold text-takal-ink">{o.hub_name}</div>
                            <div className="text-[11.5px] text-takal-ink-soft">Takal office</div>
                          </>
                        ) : o.is_pickup ? (
                          <span className="text-takal-ink-soft">customer collects</span>
                        ) : canTakeRider ? (
                          <Badge tone="bad">Nobody yet</Badge>
                        ) : (
                          <span className="text-takal-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-takal-ink">
                        {money(o.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">
                        {o.takal?.counted ? (
                          <span className={o.refunded ? "text-takal-red" : "text-takal-green"}>
                            {money(o.takal.earned)}
                          </span>
                        ) : (
                          <span className="text-takal-disabled-text">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{o.payment_method || "cash"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {o.age_minutes == null ? (
                          <span className="text-takal-ink-soft">—</span>
                        ) : (
                          <span className={o.is_late ? "font-bold text-takal-red" : "text-takal-ink-soft"}>
                            {o.age_minutes < 60
                              ? `${o.age_minutes} min`
                              : `${Math.floor(o.age_minutes / 60)} h ${o.age_minutes % 60} m`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {flagsFor(o).map((f) => (
                            <span
                              key={f.key}
                              title={f.title}
                              className={`inline-flex h-5 items-center justify-center rounded-md px-1.5 text-[10px] font-black ${f.tone}`}
                            >
                              {f.text}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOpenId(o.id)}
                            className="text-sm font-bold text-takal-ink hover:underline"
                          >
                            Open
                          </button>
                          {canTakeRider && !o.rider_id && (
                            <button
                              onClick={() => openAssign([o])}
                              className="inline-flex items-center gap-1 text-sm font-bold text-[#C8410F] hover:underline"
                            >
                              <UserPlus className="h-3.5 w-3.5" /> Assign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && orders.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-takal-ink bg-takal-page text-sm font-black">
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" colSpan={5}>
                    {orders.length} shown{total != null ? ` of ${total.toLocaleString()}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">{money(pageSum)}</td>
                  <td className="px-4 py-3 text-right text-takal-green">{money(pageKeep)}</td>
                  <td className="px-4 py-3" colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── PAGES ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          ← Previous
        </Button>
        <span className="text-sm text-takal-ink-soft">
          {total == null ? (
            <>Page {page}</>
          ) : total === 0 ? (
            "Nothing to show"
          ) : (
            <>
              Showing{" "}
              <b className="text-takal-ink">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </b>{" "}
              of <b className="text-takal-ink">{total.toLocaleString()}</b> · page{" "}
              {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </>
          )}
        </span>
        <Button
          variant="secondary"
          onClick={() => setPage((p) => p + 1)}
          disabled={
            loading ||
            (total != null ? page >= Math.ceil(total / PAGE_SIZE) : orders.length < PAGE_SIZE)
          }
        >
          Next →
        </Button>
      </div>

      <OrderPanel
        orderId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => { load(); loadCounts(); }}
        onCancel={(o) => setCancelOrder(o)}
        onMove={(o, canMoveTo) => { setMoveOrder(o); setMoveTo(canMoveTo); }}
        onAssign={(o) => openAssign([o])}
      />
      <CancelOrderDialog
        order={cancelOrder}
        onClose={() => setCancelOrder(null)}
        onDone={doCancel}
      />
      <MoveOrderDialog
        order={moveOrder}
        canMoveTo={moveTo}
        onClose={() => setMoveOrder(null)}
        onDone={doMove}
      />
      <AssignRiderDialog
        open={!!assignFor}
        orders={assignFor || []}
        riders={riders}
        riderError={riderError}
        onClose={() => setAssignFor(null)}
        onDone={doAssign}
      />
    </div>
  );
}
