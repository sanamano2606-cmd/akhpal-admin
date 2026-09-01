"use client";

/** A white panel on the grey page. Every box in the panel is one of these. */

import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  /** Set when the card holds plain content rather than a header + table. */
  padded?: boolean;
}) {
  return (
    <div
      className={`bg-takal-card rounded-xl border border-takal-line ${
        padded ? "p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  right,
}: {
  title: ReactNode;
  /** One plain sentence saying what this box is for. */
  hint?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-takal-line flex items-start justify-between gap-4">
      <div>
        <h3 className="font-bold text-takal-ink">{title}</h3>
        {hint && <p className="text-xs text-takal-ink-soft mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

/** The big number boxes across the top of a page. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** "money-in" is green, "money-out" is red, "warn" is amber. Use them only
   *  when the direction of the money is the point - not for decoration. */
  tone?: "default" | "money-in" | "money-out" | "warn";
}) {
  // Brand Kit meaning colours: green is money in, red is money out, orange is
  // "needs you". They used to be Tailwind's own green-700 / red-700 / amber-700,
  // which are not Takal's colours at all.
  const valueClass = {
    default: "text-takal-ink",
    "money-in": "text-takal-green",
    "money-out": "text-takal-red",
    warn: "text-takal-orange",
  }[tone];
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-takal-ink-soft">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {hint && <p className="text-xs text-takal-ink-soft mt-1">{hint}</p>}
    </Card>
  );
}
