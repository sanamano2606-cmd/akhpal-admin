"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE STORE'S TRUE STATUS, AND WHAT YOU CAN DO ABOUT IT - ON THE STORE'S PAGE.
// (Stores page fix 3, Sana 12 Oct 2026: "OK fix 3". Audit S2 + S3, Mock 182
// picture 4.)
//
// WAS: the header read only `is_approved`, so a SUSPENDED shop said "Approved"
// and a REJECTED one said "Waiting for approval" with no reason. Approve,
// Reject, Suspend and Unsuspend existed only on the list, so checking a shop's
// products and then approving it meant going back and finding it again.
//
// NOW: one label that tells the truth (the same four states as the list, the
// server works it out - routers/admin_stores.py `state`), the reason or date
// beside it, and the SAME buttons as the list with the SAME boxes that ask
// first. The server still decides who may press what (stores.approve; Remove
// for good and Approve anyway: the Main Admin only).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";
import { RejectReasonDialog, SHOP_REASONS, rejectedLine } from "@/components/RejectReasonDialog";
import { approveState, MIN_PRODUCTS } from "@/lib/approve-rule";

import { storeStatusOf, type StoreStatus } from "@/lib/store-status";
export { storeStatusOf, type StoreStatus };

const day = (at?: string | null) => {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });
};

/** The coloured label for the header. */
export function StoreStatusChip({ r, status }: { r: any; status: StoreStatus }) {
  if (status === "suspended") return (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-takal-red ring-1 ring-red-200">
      ⛔ Suspended{day(r.suspended_at) ? ` since ${day(r.suspended_at)}` : ""}
    </span>);
  if (status === "rejected") return (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-takal-red ring-1 ring-red-200"
      title={r.rejected_reason || ""}>
      ✕ Rejected{rejectedLine(r.rejected_reason, r.rejected_at) ? ` — ${rejectedLine(r.rejected_reason, r.rejected_at)}` : ""}
    </span>);
  if (status === "pending") return (
    <span className="rounded-full bg-takal-orange-soft px-2.5 py-0.5 text-xs font-semibold text-[#C8410F]">
      Waiting for approval
    </span>);
  return (
    <span className="rounded-full bg-takal-green-soft px-2.5 py-0.5 text-xs font-semibold text-takal-green">
      ● Live
    </span>);
}

/** The buttons: what the list offers for this status, nothing more. */
export function StoreStatusActions({ r, status, productCount, onChanged }: {
  r: any; status: StoreStatus; productCount: number | null; onChanged: () => void;
}) {
  const router = useRouter();
  const [isMain, setIsMain] = useState(false);
  useEffect(() => {
    // Read once, in the browser: the same source the list page reads.
    import("@/lib/perms").then((m) => setIsMain(m.getMyPerms().isSuper)).catch(() => setIsMain(false));
  }, []);
  // A waiting shop's checklist (fix 2), so Approve unlocks the same way here.
  const [left, setLeft] = useState<string[] | null>(null);
  useEffect(() => {
    if (status !== "pending") { setLeft(null); return; }
    let alive = true;
    apiClient.getWaitingChecklists()
      .then((w: any) => {
        const mine = (w?.shops || []).find((s: any) => String(s.id) === String(r.id));
        if (alive) setLeft(mine ? (mine.what_is_left || []).filter((x: string) => !/products$/.test(x)) : null);
      })
      .catch(() => { if (alive) setLeft(null); });
    return () => { alive = false; };
  }, [status, r.id]);

  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<null | "reject" | "suspend" | "anyway" | "remove">(null);
  const name = r.name || "This store";

  const run = async (what: () => Promise<any>, done: string) => {
    try {
      setBusy(true);
      await what();
      toast(done, "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not work", "error");
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  // The products rule, then the checklist - exactly as on the list.
  let a = approveState({ product_count: productCount }, isMain);
  if (a.button === "approve" && left && left.length > 0) {
    a = { ...a, button: isMain ? "anyway" : "none", why: `Still missing: ${left.join(", ")}` };
  }

  const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(status === "pending" || status === "rejected") && (
          a.button === "none" ? (
            <span className="flex flex-col">
              <button disabled className={`${btn} border border-takal-line bg-white text-takal-disabled-text cursor-not-allowed`}>Approve</button>
              <span className="mt-0.5 max-w-[16rem] text-[11px] leading-tight text-takal-ink-soft">{a.why}</span>
            </span>
          ) : (
            <button disabled={busy}
              onClick={() => a.button === "anyway" ? setAsk("anyway")
                : run(() => apiClient.approveRestaurant(String(r.id), false),
                      status === "rejected" ? "Store approved after all" : "Store approved")}
              className={`${btn} border border-[#BFE3CF] bg-takal-green-soft text-takal-green hover:brightness-95`}>
              {a.button === "anyway" ? "Approve anyway" : status === "rejected" ? "Approve after all" : "Approve"}
            </button>
          )
        )}
        {status === "pending" && (
          <button disabled={busy} onClick={() => setAsk("reject")}
            className={`${btn} border border-red-200 bg-red-50 text-takal-red hover:bg-red-100`}>
            Reject…
          </button>
        )}
        {status === "approved" && (
          <button disabled={busy} onClick={() => setAsk("suspend")}
            className={`${btn} bg-takal-orange-soft text-takal-ink ring-1 ring-[#FFD2BF] hover:bg-[#FFE2D6]`}>
            Suspend
          </button>
        )}
        {status === "suspended" && (
          <button disabled={busy}
            onClick={() => run(() => apiClient.unsuspendRestaurant(String(r.id)), "Store unsuspended")}
            className={`${btn} border border-[#BFE3CF] bg-takal-green-soft text-takal-green hover:brightness-95`}>
            Unsuspend
          </button>
        )}
        {status === "rejected" && isMain && (
          <button disabled={busy} onClick={() => setAsk("remove")}
            className={`${btn} border border-red-200 bg-red-50 text-takal-red hover:bg-red-100`}>
            Remove for good
          </button>
        )}
      </div>

      <RejectReasonDialog
        open={ask === "reject"}
        busy={busy}
        title="Reject this store?"
        name={name}
        who="the owner"
        consequence="will be turned down. Their shop will not appear to customers."
        suggestions={SHOP_REASONS}
        onCancel={() => setAsk(null)}
        onConfirm={(reason) => run(() => apiClient.rejectRestaurant(String(r.id), reason || ""), "Store rejected")}
      />
      <ConfirmDialog
        open={ask === "suspend"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => run(() => apiClient.suspendRestaurant(String(r.id)), "Store suspended")}
        title="Suspend this store?"
        confirmLabel="Yes, suspend"
        message={<><strong>{name}</strong> will stop taking orders straight away. You can un-suspend it later.</>}
      />
      <ConfirmDialog
        open={ask === "anyway"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={() => run(() => apiClient.approveRestaurant(String(r.id), true), "Store approved")}
        title={`Approve ${name} as it is?`}
        confirmLabel="Approve anyway"
        message={
          <>
            Shops normally need at least {MIN_PRODUCTS} products, and everything on their
            checklist, before they go live. Only the main admin can approve without them.
            {left && left.length > 0 && (
              <span className="mt-3 block text-takal-ink"><b>Still missing:</b> {left.join(", ")}.</span>
            )}
            <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
              Customers will see this shop straight away — with {productCount ?? 0} product{productCount === 1 ? "" : "s"}.
            </span>
          </>
        }
      />
      <ConfirmDialog
        open={ask === "remove"}
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          try {
            setBusy(true);
            const res = await apiClient.removeRestaurantForGood(String(r.id)) as any;
            toast(res?.message || `${name} was removed for good`, "success");
            // The shop is gone: back to the Rejected list it came from.
            router.push("/dashboard/stores?status=rejected");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Could not remove the shop", "error");
          } finally {
            setBusy(false);
            setAsk(null);
          }
        }}
        title={`Remove ${name} for good?`}
        confirmLabel="Yes, remove for good"
        message={
          <>
            <strong>{name}</strong> and its products will be deleted. <strong>This cannot be undone.</strong>
            <span className="mt-3 block rounded-lg bg-takal-orange-soft p-3 text-takal-ink">
              Only a rejected shop with no orders and no reviews can be removed. A full copy
              is kept in the office record first. If the owner has no other shop, his login
              is switched off.
            </span>
          </>
        }
      />
    </>
  );
}
