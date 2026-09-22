"use client";

/**
 * LETTING A LOCKED-OUT ADMIN BACK IN.  (Mock 110, approved 22 September 2026.)
 *
 * THE HOLE THIS CLOSES
 * An admin password could only ever be set when the account was CREATED. There
 * was no reset door on the server and no button here, so a forgotten password
 * killed the account: the only way back was to create the person again under a
 * different email, losing their permissions and leaving a dead row in the list.
 *
 * TWO STEPS, AND THE SECOND ONE MATTERS MOST
 *   1. Ask. The warning is blunt because the consequence is blunt: they are
 *      signed out everywhere the moment this is pressed.
 *   2. Hand it over. The new password is on the screen ONCE. It is not stored
 *      anywhere - the server keeps only a hash - so Copy, WhatsApp and Print
 *      are the whole of the way it reaches the person.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   * No way to see an EXISTING password. Nobody can; only a hash is kept.
 *   * No "do not make them change it". The mark is always set. A password two
 *     people know must not outlive the first sign-in.
 */

import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { makeAdminPassword } from "@/lib/make-admin-password";
import { MIN_ADMIN_PASSWORD, strengthOf } from "@/lib/password-strength";
import { toast } from "@/lib/toast";

const BAR = ["bg-takal-red w-1/3", "bg-takal-orange w-2/3", "bg-takal-green w-full"];
const WORD = ["text-takal-red", "text-takal-orange", "text-takal-green"];

export function ResetAdminPasswordModal({
  admin,
  onClose,
  onDone,
}: {
  /** null when the window is shut. */
  admin: { id: string; full_name?: string; email?: string } | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const who = admin?.full_name || admin?.email || "this admin";

  // A fresh suggestion each time the window opens, and nothing left behind when
  // it shuts - a password sitting in a closed window is a password on the
  // screen of whoever opens it next.
  useEffect(() => {
    if (admin) {
      setPw(makeAdminPassword());
      setShow(true);
      setError("");
      setDone(false);
    } else {
      setPw("");
      setShow(false);
      setError("");
      setDone(false);
      setBusy(false);
    }
  }, [admin]);

  const strength = strengthOf(pw);
  const tooShort = pw.length < MIN_ADMIN_PASSWORD;

  const messageFor = (password: string) =>
    [
      "Takal Admin - your new password",
      "",
      `Sign in at: ${typeof window !== "undefined" ? window.location.origin : ""}`,
      admin?.email ? `Email: ${admin.email}` : "",
      `Password: ${password}`,
      "",
      "You will be asked to choose your own password the first time you sign in.",
    ].filter(Boolean).join("\n");

  const reset = async () => {
    if (!admin) return;
    setError("");
    if (tooShort) {
      setError(`An admin password needs at least ${MIN_ADMIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      await apiClient.resetAdminPassword(admin.id, pw);
      setDone(true);
      onDone?.();
    } catch (e: any) {
      setError(e?.message || "Could not reset the password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    const w = window.open("", "_blank", "width=520,height=560");
    if (!w) {
      toast("Your browser blocked the print window. Use Copy instead.", "error");
      return;
    }
    const safe = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><meta charset="utf-8"><title>Takal Admin password</title>` +
      `<style>body{font-family:system-ui,Arial,sans-serif;padding:32px;color:#000}` +
      `h1{font-size:20px;margin:0 0 4px}pre{font-size:15px;line-height:1.7;` +
      `white-space:pre-wrap;border:2px solid #FFFF00;padding:16px;border-radius:8px}` +
      `small{color:#4A4A4A}</style>` +
      `<h1>Takal</h1><small>Keep this safe. It is not stored anywhere.</small>` +
      `<pre>${safe(messageFor(pw))}</pre>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  if (!admin) return null;

  // ── Step 2: hand it over ──────────────────────────────────────────────────
  if (done) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Done — give them this"
        hint="Shown once. Nobody can read it back afterwards."
        size="md"
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <div className="rounded-lg border border-takal-yellow bg-takal-yellow-soft p-4 mb-4">
          <p className="text-xs text-takal-ink-soft mb-1">New password for {who}</p>
          <p className="text-2xl font-bold text-takal-ink break-all font-mono">{pw}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(messageFor(pw));
              toast("Copied", "success");
            }}
          >
            📋 Copy
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(messageFor(pw))}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            💬 WhatsApp
          </Button>
          <Button variant="secondary" onClick={print}>🖨️ Print</Button>
        </div>

        <div className="mt-4 rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm">
          <p className="font-bold text-takal-ink">Close this and it is gone</p>
          <p className="text-takal-ink-soft">
            It is not stored anywhere — not in Takal, not in the database, not in
            the Audit Log. If it is lost, reset it again.
          </p>
        </div>

        <ul className="mt-4 space-y-1 text-xs text-takal-ink-soft">
          <li>· {who} was signed out of every device.</li>
          <li>· They must choose their own password on their next sign-in.</li>
          <li>· The Audit Log records that you did this, and when.</li>
        </ul>
      </Modal>
    );
  }

  // ── Step 1: ask ───────────────────────────────────────────────────────────
  return (
    <Modal
      open
      onClose={onClose}
      title="Reset this password"
      hint={who + (admin.email ? ` · ${admin.email}` : "")}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={reset} loading={busy} disabled={tooShort}>
            Reset password
          </Button>
        </>
      }
    >
      <div className="mb-5 flex gap-3 rounded-lg border border-takal-red bg-takal-red-soft p-4">
        <AlertTriangle className="w-5 h-5 text-takal-red flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-takal-ink">
            They are signed out everywhere, at once
          </p>
          <p className="text-takal-ink-soft">
            Anyone using the old password stops working immediately — including
            them, until you give them the new one.
          </p>
        </div>
      </div>

      <label className="block text-sm font-medium text-takal-ink mb-1">
        New password
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="off"
          className="w-full border-2 border-takal-line rounded-lg px-4 py-3 pr-24 font-mono text-takal-ink focus:border-takal-yellow focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-12 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100"
          aria-label={show ? "Hide the password" : "Show the password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setPw(makeAdminPassword())}
          className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-takal-ink-soft hover:bg-slate-100"
          aria-label="Make another password"
          title="Make another"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2">
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-1">
          <div className={`h-full rounded-full ${BAR[strength.step]}`} />
        </div>
        <span className={`text-xs ${WORD[strength.step]}`}>{strength.word}</span>
        <span className="text-xs text-takal-ink-soft">
          {" "}· {pw.length} characters. Made for you — you may type your own.
        </span>
      </div>

      <div className="mt-5 flex gap-3 rounded-lg border border-takal-line bg-takal-page p-3">
        <input type="checkbox" checked readOnly disabled className="mt-1" />
        <div className="text-sm">
          <p className="font-medium text-takal-ink">
            They must change it on their next sign-in
          </p>
          <p className="text-xs text-takal-ink-soft">
            Always on. It cannot be switched off — a password two people know
            must not outlive the first sign-in.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-takal-red bg-takal-red-soft p-3 text-sm text-takal-red">
          {error}
        </div>
      )}
    </Modal>
  );
}
