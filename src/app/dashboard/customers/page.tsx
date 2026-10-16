"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Trash2, Download, ChevronRight, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { SkeletonRows } from "@/components/Skeletons";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import { ConfirmDialog, ErrorState } from "@/components/ui";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { fmtDate } from "@/lib/format";
import {
  customerCounts, isMadeUpEmail, isNew, matchesFilter, phoneLooksRight, type CustomerFilter,
} from "@/lib/customers-list";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [show, setShow] = useState<CustomerFilter>("all");
  // The server could not count the orders (Mock 200): say so, never show 0s.
  const [ordersUnknown, setOrdersUnknown] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiClient.getCustomers()) as any;
      setCustomers(res?.users || res?.data || []);
      setOrdersUnknown(res?.orders_unknown === true);
    } catch (err) {
      setError(readFailure(err, "the customer list"));
    } finally {
      setLoading(false);
    }
  };

  // THE BROWSER'S OWN GREY BOX IS GONE FROM THIS PAGE.
  // window.confirm cannot say what actually happens, cannot be styled, and on
  // a phone reads as the browser complaining rather than Takal asking. Both
  // questions here are now the panel's own window, saying the person's name
  // and what the action really does.
  const [pending, setPending] = useState<
    { customer: any; action: "block" | "unblock" | "delete" } | null
  >(null);

  const doToggleActive = async (c: any) => {
    const makeActive = c.is_active === false;
    try {
      setBusyId(String(c.id));
      await apiClient.updateCustomer(String(c.id), { is_active: makeActive });
      toast(makeActive ? "Customer unblocked" : "Customer blocked", "success");
      setPending(null);
      await fetchCustomers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update customer", "error");
    } finally {
      setBusyId(null);
    }
  };

  const doRemove = async (c: any) => {
    try {
      setBusyId(String(c.id));
      await apiClient.deleteCustomer(String(c.id));
      toast("Customer deleted", "success");
      setPending(null);
      await fetchCustomers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete (they may have order history)", "error");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = customers.filter(
    (c) =>
      matchesFilter(c, show) && (
      (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").toLowerCase().includes(search.toLowerCase()))
  );
  // Counted across everybody, not the search (Mock 200).
  const counts = customerCounts(customers);
  // The Orders / Last order columns appear once the server sends them.
  const knowsOrders = counts.never !== null;
  const CHIPS: { key: CustomerFilter; label: string; n: number | null; tone: string }[] = [
    { key: "all", label: "customers", n: counts.all, tone: "bg-takal-yellow border-takal-yellow-dark" },
    { key: "active", label: "active", n: counts.active, tone: "bg-takal-green-soft border-[#BFE0D2] text-takal-green" },
    { key: "blocked", label: "blocked", n: counts.blocked, tone: "bg-takal-red-soft border-[#F3C2C7] text-takal-red" },
    { key: "new", label: "new this week", n: counts.new, tone: "bg-takal-blue-soft border-[#C8DCEA] text-[#003D6B]" },
    ...(knowsOrders ? [{ key: "never" as const, label: "never ordered", n: counts.never, tone: "bg-takal-orange-soft border-[#FFD2BF] text-[#C8410F]" }] : []),
  ];
  const cols = knowsOrders ? 8 : 6;

  return (
    <div className="space-y-2.5">
      {/* ONE LINE (Mock 200): how many, which ones, search, Export, Refresh.
          "All Customers" and "16 registered customers" became the first chip. */}
      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map((ch) => (
          <button
            key={ch.key}
            data-customer-chip={ch.key}
            onClick={() => setShow(show === ch.key && ch.key !== "all" ? "all" : ch.key)}
            className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap transition ${
              show === ch.key ? `${ch.tone} font-bold text-takal-ink` : "bg-white border-takal-line text-takal-ink-soft hover:bg-takal-page"}`}
          >
            <b className="text-takal-ink">{ch.n}</b> {ch.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-2 w-4 h-4 text-takal-disabled-text" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none"
          />
        </div>
        <button
          onClick={() =>
            downloadCsv("customers.csv", filtered, [
              { key: "full_name", label: "Name" },
              { key: "phone", label: "Phone" },
              { key: "email", label: "Email" },
              { key: "is_active", label: "Active" },
              { key: "created_at", label: "Joined" },
              ...(knowsOrders ? [{ key: "orders_count", label: "Orders" }, { key: "last_order_at", label: "Last order" }] : []),
            ]) || toast("Nothing to export.", "info")
          }
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-takal-line rounded-lg hover:bg-takal-page transition"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button onClick={fetchCustomers} className="px-3 py-1.5 text-sm font-semibold bg-takal-yellow hover:bg-takal-yellow-dark text-takal-ink rounded-lg transition">
          Refresh
        </button>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={fetchCustomers} denied={error.denied} />
      )}

      {ordersUnknown && !error && (
        <p data-orders-unknown className="rounded-lg border border-[#FFD2BF] bg-takal-orange-soft px-3 py-1.5 text-sm text-[#C8410F]">
          The orders could not be counted just now, so <b>Orders</b>, <b>Last order</b> and
          &ldquo;never ordered&rdquo; are not shown. Press Refresh to try again.
        </p>
      )}

      <div className="bg-white rounded-lg border border-takal-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page">
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Name</th>
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Email</th>
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Joined</th>
                {knowsOrders && <th className="px-4 py-2 text-right text-xs font-black uppercase tracking-wide text-takal-ink-soft">Orders</th>}
                {knowsOrders && <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Last order</th>}
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Status</th>
                <th className="px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-takal-ink-soft">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={cols} />
              ) : error ? (
                <tr>
                  <td colSpan={cols} className="px-4 py-8 text-center text-takal-ink-soft">
                    The customer list could not be read, so nothing can be listed here.
                    Use <b>Try again</b> above.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={cols} className="px-4 py-6 text-center text-takal-ink-soft">No customers found</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} data-customer-row className="border-b border-takal-line hover:bg-takal-page">
                    <td className="px-4 py-2 text-sm font-semibold text-takal-ink whitespace-nowrap">
                      <Link href={`/dashboard/customers/${c.id}`} className="text-takal-ink hover:underline">
                        {c.full_name || "N/A"}
                      </Link>
                      {isNew(c.created_at) && (
                        <span className="ml-1.5 rounded-full bg-takal-blue-soft px-1.5 py-0.5 text-[10px] font-bold text-[#003D6B]">NEW</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-takal-ink-soft whitespace-nowrap">
                      {c.phone || "—"}
                      {/* The customer typed it; only they know the right one. */}
                      {!phoneLooksRight(c.phone) && (
                        <span data-phone-check className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-takal-orange-soft px-1.5 py-0.5 text-[10px] font-bold text-[#C8410F] cursor-help"
                          title="This does not look like a Pakistani mobile number (03xx xxxxxxx). The customer typed it - check it with them before calling.">
                          <AlertTriangle className="w-3 h-3" /> check
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-takal-ink-soft max-w-[16rem] truncate">
                      {/* A made-up address for a phone-only sign-up is not an email
                          anybody can write to - say what it is (Mock 200). */}
                      {isMadeUpEmail(c.email) ? (
                        <span data-phone-signup className="italic text-takal-disabled-text cursor-help"
                          title={`Signed up with a phone number only. The account system stores a made-up address (${c.email}) that cannot receive email.`}>
                          phone sign-up
                        </span>
                      ) : (
                        <span title={c.email || ""}>{c.email || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-takal-ink-soft whitespace-nowrap">{c.created_at ? fmtDate(c.created_at) : "—"}</td>
                    {knowsOrders && (
                      <td className="px-4 py-2 text-sm text-right tabular-nums">
                        {Number(c.orders_count ?? 0) > 0
                          ? <b className="text-takal-ink">{c.orders_count}</b>
                          : <span className="text-[#C8410F]">0</span>}
                      </td>
                    )}
                    {knowsOrders && (
                      <td className="px-4 py-2 text-sm text-takal-ink-soft whitespace-nowrap">
                        {c.last_order_at ? fmtDate(c.last_order_at) : "never"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.is_active === false ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        {c.is_active === false ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        {/* A visible way into the customer (Mock 200): the name
                            was the only link, and nothing said so. */}
                        <Link href={`/dashboard/customers/${c.id}`}
                          className="inline-flex items-center gap-0.5 rounded-md bg-takal-yellow px-2 py-1 text-xs font-bold text-takal-ink hover:bg-takal-yellow-dark">
                          View <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setPending({ customer: c, action: c.is_active === false ? "unblock" : "block" })}
                          disabled={busyId === String(c.id)}
                          // "Block" was yellow, which the Brand Kit forbids -
                          // yellow is Takal's own colour and never means a
                          // warning. It is now the orange chip with black
                          // writing, which is both on-brand and readable.
                          className={`text-xs font-medium disabled:opacity-50 ${
                            c.is_active === false
                              ? "text-takal-green hover:underline"
                              : "rounded-md bg-takal-orange-soft px-2 py-1 font-semibold text-takal-ink ring-1 ring-[#FFD2BF] hover:bg-[#FFE2D6]"
                          }`}
                        >
                          {c.is_active === false ? "Unblock" : "Block"}
                        </button>
                        <button
                          onClick={() => setPending({ customer: c, action: "delete" })}
                          disabled={busyId === String(c.id)}
                          className="text-takal-red hover:underline disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busyId !== null}
        onCancel={() => setPending(null)}
        danger={pending?.action === "delete"}
        title={
          pending?.action === "delete"
            ? "Delete this customer?"
            : pending?.action === "block"
            ? "Block this customer?"
            : "Unblock this customer?"
        }
        confirmLabel={
          pending?.action === "delete"
            ? "Yes, delete"
            : pending?.action === "block"
            ? "Yes, block"
            : "Yes, unblock"
        }
        message={
          pending?.action === "delete" ? (
            <>
              <b>{pending?.customer?.full_name || "This customer"}</b> and their
              account will be removed. This cannot be undone, and it will refuse
              if they already have orders on the system.
            </>
          ) : pending?.action === "block" ? (
            <>
              <b>{pending?.customer?.full_name || "This customer"}</b> will not
              be able to sign in or place an order. Their past orders stay
              exactly as they are. You can unblock them again at any time.
            </>
          ) : (
            <>
              <b>{pending?.customer?.full_name || "This customer"}</b> will be
              able to sign in and order again.
            </>
          )
        }
        onConfirm={() => {
          if (!pending) return;
          if (pending.action === "delete") doRemove(pending.customer);
          else doToggleActive(pending.customer);
        }}
      />
    </div>
  );
}
