"use client";

// THE SIGN-UP CODE SWITCH
// -----------------------
// A new shop or a new rider must prove their phone number with a texted code
// before an account is made. That is the right rule, and it is ON by default.
//
// It needs a switch for one reason only: TIME. The backend goes live in
// minutes; a phone app takes days to clear store review and reach people. In
// the days between the two, the shop and rider apps out there have no code
// screen at all - so with this ON, nobody new can join, and the owner never
// sees it happen because a refused sign-up is silent.
//
// Before this page existed the only way to change it was to edit the database
// by hand - at exactly the moment nobody wants to be opening a database.

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { readFailure, type ReadFailure } from "@/lib/api-errors";
import { ErrorState } from "@/components/ui";

export default function SignupCodePage() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  // Told apart from "still loading". Before 3 September 2026 a failed read left
  // `on` as null, which is also its starting value — so the toggle stayed
  // permanently disabled and the page said "Reading the current setting…" for
  // ever, with no way to tell a slow server from a broken one.
  const [error, setError] = useState<ReadFailure>(null);

  const read = async () => {
    setError(null);
    try {
      const s = (await apiClient.getSettings()) as any;
      setOn(!!s?.require_signup_otp);
    } catch (err) {
      setOn(null);
      setError(readFailure(err, "the sign-up code setting"));
    }
  };

  useEffect(() => {
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (next: boolean) => {
    setSaving(true);
    try {
      await apiClient.updateSettings({ require_signup_otp: next });
      setOn(next);
      toast(
        next
          ? "ON — a new shop or rider must now enter a texted code to sign up."
          : "OFF — a new shop or rider can sign up without a code. Switch it back on once the new apps are live.",
        "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the switch", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-takal-ink-soft hover:text-takal-ink"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      <div>
        <h2 className="text-xl font-bold text-takal-ink">Sign-up phone code</h2>
        <p className="text-takal-ink-soft mt-1">
          Whether a NEW shop or a NEW rider must enter a texted code before their
          account is made. Customers always need one — this switch does not
          affect them.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-takal-line p-6">
        <button
          onClick={() => on !== null && save(!on)}
          disabled={on === null || saving}
          className="inline-flex items-center gap-3 disabled:opacity-50"
        >
          <span
            className={`inline-block w-11 h-6 rounded-full relative transition-colors ${
              on ? "bg-slate-900" : "bg-amber-400"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                on ? "left-5" : "left-0.5"
              }`}
            />
          </span>
          <span className={`text-lg font-bold ${on ? "text-takal-ink" : "text-amber-700"}`}>
            {on === null ? "…" : on ? "ON" : "OFF"}
          </span>
        </button>

        {error && (
          <div className="mt-4">
            <ErrorState
              message={error.message}
              onRetry={read}
              denied={error.denied}
            />
          </div>
        )}

        <p className="text-sm text-takal-ink-soft mt-4">
          {on === null
            ? error
              ? "The setting above could not be read, so the switch cannot be used yet."
              : "Reading the current setting…"
            : on
            ? "A new shop or rider must enter the code we text them. This is the normal, safe setting."
            : "A new shop or rider can sign up without proving their phone. Every account made while this is off is written to the server log as a warning, so nothing is hidden."}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900 space-y-2">
        <p className="font-bold">When to switch it OFF</p>
        <p>
          Only for the few days between putting new backend code live and the new
          shop and rider apps appearing in the Play Store. The apps people already
          have do not show a code screen, so while this is ON they cannot sign up
          at all.
        </p>
        <p className="font-bold pt-1">Switch it back ON</p>
        <p>
          The day the new shop and rider app builds are live in the Play Store.
          Leaving it off means anyone can open a shop or rider account against
          somebody else&apos;s phone number.
        </p>
      </div>
    </div>
  );
}
