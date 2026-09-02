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
import {
  TONE_CLASS,
  toneFor,
  statusLabel,
  ORDER_STATUS,
  orderStatusLabel,
  type Tone,
} from "./theme";

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

/**
 * An ORDER'S status, in words a person can read, with a dot that separates the
 * ones sharing a colour.
 *
 * `StatusBadge` above prints whatever the server sent, tidied up: "At hub".
 * Nobody in the office knows what a hub is. This one says "At a Takal office",
 * and gives `accepted` and `preparing` - both blue, because both mean the order
 * is moving - a different dot so they can be told apart at a glance.
 */
export function OrderStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const known = ORDER_STATUS[String(status ?? "").toLowerCase()];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
        TONE_CLASS[known?.tone ?? toneFor(status)]
      }`}
    >
      {known && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: known.dot }}
        />
      )}
      {orderStatusLabel(status)}
    </span>
  );
}
