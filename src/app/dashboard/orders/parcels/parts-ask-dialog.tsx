"use client";

/**
 * ASKING FOR ONE LINE OF TEXT — as a proper window.
 *
 * WHAT THIS REPLACES. Three `window.prompt()` calls on the Parcels desk: the
 * shelf reference when a parcel is received, the reason for closing one
 * WITHOUT the customer's code, and the reason for sending a stuck parcel back.
 *
 * The last two are the important ones. Closing a parcel without the code is
 * the single most serious thing anybody does on this screen - it is the
 * protection that stops a delivery being marked done from somebody's sofa -
 * and it was being authorised in a grey box that cannot show which parcel it
 * is, cannot be styled, and on some browsers does not appear at all, in which
 * case the button silently did nothing.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";

export function AskDialog({
  open,
  title,
  hint,
  label,
  placeholder,
  initial = "",
  required = false,
  danger = false,
  warning,
  confirmLabel = "Save",
  busy = false,
  onClose,
  onDone,
}: {
  open: boolean;
  title: string;
  hint?: string;
  label: string;
  placeholder?: string;
  initial?: string;
  /** When true the button stays off until something is typed. Used wherever
   *  the answer is a REASON that is written onto the order for good. */
  required?: boolean;
  danger?: boolean;
  warning?: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (open) setText(initial);
    // `initial` is deliberately not watched: retyping a value under somebody's
    // hands while they are editing it is worse than a stale default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      lockClose={busy}
      title={title}
      hint={hint}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={required && !text.trim()}
            onClick={() => onDone(text.trim())}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-takal-ink-soft">
        {label}
      </p>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="mb-4 w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow"
      />
      {warning ? (
        <div className="rounded-r-lg border-l-4 border-takal-red bg-takal-red-soft px-4 py-3 text-sm leading-relaxed">
          {warning}
        </div>
      ) : null}
      {required && !text.trim() ? (
        <p className="mt-3 text-xs text-takal-ink-soft">
          Type a reason to turn the button on.
        </p>
      ) : null}
    </Modal>
  );
}
