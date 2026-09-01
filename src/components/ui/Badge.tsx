"use client";

/**
 * A status pill.
 *
 * There used to be seven of these, one per page, written separately - and they
 * disagreed. "Suspended" was red on the Riders page and grey on the Stores
 * page, for the same meaning. The colour now comes from one map in theme.ts,
 * so a status looks the same wherever it appears.
 */

import type { ReactNode } from "react";
import { TONE_CLASS, toneFor, statusLabel, type Tone } from "./theme";

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Give it whatever the server sent - "on_the_way", "suspended" - and it picks
 *  both the wording and the colour. Never write either by hand again. */
export function StatusBadge({
  status,
  icon,
}: {
  status: string | null | undefined;
  icon?: ReactNode;
}) {
  return (
    <Badge tone={toneFor(status)} icon={icon}>
      {statusLabel(status)}
    </Badge>
  );
}
