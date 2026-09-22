"use client";

/**
 * CHANGE MY PASSWORD.  (Mock 108 v2, approved by Sana on 22 September 2026.)
 *
 * WHY THIS DID NOT EXIST UNTIL TODAY
 *
 * Sana, that morning, about the sub-admin she had just created:
 *     "And there is no Option for him to change his Password."
 *
 * She was right, and it was worse than an inconvenience. The SERVER has always
 * had this door - POST /auth/change-password, with a ten-character bar for
 * admins, a fifteen-minute lock after five wrong tries, and an audit line on
 * every wrong try. The PANEL never had a screen for it. So since Takal began,
 * no admin has ever been able to change their own password, and every
 * sub-admin has been using one that somebody else typed for them and then had
 * to say out loud.
 *
 * TWO JOBS, ONE SCREEN
 *   1. Any admin, whenever they like, from the menu.
 *   2. THE FIRST SIGN-IN. An account still carrying the password somebody else
 *      chose (users.must_change_password, migration 095) opens this by itself
 *      and cannot dismiss it - no X, no Escape, no click outside, no Cancel.
 *      That is the whole point: a password two people know must not survive
 *      the first day.
 *
 * WHAT IS **NOT** CHECKED HERE, ON PURPOSE
 * The current password, the ten-character bar, the attempt lock and the audit
 * line are the server's, and they stay the server's. Anything a browser
 * enforces can be stepped around with the developer tools. The browser only
 * does the one thing the server cannot do better: tell the person the two new
 * boxes disagree BEFORE spending a round trip on a slow connection.
 */

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import {
  MIN_ADMIN_PASSWORD, strengthOf, whyNotSave,
} from "@/lib/password-strength";

/**
 * The meter and the "may I save" rule live in @/lib/password-strength, away
 * from this screen, so they can be checked on their own. What is left here is
 * only the colour each step is drawn in - which is a drawing decision, not a
 * rule about passwords.
 */
const BAR = ["bg-takal-red w-1/3", "bg-takal-orange w-2/3", "bg-takal-green w-full"];
const WORD = ["text-takal-red", "text-takal-orange", "text-takal-green"];

function Field({
  label, value, onChange, hint, show, onToggle, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  show: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-takal-ink mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-2 border-takal-line rounded-lg px-4 py-3 pr-20 text-takal-ink focus:border-takal-yellow focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          // 44px, because this sits beside a password box on a phone.
          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100"
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          title={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <div className="mt-1 text-xs">{hint}</div>}
    </div>
  );
}

export function ChangePasswordModal({
  open,
  onClose,
  /** True on the first sign-in: no way out until it is done. */
  forced = false,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  forced?: boolean;
  onDone?: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showA, setShowA] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Nothing typed is kept between openings. A password left sitting in a
  // closed window is a password on the screen of whoever opens it next.
  useEffect(() => {
    if (!open) {
      setCurrent(""); setNext(""); setAgain("");
      setShowC(false); setShowN(false); setShowA(false);
      setError(""); setDone(false); setBusy(false);
    }
  }, [open]);

  const strength = useMemo(() => strengthOf(next), [next]);
  const bothMatch = next.length > 0 && next === again;
  const stop = whyNotSave(current, next, again);
  const canSave = !busy && stop === "";

  const save = async () => {
    setError("");
    if (stop) {
      setError(stop);
      return;
    }
    setBusy(true);
    try {
      await apiClient.changeMyPassword(current, next);
      setDone(true);
      onDone?.();
    } catch (e: any) {
      // The server writes these sentences for the person, not for a
      // programmer - "5 attempt(s) left before a 15-minute lock" - and the API
      // client has already put that sentence in `message`. It is shown as it
      // arrives rather than replaced with something vaguer, because "5 left"
      // is the only warning anybody gets before the account locks.
      setError(e?.message ||
               "Could not change the password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Password changed"
        hint="Every other device has been signed out."
        size="sm"
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <p className="text-sm text-takal-ink">
          Your new password is saved. You are still signed in here.
        </p>
        <p className="text-sm text-takal-ink-soft mt-2">
          Anywhere else you were signed in has been signed out, so a password
          somebody else knew cannot still be in use on another screen.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      lockClose={forced}
      title={forced ? "Choose your own password" : "Change password"}
      hint={
        forced
          ? "This account is still using the password somebody else typed for you."
          : "Everybody changes their own. Nobody sees anybody else's."
      }
      size="md"
      footer={
        <>
          {!forced && (
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!canSave}>
            Save password
          </Button>
        </>
      }
    >
      {forced && (
        <div className="mb-5 flex gap-3 rounded-lg border border-takal-yellow bg-takal-yellow-soft p-4">
          <Lock className="w-5 h-5 text-takal-ink flex-shrink-0 mt-0.5" />
          <p className="text-sm text-takal-ink">
            Until you do this, two people can sign in as you — you, and whoever
            typed your password into the Add Admin form. There is no way past
            this window.
          </p>
        </div>
      )}

      <Field
        label="Current password"
        value={current}
        onChange={setCurrent}
        show={showC}
        onToggle={() => setShowC((v) => !v)}
        autoFocus
      />

      <Field
        label="New password"
        value={next}
        onChange={setNext}
        show={showN}
        onToggle={() => setShowN((v) => !v)}
        hint={
          next.length === 0 ? (
            <span className="text-takal-ink-soft">
              At least {MIN_ADMIN_PASSWORD} characters.
            </span>
          ) : (
            <>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-1">
                <div className={`h-full rounded-full ${BAR[strength.step]}`} />
              </div>
              <span className={WORD[strength.step]}>{strength.word}</span>
              <span className="text-takal-ink-soft">
                {" "}· {next.length} characters
                {next.length < MIN_ADMIN_PASSWORD
                  ? `. At least ${MIN_ADMIN_PASSWORD} are needed.`
                  : ""}
              </span>
            </>
          )
        }
      />

      <Field
        label="Type it again"
        value={again}
        onChange={setAgain}
        show={showA}
        onToggle={() => setShowA((v) => !v)}
        hint={
          again.length === 0 ? null : bothMatch ? (
            <span className="text-takal-green">Both match.</span>
          ) : (
            <span className="text-takal-red">These are not the same.</span>
          )
        }
      />

      {error && (
        <div className="rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm text-takal-red">
          {error}
        </div>
      )}

      <ul className="mt-4 space-y-1 text-xs text-takal-ink-soft">
        <li>· Your current password is needed — nobody can change it without it.</li>
        <li>· Five wrong tries lock this account for fifteen minutes.</li>
        <li>· Wrong tries are written to the Audit Log.</li>
        <li>· Saving signs out every other device.</li>
      </ul>
    </Modal>
  );
}
