"use client";

/** Tabs across the top of a page. One look, wherever they appear. */

import type { ReactNode } from "react";

export type Tab<T extends string = string> = {
  id: T;
  label: ReactNode;
  /** A small number beside the label - a pending count, for instance. */
  count?: number;
};

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="border-b border-takal-line flex gap-1 overflow-x-auto" role="tablist">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={[
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition",
              on
                ? "border-takal-yellow text-takal-ink font-bold"
                : "border-transparent text-takal-ink-soft hover:text-takal-ink",
            ].join(" ")}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-takal-orange text-white text-xs font-bold">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
