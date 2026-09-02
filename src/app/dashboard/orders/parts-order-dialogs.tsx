"use client";

/**
 * THE THREE THINGS THE OFFICE DOES TO AN ORDER — as proper windows.
 *
 * WHAT THEY REPLACE. Cancelling an order asked `window.prompt()`, the
 * browser's own grey box. So did approving a return. That box cannot show the
 * order - no customer, no amount, no items - so the person cancelling could
 * not see what they were cancelling. It cannot be styled, it looks nothing
 * like Takal, and some browsers switch it off entirely, in which case the
 * button silently does nothing at all.
 *
 * Approved by Sana on 2 September 2026, mock-up 14.
 */

import { useEffect, useState } from "react";
import { Modal, Button, OrderStatusBadge, orderStatusLabel } from "@/components/ui";
import { money } from "@/lib/format";

/** The reasons an order really gets cancelled here, so nobody has to type
 *  "shop closed" four hundred times - and so the reasons stay comparable when
 *  somebody wants to know why orders are being lost. */
const CANCEL_REASONS = [
  "Shop closed",
  "Out of stock",
  "No rider available",
  "Customer asked to cancel",
  "Wrong or unreachable address",
  "Duplicate order",
];

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 px-3 py-2 text-sm transition ${
        on
          ? "border-takal-ink bg-takal-yellow font-bold text-takal-ink"
          : "border-takal-line bg-white text-takal-ink-soft hover:bg-takal-page"
      }`}
    >
      {children}
    </button>
  );
}

function OrderLine({ order }: { order: any }) {
  return (
    <div className="mb-4 rounded-lg bg-takal-page px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold text-takal-ink">
          {order?.customer_name || "Customer not named"}
          {order?.customer_phone ? (
            <span className="ml-2 font-normal text-takal-ink-soft">
              {order.customer_phone}
            </span>
          ) : null}
        </span>
        <span className="font-bold text-takal-ink">
          {money(order?.total_amount ?? order?.total)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-takal-ink-soft">
        <span>{order?.restaurant_name || "Shop not named"}</span>
        <span>
          {order?.payment_method === "cash" || !order?.payment_method
            ? "cash, not collected"
            : order.payment_method}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────── CANCEL ─────────────────────────────────────── */

export function CancelOrderDialog({
  order,
  onClose,
  onDone,
}: {
  order: any | null;
  onClose: () => void;
  onDone: (reason: string) => Promise<void>;
}) {
  const [chosen, setChosen] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChosen("");
    setOther("");
  }, [order?.id]);

  const reason = chosen === "Other…" ? other.trim() : chosen;

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      lockClose={busy}
      title={`Cancel order #${String(order?.id ?? "").slice(0, 8)}`}
      hint="The customer is shown the reason, and it is kept on the order for good."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep the order
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason}
            onClick={async () => {
              setBusy(true);
              try {
                await onDone(reason);
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel it
          </Button>
        </div>
      }
    >
      <OrderLine order={order} />
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
        Why? The customer is shown this
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[...CANCEL_REASONS, "Other…"].map((r) => (
          <Chip key={r} on={chosen === r} onClick={() => setChosen(r)}>
            {r}
          </Chip>
        ))}
      </div>
      {chosen === "Other…" && (
        <input
          autoFocus
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Say what happened, in one line"
          className="mb-4 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
        />
      )}
      <div className="rounded-lg bg-takal-page px-4 py-3 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-takal-ink-soft">Money already taken</span>
          <span className="font-bold">
            {order?.payment_status === "paid" ? "Yes — a refund is needed" : "Nothing — cash order"}
          </span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-takal-ink-soft">Wallet credit going back</span>
          <span className="font-bold">{money(order?.credit_used || 0)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-takal-ink-soft">Stock going back on the shelf</span>
          <span className="font-bold">automatically</span>
        </div>
      </div>
      {!reason && (
        <p className="mt-3 text-xs text-takal-ink-soft">
          Pick a reason to turn the button on.
        </p>
      )}
    </Modal>
  );
}

/* ─────────────────────────── MOVE ───────────────────────────────────────── */

export function MoveOrderDialog({
  order,
  canMoveTo,
  onClose,
  onDone,
}: {
  order: any | null;
  canMoveTo: string[];
  onClose: () => void;
  onDone: (status: string, reason: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus("");
    setReason("");
  }, [order?.id]);

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      lockClose={busy}
      title={`Move order #${String(order?.id ?? "").slice(0, 8)}`}
      hint="Only for when the shop or the rider cannot do it themselves."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            loading={busy}
            disabled={!status || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onDone(status, reason.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            Move it
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-takal-ink-soft">
        It is <OrderStatusBadge status={order?.status} />. From here it can only
        go to one of these — the same rules the shop&rsquo;s own app follows.
      </p>
      {canMoveTo.length === 0 ? (
        <p className="mb-4 rounded-lg bg-takal-red-soft px-4 py-3 text-sm text-takal-red">
          This order is finished. Nothing moves it now.
        </p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {canMoveTo.map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {orderStatusLabel(s)}
            </Chip>
          ))}
        </div>
      )}
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
        Why are you doing this for them?
      </p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Owner rang the office — his tablet is offline"
        className="mb-4 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
      />
      <div className="rounded-r-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm leading-relaxed">
        <b>This is written down.</b> The order will show &ldquo;moved from the
        admin panel&rdquo; with your name on it, not &ldquo;by the shop&rdquo;.
        It must never look like the shop did something it did not do.
      </div>
    </Modal>
  );
}

/* ─────────────────────────── ASSIGN, ONE OR MANY ────────────────────────── */

export function AssignRiderDialog({
  open,
  orders,
  riders,
  riderError,
  onClose,
  onDone,
}: {
  open: boolean;
  orders: any[];
  riders: any[];
  riderError: string;
  onClose: () => void;
  onDone: (riderId: string) => Promise<void>;
}) {
  const [rider, setRider] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setRider("");
  }, [open]);

  const many = orders.length > 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      lockClose={busy}
      title={many ? `Give ${orders.length} orders to one rider` : "Assign a rider"}
      hint={
        many
          ? "Each order is checked on its own. One that cannot be given does not stop the rest."
          : `Order #${String(orders[0]?.id ?? "").slice(0, 8)}`
      }
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!rider}
            onClick={async () => {
              setBusy(true);
              try {
                await onDone(rider);
              } finally {
                setBusy(false);
              }
            }}
          >
            {many ? `Assign all ${orders.length}` : "Assign"}
          </Button>
        </div>
      }
    >
      {many && (
        <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-takal-line">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between border-b border-takal-line px-3 py-2 text-sm last:border-b-0"
            >
              <span className="font-mono text-xs font-bold">
                #{String(o.id).slice(0, 8)}
              </span>
              <span className="text-takal-ink-soft">
                {o.customer_name || "—"} · {o.restaurant_name || "—"}
              </span>
              <span className="font-bold">{money(o.total_amount)}</span>
            </div>
          ))}
        </div>
      )}

      {riderError ? (
        // Say what actually happened. "No riders available" was a lie whenever
        // the real reason was a missing permission.
        <div className="rounded-lg border border-[#FFD2BF] bg-takal-orange-soft px-4 py-3 text-sm text-[#C8410F]">
          {riderError}
        </div>
      ) : riders.length === 0 ? (
        <p className="text-sm text-takal-ink-soft">No approved riders available.</p>
      ) : (
        <select
          value={rider}
          onChange={(e) => setRider(e.target.value)}
          className="w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
        >
          <option value="">Choose a rider…</option>
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name || "Rider"}
              {r.phone ? ` (${r.phone})` : ""}
              {r.is_online ? " • online" : " • offline"}
            </option>
          ))}
        </select>
      )}
    </Modal>
  );
}
