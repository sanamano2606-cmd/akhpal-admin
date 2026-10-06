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

export function useOverOwed(sentence: string) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
  }, [sentence]);
  return {
    sentence,
    shown: shown && !!sentence,
    /** True when the payment may be sent now. */
    mayGo(): boolean {
      if (!sentence || shown) return true;
      setShown(true);
      return false;
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
