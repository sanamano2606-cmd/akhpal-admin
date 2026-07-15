"use client";

/**
 * Reusable skeleton loaders.
 *
 * These render the *shape* of a page instantly (grey shimmering blocks) while
 * the real data is still loading, so a page feels like it opens the moment you
 * click instead of showing a blank spinner. Built only from Tailwind's
 * `animate-pulse`, so there's nothing extra to load.
 */

export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

/** A few lines of fake text. */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Row of KPI/stat cards (dashboard header). */
export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
          <Shimmer className="h-3 w-1/2 mb-4" />
          <Shimmer className="h-7 w-2/3 mb-2" />
          <Shimmer className="h-2 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** A chart placeholder card. */
export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <Shimmer className="h-3 w-32 mb-4" />
      <Shimmer className="h-56 w-full" />
    </div>
  );
}

/** A standalone table skeleton (its own header + rows). */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-3">
        <Shimmer className="h-3 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50">
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer key={c} className={`h-3 ${c === 0 ? "w-1/4" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Just <tr> rows, to drop inside an existing <tbody> that's still loading. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-slate-50">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-6 py-4">
              <Shimmer className="h-3 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A grid of card placeholders (e.g. store cards). */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Shimmer className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Shimmer className="h-3 w-2/3 mb-2" />
              <Shimmer className="h-2 w-1/3" />
            </div>
          </div>
          <SkeletonLines lines={2} />
        </div>
      ))}
    </div>
  );
}
