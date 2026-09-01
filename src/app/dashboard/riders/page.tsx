"use client";

/**
 * RIDERS
 *
 * What changed here, and why:
 *
 * 1. REJECT NOW ASKS FIRST. It used to fire the instant you clicked it, sitting
 *    six lines away from Suspend, which did ask. Turning a rider away is at
 *    least as final as suspending one.
 * 2. THE TABLE STAYS ON THE SCREEN. The Actions column used to sit off the
 *    right edge on a normal laptop, so the buttons could not be reached
 *    without scrolling the whole page sideways.
 * 3. ONE STATUS COLOUR. "Suspended" was red here and grey on the Stores page,
 *    for the same meaning. Both now read from one map.
 * 4. A FAILED LOAD SAYS SO, AND OFFERS TO TRY AGAIN, instead of leaving a
 *    blank table.
 *
 * NOT CHANGED: every server call, in the same order, with the same arguments.
 * This is the same page doing the same work.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  Button, Card, Table, StatusBadge, ErrorState, EmptyState,
  ConfirmDialog, Money, type Column,
} from "@/components/ui";

type Rider = any;

/** A confirmation waiting for an answer. null = nothing pending. */
type Pending = { rider: Rider; action: "reject" | "suspend" } | null;

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const filters: any = {};
      if (statusFilter !== "all") filters.status = statusFilter;
      const response = (await apiClient.getRiders(filters)) as any;
      setRiders(response?.riders || response?.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load riders");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  /** One wrapper for every action, so they all behave the same: block the row
   *  while it runs, say what happened, then reload. */
  const run = async (
    riderId: string,
    work: () => Promise<any>,
    fallbackMessage: string
  ) => {
    try {
      setBusyId(riderId);
      const res = (await work()) as any;
      toast(res?.message || fallbackMessage, res?.still_blocked ? "info" : "success");
      await fetchRiders();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  const approve = (r: Rider) =>
    run(r.id, () => apiClient.approveRider(r.id), "Rider approved");

  // This lifts the ADMIN suspension and ONLY the admin suspension. A rider can
  // also be stopped automatically for holding too much of the office's cash,
  // and that block is not ours to wave away here. It used to flash a green
  // "Rider unsuspended" regardless, so a rider held by the cash limit gave a
  // success message and a row that still read Suspended. The server now
  // returns a sentence describing what actually happened; we show that.
  const unsuspend = (r: Rider) =>
    run(r.id, () => apiClient.unsuspendRider(r.id), "Rider unsuspended");

  const confirmPending = () => {
    if (!pending) return;
    const { rider, action } = pending;
    if (action === "reject") {
      run(rider.id, () => apiClient.rejectRider(rider.id), "Rider rejected");
    } else {
      run(rider.id, () => apiClient.suspendRider(rider.id), "Rider suspended");
    }
  };

  // Riders store full_name / phone (not name / email), and is_approved /
  // is_suspended (not status).
  const statusOf = (r: Rider) =>
    r.is_suspended ? "suspended" : r.is_approved ? "approved" : "pending";

  const filtered = riders.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || statusOf(r) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<Rider>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => (
        <Link
          href={`/dashboard/riders/${r.id}`}
          className="font-semibold text-takal-ink hover:underline"
        >
          {r.full_name || "N/A"}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      hideOnSmall: true,
      cell: (r) =>
        r.phone ? (
          <a href={`tel:${r.phone}`} className="text-takal-ink-soft hover:underline">
            {r.phone}
          </a>
        ) : (
          <span className="text-takal-disabled-text">N/A</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="space-y-1">
          <StatusBadge status={statusOf(r)} />
          {/* A red "Suspended" with nothing beside it tells an admin that
              something is wrong and not one thing more. The server sends the
              reason; show it. */}
          {r.is_suspended && r.suspended_reason && (
            <p className="max-w-xs text-xs leading-snug text-takal-ink-soft">
              {r.suspended_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "earnings",
      header: "Earnings",
      numeric: true,
      hideOnSmall: true,
      cell: (r) => <Money value={r.total_earnings} />,
    },
    {
      key: "deliveries",
      header: "Deliveries",
      numeric: true,
      hideOnSmall: true,
      cell: (r) => r.total_deliveries || 0,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => {
        const status = statusOf(r);
        const busy = busyId === r.id;
        return (
          <div className="flex flex-wrap gap-2">
            {status === "pending" && (
              <>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => approve(r)}>
                  Approve
                </Button>
                {/* Asks first now. It did not, and it is not undoable. */}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setPending({ rider: r, action: "reject" })}
                >
                  Reject
                </Button>
              </>
            )}

            {status === "approved" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setPending({ rider: r, action: "suspend" })}
              >
                Suspend
              </Button>
            )}

            {/* Un-suspend only appears when there IS an admin suspension to
                lift. A rider stopped purely by the cash limit used to be shown
                this button, which could not help them, and no route to the
                thing that could. */}
            {r.login_disabled && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => unsuspend(r)}>
                Unsuspend
              </Button>
            )}

            {/* A rider blocked by the cash limit is unblocked by recording
                the cash they hand in - and that now lives on the tab next
                door, in this same section, instead of on a different page in
                a different part of the sidebar. */}
            {r.cash_blocked && !r.login_disabled && (
              <Link href="/dashboard/riders/earnings">
                <Button size="sm" variant="subtle" icon={<Wallet className="w-4 h-4" />}>
                  Record cash handover
                </Button>
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  const pendingRider = pending?.rider;
  const pendingName = pendingRider?.full_name || "this rider";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">All Riders</h2>
          <p className="text-takal-ink-soft mt-1 text-sm">Approve new riders, and stop or restart an existing one.</p>
        </div>
        <Button onClick={fetchRiders} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchRiders} />}

      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-takal-disabled-text pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search riders"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(r) => String(r.id)}
          loading={loading}
          skeletonRows={8}
          empty={
            <EmptyState
              title="No riders found"
              message={
                search || statusFilter !== "all"
                  ? "Try clearing the search box or the status filter."
                  : "Riders appear here once they sign up in the Takal Riders app."
              }
            />
          }
        />
      </Card>

      <ConfirmDialog
        open={pending !== null}
        busy={busyId !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
        title={pending?.action === "reject" ? "Reject this rider?" : "Suspend this rider?"}
        confirmLabel={pending?.action === "reject" ? "Yes, reject" : "Yes, suspend"}
        message={
          pending?.action === "reject" ? (
            <>
              <strong>{pendingName}</strong> will be turned down and will not be
              able to take deliveries. They would have to apply again.
            </>
          ) : (
            <>
              <strong>{pendingName}</strong> will be stopped from taking any new
              deliveries straight away. You can un-suspend them later.
            </>
          )
        }
      />
    </div>
  );
}
