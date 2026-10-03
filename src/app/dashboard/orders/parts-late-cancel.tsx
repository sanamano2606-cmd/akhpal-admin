"use client";

/**
 * A LATE CANCEL AND WHO WAS AT FAULT (Step 4 part 5, Sana, 2 October 2026).
 *
 * An order cancelled after the shop accepted it still pays the shop its share,
 * and after pickup the rider his trip pay - Takal carries it. The office can
 * say one side caused it:
 *
 *   Late cancel — shop owed Rs 900 · rider owed Rs 220
 *   [Shop at fault]  -> the shop gets Rs 0
 *   [Rider at fault] -> the rider gets Rs 0
 *   [Undo]           -> worked out again from the order
 *
 * A reason is required and goes in the order's notes and the trail. Only the
 * Main Admin or a sub-admin with Payments -> Settlements sees the buttons
 * (the server checks the same: app_guard "/admin/settlements/late-cancels").
 * If that shop or rider was already paid, their balance shows as overpaid.
 */
import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";
import { canAccess } from "@/lib/perms";
import { Button } from "@/components/ui";

/** Was this order a late cancel at all? Either amount stored, or a side marked. */
export function isLateCancel(o: any): boolean {
  if (!o || (o.status !== "cancelled" && o.status !== "rejected")) return false;
  return (
    Number(o.late_cancel_shop_owed || 0) > 0 ||
    Number(o.late_cancel_rider_owed || 0) > 0 ||
    o.late_cancel_fault === "shop" ||
    o.late_cancel_fault === "rider"
  );
}

export function LateCancelBox({ order, onChanged }: { order: any; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  if (!isLateCancel(order)) return null;

  const shop = Number(order.late_cancel_shop_owed || 0);
  const rider = Number(order.late_cancel_rider_owed || 0);
  const fault: string | null = order.late_cancel_fault || null;
  const mayMark = canAccess("payments.settlements");

  const mark = async (next: "shop" | "rider" | null) => {
    if (!reason.trim()) {
      toast("Please write a reason first.", "error");
      return;
    }
    try {
      setSaving(true);
      await apiClient.markLateCancelFault(order.id, next, reason.trim());
      toast(next ? `Marked: ${next} at fault` : "Undone - nobody at fault", "success");
      setReason("");
      onChanged();
    } catch (err) {
      toast(errorMessage(err, "the late cancel"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-takal-line bg-takal-orange-soft px-6 py-4">
      <div className="text-xs font-black uppercase tracking-wider text-[#C8410F]">
        Late cancel — Takal pays for the work done
      </div>
      <div className="mt-1 text-[15px] font-bold text-takal-ink">
        Late cancel — shop owed {money(shop)} · rider owed {money(rider)}
      </div>
      {fault ? (
        <div className="mt-1 text-sm text-takal-ink-soft">
          Marked: <b>{fault === "shop" ? "Shop at fault" : "Rider at fault"}</b> — the{" "}
          {fault} gets {money(0)}.
        </div>
      ) : null}
      {mayMark ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            aria-label="Reason"
            className="min-w-[220px] flex-1 rounded-lg border border-takal-line bg-white px-3 py-1.5 text-sm"
          />
          {fault !== "shop" && shop > 0 ? (
            <Button size="sm" variant="danger" loading={saving} onClick={() => mark("shop")}>
              Shop at fault
            </Button>
          ) : null}
          {fault !== "rider" && rider > 0 ? (
            <Button size="sm" variant="danger" loading={saving} onClick={() => mark("rider")}>
              Rider at fault
            </Button>
          ) : null}
          {fault ? (
            <Button size="sm" variant="secondary" loading={saving} onClick={() => mark(null)}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
