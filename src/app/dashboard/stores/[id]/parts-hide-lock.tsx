"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 224-3 - "HIDE AND LOCK" ON A STORE'S PRODUCT (approved by Sana,
// 1 Nov 2026: "Once the Product Hide by admin or Assistant so the Vendor could
// not be Open it again through app" -> "Approved").
//
// A reviewer (stores.approve) hides one product AND locks it, with the reason
// the vendor reads in Roman Urdu. The vendor cannot switch it on, and changing
// its name or photo does not bring it back - only the Main Admin's "Show
// again" (Stores -> Hidden by Takal). The server is the lock
// (POST /admin/products/hide-lock/{id}, migration 155); this is the window.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Modal } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { HIDE_REASONS, HIDE_REASON_MAX, hideReasonToSend } from "@/lib/legal-check";

export function HideLockDialog({ product, onClose, onDone }: {
  product: { id: string; name: string } | null;
  onClose: () => void;
  /** Hidden and locked: the list reads the product again. */
  onDone: (id: string) => void;
}) {
  const [pick, setPick] = useState("legal");
  const [text, setText] = useState(HIDE_REASONS[0].words);
  const [busy, setBusy] = useState(false);
  const send = hideReasonToSend(text);

  const choose = (key: string) => {
    setPick(key);
    const r = HIDE_REASONS.find((x) => x.key === key);
    setText(r?.words || "");
  };

  const go = async () => {
    if (!product || !send) return;
    setBusy(true);
    try {
      await apiClient.hideAndLockProduct(product.id, send);
      toast(`${product.name} is hidden and locked. The vendor was told why.`, "success");
      onDone(product.id);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!product}
      onClose={() => { if (!busy) onClose(); }}
      size="sm"
      title={`🔒 Hide "${product?.name || "this product"}"?`}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-[10px] border-2 border-takal-ink bg-white px-4 py-2 font-bold hover:bg-takal-page">Cancel</button>
          <button type="button" data-hide-lock-go onClick={go} disabled={busy || !send}
            className="rounded-[10px] border-2 border-black bg-black px-4 py-2 font-bold text-takal-yellow disabled:opacity-50">
            {busy ? "Hiding…" : "🔒 Hide and lock"}
          </button>
        </div>
      }
    >
      <p className="text-[13.5px] font-bold text-takal-ink">Why? The vendor reads this in Roman Urdu:</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {HIDE_REASONS.map((r) => (
          <button key={r.key} type="button" data-hide-reason={r.key} aria-pressed={pick === r.key}
            onClick={() => choose(r.key)}
            className={`rounded-full border-[1.5px] px-3 py-1 text-[12.5px] font-bold ${pick === r.key
              ? "border-takal-ink bg-takal-yellow text-black" : "border-takal-line bg-white text-takal-ink hover:border-takal-ink-soft"}`}>
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        maxLength={HIDE_REASON_MAX}
        onChange={(e) => setText(e.target.value)}
        aria-label="The reason the vendor reads"
        rows={3}
        className="mt-2 w-full rounded-lg border-[1.5px] border-takal-ink px-3 py-2 text-[14px] outline-none focus:shadow-[0_0_0_3px_#FFFF00]"
        placeholder="Roman Urdu mein wajah likhein…" />
      <div className="mt-2 rounded-lg bg-[#E6EEF4] px-3 py-2 text-[12.5px] text-[#0B3A5E]">
        🔒 <b>Locked:</b> the vendor cannot switch it on from the Partners app, and changing its name or photo
        does not bring it back. Only the Main Admin&apos;s <b>Show again</b> does.
      </div>
    </Modal>
  );
}
