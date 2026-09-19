"use client";

/**
 * "Cancel this payment" - the window that asks WHY.
 *
 * Money audit M3, 19 September 2026.
 *
 * You mean Rs 20,000, your finger slips, you record Rs 200,000. Until this
 * there was no way back: no edit, no delete, and a minus correction refused by
 * the server and by the database.
 *
 * THIS IS NOT AN EDIT AND NOT A DELETE. The wrong payment stays on the list,
 * marked cancelled, carrying this reason and the name of the admin who typed
 * it. Books are not rubbed out - the right amount is recorded as a new payment
 * beside it. That is why the reason is not optional here, and why the server
 * and the database both refuse a blank one as well.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";

export function CancelPaymentDialog({
  open,
  what,
  amount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Names the thing in plain words: "Rs 200,000 to Ali Restaurant". */
  what: string;
  amount: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // A reason left over from the last payment you cancelled must never be sent
  // against a different one.
  useEffect(() => {
    if (open) {
      setReason("");
      setBusy(false);
    }
  }, [open]);

  const tooShort = reason.trim().length < 3;

  const submit = async () => {
    if (tooShort || busy) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this payment"
      hint="The payment stays on the list, marked cancelled. Nothing is deleted."
      size="sm"
      lockClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={submit}
            loading={busy}
            disabled={tooShort}
          >
            Cancel this payment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-takal-ink">
          You are cancelling <span className="font-semibold">{amount}</span>
          {what ? <> {what}</> : null}.
        </p>
        <p className="text-sm text-takal-ink-soft">
          It will stop counting as money straight away. It stays on the payment
          history, crossed out, with your name and this reason on it. If you
          meant to pay a different amount, record that as a new payment
          afterwards.
        </p>
        <label className="block text-sm font-medium text-takal-ink">
          Why are you cancelling it?
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="For example: typing mistake, an extra zero"
            className="mt-1 w-full rounded-lg border border-takal-line px-3 py-2 text-sm
                       focus:ring-2 focus:ring-takal-yellow focus:border-transparent outline-none"
          />
        </label>
        {tooShort && (
          <p className="text-xs text-takal-ink-soft">
            A reason is required — six months from now this line is the only
            thing that explains what happened here.
          </p>
        )}
      </div>
    </Modal>
  );
}
