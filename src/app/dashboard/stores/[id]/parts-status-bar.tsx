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

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui";
import { RejectReasonDialog, SHOP_REASONS, rejectedLine } from "@/components/RejectReasonDialog";
import {
  approveState, approveWithChecklist, missingForApproval, MIN_PRODUCTS, type ShopChecklist,
} from "@/lib/approve-rule";

import { storeStatusOf, type StoreStatus } from "@/lib/store-status";
import Link from "next/link";
import { CustomersSeeSwitch } from "../parts-customers-see";
import { reviewStateOf } from "@/lib/shop-review";
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
  // MOCK 207-6: approved by Takal, not switched on for customers yet.
  if (status === "hidden") return (
    <span className="rounded-full bg-takal-orange-soft px-2.5 py-0.5 text-xs font-bold text-[#B23E10]"
      title="Approved by Takal. Customers do not see it until the main admin switches on Show to customers.">
      ✓ Approved · Hidden from customers
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
  // THE SERVER'S CHECKLIST FOR THIS ONE SHOP (fix 2; audit 202, A3).
  //
  // Read from THIS shop's own door (GET /admin/vendor-intake/shop/{id}) when
  // the page opens - one small read, not the whole waiting list as before -
  // and for a REJECTED shop too, because "Approve after all" is checked
  // against the same list by the server. If that door is closed to this admin
  // (it needs the "add & edit shops" permission), the waiting list is asked
  // instead. Nothing read = the products rule alone, and the server checks.
  const [list, setList] = useState<ShopChecklist | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // The server's refusal, in its own words, kept on screen (not only a toast).
  const [refused, setRefused] = useState<string | null>(null);
  const wantsList = status === "pending" || status === "rejected";
  const readList = useCallback(async (alive: () => boolean = () => true) => {
    try {
      const mine = await apiClient.getShopChecklist(String(r.id)) as ShopChecklist;
      if (alive()) { setList(mine); setListFailed(false); }
      return;
    } catch { /* try the waiting list below */ }
    try {
      const w: any = status === "pending" ? await apiClient.getWaitingChecklists() : null;
      const mine = (w?.shops || []).find((s: any) => String(s.id) === String(r.id)) || null;
      if (alive()) { setList(mine); setListFailed(!mine); }
    } catch {
      if (alive()) { setList(null); setListFailed(true); }
    }
  }, [r.id, status]);
  useEffect(() => {
    setRefused(null);
    if (!wantsList) { setList(null); setListFailed(false); return; }
    let alive = true;
    readList(() => alive);
    return () => { alive = false; };
  }, [wantsList, readList]);
  const left = missingForApproval(list);

  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<null | "reject" | "suspend" | "anyway" | "remove">(null);
  const name = r.name || "This store";

  const run = async (what: () => Promise<any>, done: string, approving = false) => {
    try {
      setBusy(true);
      if (approving) setRefused(null);
      await what();
      toast(done, "success");
      onChanged();
    } catch (err) {
      const said = err instanceof Error ? err.message : "That did not work";
      toast(said, "error");
      // A refused Approve: say why beside the button, open the checklist,
      // and read it again - the server may know something this page did not.
      if (approving) {
        setRefused(said);
        setListOpen(true);
        readList();
      }
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  // The products rule, then the checklist - exactly as on the list.
  // Ready only when nothing on the server's checklist is missing; the main
  // admin keeps "Approve anyway" (lib/approve-rule.ts).
  const a = approveWithChecklist(approveState({ product_count: productCount }, isMain), left, isMain);
  const steps = list?.steps || [];
  const missingCount = steps.filter((s) => !s.done).length;

  // Mock 188 (14 Oct 2026): one size smaller - the store card is 3 lines now.
  const btn = "rounded-lg px-3 py-1.5 text-[13px] font-bold transition disabled:opacity-50";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* REVIEW (Mock 207-2) - the one page to check a new shop and send it
            back for changes. */}
        {status === "pending" && (
          <Link href={`/dashboard/stores/${r.id}/review`} data-review-link
            className={`${btn} border-[1.5px] border-takal-ink bg-takal-yellow text-takal-ink hover:bg-takal-yellow-dark`}>
            {reviewStateOf(r) === "fixed" ? "Review again" : "Review"}
          </Link>
        )}
        {/* SHOW TO CUSTOMERS (Mock 207-6) - Main Admin only; locked for others. */}
        {(status === "approved" || status === "hidden") && (
          <span className={`inline-flex items-center gap-2 rounded-lg border-[1.5px] px-2 py-1 ${
            status === "hidden" ? "border-takal-ink bg-takal-yellow-soft" : "border-takal-line bg-white"}`}
            title={isMain ? "" : "Only the main admin can change this."}>
            <span className="text-[12.5px] font-bold text-takal-ink">Show to customers</span>
            <CustomersSeeSwitch shop={{ ...r, product_count: productCount }} isMain={isMain} onChanged={onChanged} />
          </span>
        )}
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
                      status === "rejected" ? "Store approved after all - hidden from customers until you switch it on"
                        : "Store approved - hidden from customers until you switch it on", true)}
              className={`${btn} border border-[#BFE3CF] bg-takal-green-soft text-takal-green hover:brightness-95`}>
              {a.button === "anyway" ? "Approve anyway" : status === "rejected" ? "Approve after all" : "Approve"}
            </button>
          )
        )}
        {/* THE CHECKLIST, NEXT TO APPROVE (audit 202, A3): how many of the
            server's checks are done; open it to see each one and what is
            missing. Green only when nothing is missing. */}
        {wantsList && (
          <span className="relative">
            <button type="button" data-testid="approve-checklist" onClick={() => setListOpen((o) => !o)}
              aria-expanded={listOpen}
              className={`${btn} ${steps.length === 0
                ? "border border-takal-line bg-white text-takal-ink-soft"
                : missingCount === 0
                  ? "border border-[#BFE3CF] bg-takal-green-soft text-takal-green"
                  : "border border-[#FFD2BF] bg-takal-orange-soft text-[#C8410F]"}`}>
              {steps.length === 0
                ? (listFailed ? "Checklist not read ▾" : "Checklist… ▾")
                : missingCount === 0
                  ? "✓ Checklist done ▾"
                  : `✕ ${missingCount} missing ▾`}
            </button>
            {listOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[85vw] rounded-xl border-2 border-black bg-white p-3 text-left shadow-[0_4px_0_#000]">
                {refused && (
                  <p role="alert" className="mb-2 rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-3 py-2 text-[12.5px] font-semibold text-takal-red">
                    {refused}
                  </p>
                )}
                {steps.length > 0 ? (
                  <>
                    <p className="mb-1.5 text-[12px] font-extrabold text-takal-ink">
                      {list?.done ?? steps.length - missingCount} of {list?.total ?? steps.length} done
                      <span className="font-semibold text-takal-ink-soft"> · the server&apos;s own checklist</span>
                    </p>
                    <ul className="space-y-1">
                      {steps.map((s) => (
                        <li key={s.key} className="flex items-start gap-1.5 text-[12.5px] leading-tight">
                          <span className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white ${s.done ? "bg-takal-green" : "bg-takal-red"}`}>
                            {s.done ? "✓" : "✕"}
                          </span>
                          <span className={s.done ? "text-takal-ink-soft" : "font-semibold text-takal-ink"}>
                            {s.label}
                            {!s.done && s.note && <span className="block font-normal text-takal-ink-soft">{s.note}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-[12.5px] text-takal-ink-soft">
                    {listFailed
                      ? "The checklist could not be read just now. The server still checks it when you press Approve, and says what is missing."
                      : "Reading the checklist…"}
                  </p>
                )}
                {listFailed && (
                  <button type="button" onClick={() => readList()}
                    className="mt-2 text-[12px] font-bold text-takal-blue underline">Try again</button>
                )}
              </div>
            )}
          </span>
        )}
        {status === "pending" && (
          <button disabled={busy} onClick={() => setAsk("reject")}
            className={`${btn} border border-red-200 bg-red-50 text-takal-red hover:bg-red-100`}>
            Reject…
          </button>
        )}
        {(status === "approved" || status === "hidden") && (
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
        onConfirm={() => run(() => apiClient.approveRestaurant(String(r.id), true),
          "Store approved - hidden from customers until you switch it on", true)}
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
              It stays <b>hidden from customers</b> until the main admin switches on Show to
              customers — it has {productCount ?? 0} product{productCount === 1 ? "" : "s"} now.
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
