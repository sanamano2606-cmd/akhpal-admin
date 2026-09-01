"use client";

/**
 * The three things a screen shows when it is NOT showing data.
 *
 * Fifteen pages in this panel had none of them. A failed load raised a toast
 * that faded after three seconds and left a permanently blank screen with no
 * way to try again. Six other places turned a failure into an empty list, so a
 * permission refusal was reported to the operator as "there is nothing here" -
 * a statement about the world, when the truth was about their account.
 *
 * Every page gets four states now: loading, empty, error-with-retry, content.
 */

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  title = "Nothing here yet",
  message,
  action,
  icon,
}: {
  title?: string;
  message?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-takal-disabled-text">
        {icon ?? <Inbox className="w-6 h-6" />}
      </div>
      <p className="font-bold text-takal-ink">{title}</p>
      {message && <p className="text-sm text-takal-ink-soft mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  /** Set when the failure was a permission refusal. The wording and the icon
   *  change, and no Retry button is offered - trying again cannot help, and a
   *  button that cannot work is worse than no button. */
  denied = false,
}: {
  message: ReactNode;
  onRetry?: () => void;
  denied?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
        denied
          ? "bg-takal-orange-soft border-[#FFD2BF] text-[#C8410F]"
          : "bg-takal-red-soft border-[#F3C2C7] text-takal-red"
      }`}
    >
      {denied ? (
        <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 text-sm">{message}</div>
      {onRetry && !denied && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-takal-ink-soft">
      <span
        aria-hidden
        className="w-5 h-5 rounded-full border-2 border-takal-line border-t-takal-yellow-dark animate-spin"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
