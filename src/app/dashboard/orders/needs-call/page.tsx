"use client";

/**
 * ORDERS -> NEEDS A CALL  (Mock 198, board 3 - approved by Sana, 15 Oct 2026).
 *
 * Sana: "The Office Phone her". A shop marked an item "Not available"; the
 * customer was asked in her app and did not answer in 10 minutes. Each order
 * here is a red card: her name and number, big, with Call now; what is
 * missing and the total now; and the three answers after the call. The order's
 * history sits beside it.
 *
 * Read again every 30 seconds while the page is open - a new one can arrive
 * at any minute, and one answered on another computer must leave.
 */

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { readFailure } from "@/lib/api-errors";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { NeedsCallCard } from "../parts-item-change";
import { refreshNeedsCallCount } from "@/lib/hooks/useNeedsCallCount";

export default function NeedsCallPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiClient.getNeedsCall();
      setRows(r?.orders || []);
      setReady(r?.ready !== false);
      setError("");
      setDenied(false);
    } catch (err) {
      const f = readFailure(err, "the orders that need a call");
      setError(f.message);
      setDenied(f.denied);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 1000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <LoadingState label="Reading the orders that need a call…" />;
  if (error) return <ErrorState message={error} denied={denied} onRetry={load} />;

  return (
    <div className="space-y-6 pt-2">
      {!ready ? (
        <EmptyState
          title="Not switched on yet"
          message="Needs a call starts working once the database has its newest update (migration 135)."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nobody needs a call right now"
          message="When a shop marks an item not available and the customer does not answer in her app within 10 minutes, the order appears here."
        />
      ) : (
        rows.map((row) => (
          <NeedsCallCard key={row.order_id || row.id} row={row}
            onDone={() => { load(); refreshNeedsCallCount(); }} />
        ))
      )}
    </div>
  );
}
