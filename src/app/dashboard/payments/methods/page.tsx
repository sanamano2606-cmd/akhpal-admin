"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Payment methods.
//
// Switching a method on here makes it appear in EVERY installed customer app
// immediately — no new build, no Play Store release, no waiting for customers
// to update.
//
// A wallet can only be switched on once its API keys exist on the server. The
// backend enforces that, because a method that customers can select but that
// cannot actually take money is worse than one that is simply hidden.
// ─────────────────────────────────────────────────────────────────────────────

interface Provider {
  label: string;
  switched_on_by_admin: boolean;
  credentials_present: boolean;
  missing_env_vars: string[];
  live: boolean;
  hint: string;
}

export default function PaymentsSettingsPage() {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = (await apiClient.getPaymentStatus()) as { providers: Record<string, Provider> };
      setProviders(res?.providers ?? {});
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load payment status", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: string, on: boolean) => {
    setBusy(key);
    try {
      await apiClient.updateSettings({ [`payment_${key}_enabled`]: on });
      toast(on ? "Payment method switched on" : "Payment method switched off", "success");
      await load();
    } catch (err) {
      // The backend refuses to enable a wallet whose keys are missing, and says
      // exactly which ones. Surface that message rather than a generic failure.
      toast(err instanceof Error ? err.message : "Could not update", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Payment Methods</h2>
          <p className="text-takal-ink-soft mt-1 text-sm max-w-2xl">
            Switching a method on here shows it in every customer&apos;s app
            straight away — no app update needed. A mobile wallet can only be
            switched on after its API keys are set on the server.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 border border-takal-line rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-takal-ink-soft">Loading…</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(providers).map(([key, p]) => (
            <div key={key} className="border border-takal-line rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-takal-ink">{p.label}</h2>
                    {p.live ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Live
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-takal-ink-soft flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Not live
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-takal-ink-soft mt-1">{p.hint}</p>

                  {p.missing_env_vars.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900">
                        <p className="font-semibold">
                          Waiting for these on the server:
                        </p>
                        <ul className="mt-1 space-y-0.5 font-mono">
                          {p.missing_env_vars.map((v) => (
                            <li key={v}>{v}</li>
                          ))}
                        </ul>
                        <p className="mt-2">
                          Add them in Render → Environment, then redeploy.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {key !== "cash" && (
                  <button
                    onClick={() => toggle(key, !p.switched_on_by_admin)}
                    disabled={busy === key}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                      p.switched_on_by_admin
                        ? "border border-takal-line text-takal-ink"
                        : "bg-slate-900 text-white"
                    }`}
                  >
                    {p.switched_on_by_admin ? "Switch off" : "Switch on"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
