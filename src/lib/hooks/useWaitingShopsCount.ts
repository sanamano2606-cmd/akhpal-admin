"use client";

/**
 * HOW MANY NEW SHOPS ARE WAITING FOR APPROVAL - on the Stores line of the
 * menu. (Audit 23 October 2026: "new vendors are registering and I am facing
 * difficulties in managing them". The only count was a Dashboard tile, so a
 * shop could sit for days unseen by anybody who went straight to work.)
 *
 * Built like useNeedsCallCount: one question a minute however many places
 * show it, asked only by somebody who may approve shops, and a failed read
 * shows no number rather than a wrong one.
 */

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { getMyPerms } from "@/lib/perms";
import { mayAccess } from "@/lib/navigation";

let current = 0;
const listeners = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function ask() {
  let n = 0;
  try {
    const perms = getMyPerms();
    if (mayAccess("stores.all", perms) && mayAccess("stores.approve", perms)) {
      const r = (await apiClient.getWaitingChecklists()) as any;
      n = Array.isArray(r?.shops) ? r.shops.length : Number(r?.count) || 0;
    }
  } catch {
    n = 0;
  }
  current = n;
  listeners.forEach((l) => l(n));
}

export function useWaitingShopsCount(): number {
  const [n, setN] = useState(current);
  useEffect(() => {
    listeners.add(setN);
    if (!timer) {
      ask();
      timer = setInterval(ask, 60 * 1000);
    }
    return () => {
      listeners.delete(setN);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return n;
}

/** After an approve or reject the number is asked again at once. */
export function refreshWaitingShopsCount() {
  return ask();
}
