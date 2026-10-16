"use client";

/**
 * HOW MANY CUSTOMERS NEED A CALL  (Mock 198, board 3: the red "1 call" beside
 * Orders in the menu, and "Needs a call · 1" on the tab).
 *
 * ONE question to the server, once a minute, however many places show the
 * number - the menu and the Orders tabs share it. Asked only by somebody who
 * may open the All Orders tab (the server refuses anybody else anyway), and a
 * failed read shows no number rather than a wrong one.
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
    if (mayAccess("orders.all", getMyPerms())) {
      const r = await apiClient.getNeedsCall();
      n = Number(r?.count) || 0;
    }
  } catch {
    // A badge is a nicety. If it cannot be read the menu still works - and a
    // number nobody checked is worse than no number.
    n = 0;
  }
  current = n;
  listeners.forEach((l) => l(n));
}

export function useNeedsCallCount(): number {
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

/** After an answer the number is asked again at once, not in a minute. */
export function refreshNeedsCallCount() {
  return ask();
}
