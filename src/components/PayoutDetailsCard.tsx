"use client";

/**
 * WHERE TAKAL SENDS A VENDOR HIS MONEY.  (Mock 111, approved 22 Sep 2026.)
 *
 * Until this, there was nowhere in Takal to put a vendor's payout details.
 * Every payout was settled by somebody knowing them outside the system, and a
 * shop could be approved and start taking orders with nobody able to say how
 * it would ever be paid.
 *
 * TYPING A NUMBER IN AND READING ONE BACK ARE TWO DIFFERENT POWERS.
 * Whoever signs the vendor up types it in once - that IS the job - and
 * afterwards sees `0315 **** 0000`. The full number is only sent to somebody
 * who may see Payments → Balances, and the masking is done on the SERVER:
 * masking in the browser would mean the real number had already been sent and
 * was sitting in the network tab.
 *
 * THERE IS NO CNIC FIELD. Sana, in plain words on 22 September 2026:
 * "NO CNIC". The account TITLE is what stops a payout reaching the wrong
 * person, and it is checked against his CNIC by eye at sign-up. Do not add one
 * without asking her again.
 */

import { useCallback, useEffect, useState } from "react";
import { Banknote, Lock, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { Badge, Button } from "@/components/ui";
import { PAYOUT_METHODS, methodLabel, payoutProblem } from "@/lib/payout-details";

type Details = {
  given: boolean;
  method: string;
  method_label?: string;
  account_title?: string;
  account_number?: string;
  account_number_masked?: boolean;
  bank_name?: string;
  can_see_full?: boolean;
};

export function PayoutDetailsCard({
  restaurantId,
  shopName,
  onSaved,
}: {
  restaurantId: string;
  shopName?: string;
  onSaved?: () => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [method, setMethod] = useState<string>("easypaisa");
  const [title, setTitle] = useState("");
  const [num, setNum] = useState("");
  const [bank, setBank] = useState("");
  const [tried, setTried] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const out: any = await apiClient.getPayoutDetails(restaurantId);
      setDetails(out);
    } catch {
      // A refusal means this admin may not see this section at all. Showing
      // nothing is the right answer - never "no details given", which would be
      // a statement about the shop rather than about their own access.
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const startEditing = () => {
    setMethod(details?.method || "easypaisa");
    setTitle(details?.account_title || "");
    // NEVER pre-fill a masked number. "0315 **** 0000" saved back would write
    // the stars into the account and make the shop unpayable, and it would
    // look exactly like it had worked.
    setNum(details?.can_see_full ? (details?.account_number || "") : "");
    setBank(details?.bank_name || "");
    setTried(false);
    setEditing(true);
  };

  const chosen = PAYOUT_METHODS.find((m) => m.key === method);
  const problem = payoutProblem(method, title, num, bank);

  const save = async () => {
    setTried(true);
    if (problem) return;
    setBusy(true);
    try {
      const out: any = await apiClient.savePayoutDetails(restaurantId, {
        method, account_title: title.trim(),
        account_number: num.trim(), bank_name: bank.trim(),
      });
      toast(out?.message || "Payout details saved", "success");
      setEditing(false);
      setNum("");            // not left sitting in the page after saving
      await load();
      onSaved?.();
    } catch (e: any) {
      toast(e?.message || "These could not be saved.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-takal-line p-6">
        <p className="text-sm text-takal-ink-soft">Reading payout details…</p>
      </div>
    );
  }

  // Not allowed to see this section at all.
  if (!details) return null;

  return (
    <div className="bg-white rounded-lg border border-takal-line p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-takal-ink flex items-center gap-2">
          <Banknote className="w-4 h-4" /> Where Takal sends the money
        </h3>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={startEditing}>
            <Pencil className="w-4 h-4 mr-1 inline" />
            {details.given ? "Change" : "Add"}
          </Button>
        )}
      </div>

      {!editing && !details.given && (
        <div className="rounded-lg border border-takal-orange bg-takal-orange-soft p-3">
          <p className="text-sm font-bold text-takal-ink">Not given yet</p>
          <p className="text-sm text-takal-ink-soft">
            This shop could not be paid. It is the seventh check on the
            onboarding list, and &quot;Send for approval&quot; stays off until
            it is filled in.
          </p>
        </div>
      )}

      {!editing && details.given && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-takal-ink-soft">Paid by</dt>
            <dd className="font-medium">
              {details.method_label || methodLabel(details.method)}
            </dd>
          </div>
          {details.account_title && (
            <div className="flex justify-between gap-3">
              <dt className="text-takal-ink-soft">Name on the account</dt>
              <dd className="font-medium">{details.account_title}</dd>
            </div>
          )}
          {details.bank_name && (
            <div className="flex justify-between gap-3">
              <dt className="text-takal-ink-soft">Bank</dt>
              <dd className="font-medium">{details.bank_name}</dd>
            </div>
          )}
          {details.account_number && (
            <div className="flex justify-between gap-3">
              <dt className="text-takal-ink-soft">Number</dt>
              <dd className="font-mono font-medium">{details.account_number}</dd>
            </div>
          )}
          {details.account_number_masked && (
            <p className="flex items-center gap-1.5 text-xs text-takal-ink-soft pt-1">
              <Lock className="w-3 h-3" />
              Hidden. Only the payments office sees the whole number.
            </p>
          )}
        </dl>
      )}

      {editing && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-takal-ink mb-2">
              How Takal pays {shopName || "this shop"}
            </p>
            <div className="space-y-1.5">
              {PAYOUT_METHODS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="payout-method"
                    checked={method === m.key}
                    onChange={() => setMethod(m.key)}
                  />
                  <span className="text-takal-ink">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {method !== "cash" && (
            <>
              <div>
                <label className="block text-sm font-medium text-takal-ink mb-1">
                  Name on the account
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="w-full border-2 border-takal-line rounded-lg px-3 py-2 text-sm focus:border-takal-yellow focus:outline-none"
                />
              </div>

              {method === "bank" && (
                <div>
                  <label className="block text-sm font-medium text-takal-ink mb-1">
                    Bank
                  </label>
                  <input
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    maxLength={120}
                    placeholder="HBL, Meezan, Bank Alfalah…"
                    className="w-full border-2 border-takal-line rounded-lg px-3 py-2 text-sm focus:border-takal-yellow focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-takal-ink mb-1">
                  {chosen?.numberLabel}
                </label>
                <input
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                  maxLength={40}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={method === "bank" ? "" : "0315 0000000"}
                  className="w-full border-2 border-takal-line rounded-lg px-3 py-2 text-sm font-mono focus:border-takal-yellow focus:outline-none"
                />
                {details.given && !details.can_see_full && (
                  <p className="mt-1 text-xs text-takal-ink-soft">
                    Type the whole number again — you are not shown the one
                    already saved.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="rounded-lg border border-takal-yellow bg-takal-yellow-soft p-3">
            <p className="text-sm font-bold text-takal-ink">
              Check the name against his CNIC
            </p>
            <p className="text-xs text-takal-ink-soft">
              A payout to the wrong name cannot be taken back. Takal does not
              keep the CNIC number — only the name on the account.
            </p>
          </div>

          {tried && problem && (
            <div className="rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm text-takal-red">
              {problem}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={busy}>Save payout details</Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            {details.given && (
              <Badge tone="neutral">
                Currently {methodLabel(details.method)}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
