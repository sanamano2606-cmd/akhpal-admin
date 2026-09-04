"use client";

/**
 * DELETING A DISCOUNT CODE, AND THE THING THAT REPLACES IT.
 *
 * THE FAULT THIS REMOVES.
 * The bin used to be `window.confirm("Delete promo TAKAL1?")`. Four words, and
 * behind them: `promo_redemptions.promo_id` was ON DELETE CASCADE, and those
 * rows are the ONLY place a discount is ever written down — the order does not
 * store it and no report re-derives it. The same rows enforce "1 per
 * customer", so deleting and recreating a code handed the first-order offer
 * back to everyone who had already used it.
 *
 * Migration 062 made the database itself refuse it, and the server checks
 * before it tries. This window is the third layer, and the only one Sana sees:
 * it says what would be lost, in numbers, before anything happens.
 *
 * A code that HAS been used is not deletable at all. The window offers the
 * thing she actually wants instead — disable it — which stops it working
 * immediately, loses nothing, and can be undone.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { errorMessage } from "@/lib/api-errors";

type Promo = any;

export function DeleteOrDisableDialog({
  promo,
  onClose,
  onDone,
}: {
  promo: Promo | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [cost, setCost] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!promo?.id) return;
    let alive = true;
    setCost(null);
    setError("");
    setLoading(true);
    apiClient
      .getPromoCost(String(promo.id))
      .then((r: any) => {
        if (alive) setCost(r);
      })
      .catch((e) => {
        // A FAILED READ IS NOT "NEVER USED". Without a number the window must
        // not offer the delete at all — it offers disable, which is safe
        // whatever the answer would have been.
        if (alive) setError(errorMessage(e, "how often this code has been used"));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [promo?.id]);

  if (!promo) return null;

  const used = cost?.times_used ?? null;
  const readable = !error && cost?.readable !== false && used !== null;
  const neverUsed = readable && used === 0;

  const disable = async () => {
    try {
      setBusy(true);
      await apiClient.updatePromo(String(promo.id), { is_active: false });
      onDone();
    } catch (e) {
      setError(errorMessage(e, "switching this code off"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      setBusy(true);
      await apiClient.deletePromo(String(promo.id));
      onDone();
    } catch (e) {
      // The server refuses a used code too. If the two ever disagree, this is
      // where it shows — as the server's own sentence, not a generic failure.
      setError(errorMessage(e, "deleting this code"));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={neverUsed ? `Delete the code ${promo.code}` : `Stop the code ${promo.code}`}
      size="md"
      lockClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {neverUsed ? "Keep it" : "Leave it alone"}
          </Button>
          {neverUsed ? (
            <Button variant="danger" onClick={remove} loading={busy}>
              Delete it
            </Button>
          ) : (
            <Button variant="primary" onClick={disable} loading={busy}>
              Disable it
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-takal-ink-soft">Checking what this code has cost…</p>
      ) : (
        <div className="space-y-4">
          <dl className="rounded-lg bg-takal-page p-4 text-sm">
            <Row label="Used by" value={
              !readable ? "could not check"
                : used === 0 ? "nobody"
                : `${cost.customers} customer${cost.customers === 1 ? "" : "s"}`
            } />
            <Row label="Given away" value={readable ? money(cost.given_away) : "—"} />
            <Row
              label="Records that would be lost"
              value={!readable ? "unknown" : used === 0 ? "none" : String(used)}
              strong
            />
          </dl>

          {neverUsed ? (
            <p className="rounded-lg border-l-4 border-takal-green bg-takal-green-soft px-4 py-3 text-sm">
              Nothing to lose. This code has never been used, so deleting it
              takes no history with it.
            </p>
          ) : (
            <p className="rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm">
              {readable ? (
                <>
                  <strong>This code cannot be deleted.</strong> Deleting it would
                  take the {used} record{used === 1 ? "" : "s"} of what it cost
                  with it — the only place that money is written down — and every
                  customer who has already used it would be able to use it again.
                </>
              ) : (
                <>
                  <strong>The count could not be read, so nothing will be deleted.</strong>{" "}
                  A failed check is not the same as &quot;never used&quot;.
                </>
              )}
            </p>
          )}

          {!neverUsed && (
            <p className="text-xs text-takal-ink-soft">
              Disabling stops it working immediately. Nothing is lost, and you
              can turn it back on.
            </p>
          )}

          {error && <p className="text-sm text-[#C8410F]">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        strong ? "mt-1.5 border-t border-takal-ink pt-2.5 font-bold" : ""
      }`}
    >
      <dt className="text-takal-ink-soft">{label}</dt>
      <dd className="text-takal-ink">{value}</dd>
    </div>
  );
}
