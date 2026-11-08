"use client";
/**
 * HOW MANY SHOPS ARE READY TO SHOW - on the Stores line of the menu, for the
 * Main Admin only (change 5, Sana 8 Nov 2026: "one tap"). Only the Main Admin
 * can press Show, so only she is shown the number.
 *
 * Built like useWaitingShopsCount: one question however many places show it,
 * and a failed read shows no number rather than a wrong one. Asked every 5
 * minutes, and it reads the server's kept 5-minute copy (never ?fresh=1), so
 * the panel is not made slower by it.
 */
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { getMyPerms } from "@/lib/perms";

export const READY_COUNT_EVERY_MS = 5 * 60 * 1000;

let current = 0;
const listeners = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function ask() {
  let n = 0;
  try {
    if (getMyPerms().isSuper) {
      const r = (await apiClient.getReadyToShow()) as any;
      n = Array.isArray(r?.ready) ? r.ready.length : 0;
    }
  } catch {
    n = 0;
  }
  current = n;
  listeners.forEach((l) => l(n));
}

export function useReadyToShowCount(): number {
  const [n, setN] = useState(current);
  useEffect(() => {
    listeners.add(setN);
    if (!timer) {
      ask();
      timer = setInterval(ask, READY_COUNT_EVERY_MS);
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

/** After Show is pressed the number is asked again at once. */
export function refreshReadyToShowCount() {
  return ask();
}
