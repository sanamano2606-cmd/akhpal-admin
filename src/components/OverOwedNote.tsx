"use client";

/**
 * The "you are paying more than is owed" step for every record-a-payment
 * window (admin audit low item 2, 6 October 2026). The words come from
 * src/lib/over-owed.ts.
 *
 *   const over = useOverOwed(overOwedSentence(...));
 *   // in submit:  if (!over.mayGo()) return;
 *   // in the form: <OverOwedNote over={over} />
 *
 * The first press shows the warning and saves nothing; the second press goes
 * ahead. Changing the amount (so the sentence changes) asks again.
 */

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { overOwedRefusal } from "@/lib/over-owed";

/** `resetKey` (the typed amount): a new amount asks again, also after the
 *  SERVER said it was more than is owed. */
export function useOverOwed(sentence: string, resetKey?: unknown) {
  const [shown, setShown] = useState(false);
  // The server's own "more than is owed" (money audit AREA-4-09, 21 Oct 2026),
  // shown in the same box; the next press says yes with `overpay`.
  const [serverWhy, setServerWhy] = useState("");
  useEffect(() => {
    setShown(false);
  }, [sentence]);
  useEffect(() => {
    setServerWhy("");
  }, [sentence, resetKey]);
  return {
    sentence: serverWhy || sentence,
    shown: (shown && !!sentence) || !!serverWhy,
    /** True when the office has SEEN that it is more than owed and pressed
     *  again - read before mayGo(); the payment is then sent with overpay. */
    confirmed: (shown && !!sentence) || !!serverWhy,
    /** True when the payment may be sent now. */
    mayGo(): boolean {
      if (serverWhy) return true;
      if (!sentence || shown) return true;
      setShown(true);
      return false;
    },
    /** A refusal from the server for being more than is owed: show it in the
     *  box and return true (the caller then says nothing else). */
    refused(err: unknown): boolean {
      const why = overOwedRefusal(err);
      if (!why) return false;
      setServerWhy(why);
      return true;
    },
  };
}

export function OverOwedNote({ over }: { over: { sentence: string; shown: boolean } }) {
  if (!over.shown) return null;
  return (
    <div
      role="alert"
      data-testid="over-owed-note"
      className="flex gap-2 rounded-lg border-2 border-takal-orange bg-takal-orange-soft p-3 text-sm text-takal-ink"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-takal-orange" />
      <span>{over.sentence}</span>
    </div>
  );
}
