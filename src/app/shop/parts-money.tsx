"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE SHOP'S OWN MONEY - VIEW ONLY.  (Mock 133 picture H, approved 1 Oct 2026.)
//
// What a Mall's staff may see about money: how many orders were delivered,
// what the shop has earned, what Takal has paid it, what is still to come,
// and the list of payments. NOTHING here can be changed, and Takal's
// commission is never shown - it belongs to Takal (Sana, 30 Sep 2026). The
// server door is the shop's own (GET /restaurants/{id}/earnings, the same one
// the Partners app reads); the panel's type for it leaves commission out.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ShopEarnings } from "@/lib/api-stores";
import { money, fmtDate } from "@/lib/format";
import { ErrorState } from "@/components/ui";

/** How the money was sent, the way people say it. Anything new is shown as it came. */
const HOW: Record<string, string> = {
  easypaisa: "EasyPaisa", jazzcash: "JazzCash", bank: "Bank transfer", cash: "Cash",
};

export function ShopMoneyTab({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<ShopEarnings | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await apiClient.getShopEarnings(restaurantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The money figures could not be read.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (loading && !data) return <div className="py-8 text-center text-sm text-takal-ink-soft">Loading…</div>;
  if (!data) return null;

  const cards: [string, string, string][] = [
    ["Delivered orders", (data.delivered_orders ?? 0).toLocaleString(), "border-takal-line"],
    ["Earned by the shop", money(data.earned), "border-takal-line"],
    ["Paid by Takal", money(data.paid), "border-[#BFE0CF] bg-takal-green-soft"],
    ["Still to come from Takal", money(data.pending), "border-[#EDE88A] bg-takal-yellow-soft"],
  ];
  const history = (data.history || []).slice().sort((a, b) =>
    String(b.paid_at || "").localeCompare(String(a.paid_at || "")));

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-lg border border-[#B9CFE0] bg-takal-blue-soft px-4 py-3 text-[13px] text-takal-blue">
        <Info aria-hidden className="mt-px h-4 w-4 shrink-0" />
        <span>View only. Payments are made and recorded by Takal. All figures are since the shop joined.</span>
      </div>

      {data.incomplete && (
        <div className="rounded-lg border border-[#FFC7B0] bg-takal-orange-soft px-4 py-3 text-[13px] text-[#9A3412]">
          Some orders could not be read just now, so these figures may be too low. Please look again later.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([k, v, look]) => (
          <div key={k} className={`rounded-xl border p-4 ${look}`}>
            <p className="text-xs text-takal-ink-soft">{k}</p>
            <p className="mt-1 text-xl font-bold text-takal-ink">{v}</p>
          </div>
        ))}
      </div>

      {data.period && data.period.from && (
        <p className="text-sm text-takal-ink-soft">
          This pay period ({fmtDate(data.period.from)} – {fmtDate(data.period.to)}):{" "}
          <b className="text-takal-ink">{(data.period.orders ?? 0).toLocaleString()} orders</b>, earned{" "}
          <b className="text-takal-ink">{money(data.period.earned)}</b>.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-takal-line">
        <div className="border-b border-takal-line px-5 py-3">
          <h3 className="font-semibold text-takal-ink">Payments from Takal</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-takal-line bg-takal-page text-left">
                <th className="px-5 py-2.5 font-semibold text-takal-ink">Date</th>
                <th className="px-5 py-2.5 font-semibold text-takal-ink">Amount</th>
                <th className="px-5 py-2.5 font-semibold text-takal-ink">How</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-6 text-center text-takal-ink-soft">No payments yet.</td></tr>
              ) : history.map((h, i) => (
                <tr key={i} className={`border-b border-takal-line ${h.cancelled ? "text-takal-disabled-text" : ""}`}>
                  <td className="px-5 py-2.5">{fmtDate(h.paid_at)}</td>
                  <td className={`px-5 py-2.5 font-semibold ${h.cancelled ? "line-through" : "text-takal-ink"}`}>{money(h.amount)}</td>
                  <td className="px-5 py-2.5">
                    {h.method ? (HOW[h.method.toLowerCase()] || h.method) : "—"}
                    {h.cancelled && (
                      <span className="ml-2 rounded-full bg-[#EEEEEE] px-2 py-0.5 text-[11px] font-semibold text-takal-ink-soft">
                        Cancelled by Takal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
