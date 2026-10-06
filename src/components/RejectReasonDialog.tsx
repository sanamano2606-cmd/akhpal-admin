"use client";

/**
 * REJECT, WITH THE REASON THEY WILL BE TOLD  (Mock 161, approved by Sana,
 * 5 October 2026 - admin actions audit M14).
 *
 * Reject used to be a plain "Are you sure?" and saved only "not approved", so a
 * turned-down rider or shop looked exactly like a new application for ever.
 * Now the office gives a short reason - tap a suggested one or type - and the
 * server saves it, tells them, and shows it on the list. "Yes, reject" stays
 * grey until there are at least 3 letters (the server refuses fewer too).
 *
 * ONE window for riders AND shops, so the two can never drift apart.
 */

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";

export const REASON_MIN = 3;
export const REASON_MAX = 300;

export const RIDER_REASONS = [
  "CNIC photo unclear",
  "Phone not answering",
  "Vehicle papers missing",
  "Outside our area",
];

export const SHOP_REASONS = [
  "Shop photo unclear",
  "Address could not be checked",
  "Phone not answering",
  "Not a shop we can list",
];

/** The reason as the server will store it: spaces tidied. */
export function tidyReason(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ").slice(0, REASON_MAX);
}

export function reasonIsEnough(text: string): boolean {
  return tidyReason(text).length >= REASON_MIN;
}

export function RejectReasonDialog({
  open,
  busy,
  title,
  name,
  who,
  consequence,
  suggestions,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  /** "Imran Khan" / "Cupbar.cafe" - bold in the first sentence. */
  name: string;
  /** Who is told: "Imran", "the owner". */
  who: string;
  consequence: string;
  suggestions: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  // A fresh window every time it opens - never the last rider's reason.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const ready = reasonIsEnough(reason);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      lockClose={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => ready && onConfirm(tidyReason(reason))}
            disabled={!ready}
            loading={busy}
          >
            Yes, reject
          </Button>
        </>
      }
    >
      <p className="text-sm text-takal-ink">
        <strong>{name}</strong> {consequence}
      </p>
      <div className="mt-4">
        <label className="text-sm font-semibold text-takal-ink" htmlFor="reject-reason">
          Reason - {who} will be told this
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setReason(s)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                tidyReason(reason) === s
                  ? "border-black bg-takal-yellow font-semibold text-takal-ink"
                  : "border-takal-line bg-takal-page text-takal-ink hover:bg-takal-yellow-soft"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          id="reject-reason"
          type="text"
          value={reason}
          maxLength={REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Type the reason…"
          className="mt-3"
          disabled={busy}
        />
        <p className="mt-1 text-xs text-takal-ink-soft">
          Tap a reason or type your own. At least {REASON_MIN} letters.
        </p>
      </div>
    </Modal>
  );
}

/** "CNIC photo unclear · 5 Oct" - the line under a red Rejected label. */
export function rejectedLine(reason?: string | null, at?: string | null): string {
  const r = (reason || "").trim();
  let when = "";
  if (at) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short",
                                              timeZone: "Asia/Karachi" });
    }
  }
  return [r, when].filter(Boolean).join(" · ");
}
