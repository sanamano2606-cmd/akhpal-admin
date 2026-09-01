"use client";

/**
 * The one table.
 *
 * Three problems this fixes, all of them found in the live panel:
 *
 * 1. THE COLUMN COUNT CANNOT BE WRONG ANY MORE. Every table used to declare
 *    its headings, and then separately tell the loading skeleton how many
 *    columns to draw, and then separately tell the empty row how far to span.
 *    Two pages had those three numbers disagreeing - the Orders table drew 8
 *    grey cells into a 7-column table, and Stores drew 6 into 7. Here all
 *    three are taken from ONE list of columns, so they cannot drift.
 *
 * 2. ONE SET OF PADDINGS. There were three in use across the panel, plus a
 *    fourth global default in globals.css that every page overrode.
 *
 * 3. IT NEVER SCROLLS THE PAGE SIDEWAYS. The table scrolls inside its own box.
 *    The live Riders page pushes its Actions column off the right of a normal
 *    laptop screen, so the buttons cannot be reached without scrolling the
 *    whole page.
 */

import type { ReactNode } from "react";
import { EmptyState } from "./States";

export type Column<Row> = {
  /** Used as the React key. */
  key: string;
  header: ReactNode;
  /** How to draw the cell. Given the row, returns whatever should be in it. */
  cell: (row: Row, index: number) => ReactNode;
  /** Right-align it. Use for money and counts, so the digits line up. */
  numeric?: boolean;
  /** Hide below a medium screen, for a column that is nice-to-have. */
  hideOnSmall?: boolean;
  className?: string;
};

export function Table<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  empty,
  onRowClick,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  loading?: boolean;
  skeletonRows?: number;
  /** What to show when there are no rows. A sentence, or a full EmptyState. */
  empty?: ReactNode;
  onRowClick?: (row: Row) => void;
}) {
  const colCount = columns.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={[
                  "px-6 py-4 text-left font-bold text-takal-ink bg-takal-page border-b border-takal-line whitespace-nowrap",
                  c.numeric ? "text-right" : "",
                  c.hideOnSmall ? "hidden md:table-cell" : "",
                  c.className ?? "",
                ].join(" ")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            // The skeleton takes its width from `columns`, so it always
            // matches the table it is standing in for.
            Array.from({ length: skeletonRows }).map((_, r) => (
              <tr key={`skeleton-${r}`} className="border-b border-takal-line">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-6 py-4 ${c.hideOnSmall ? "hidden md:table-cell" : ""}`}
                  >
                    <div className="animate-pulse rounded-md bg-takal-line h-3 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="border-b border-takal-line">
                {typeof empty === "string" || empty == null ? (
                  <EmptyState message={empty ?? undefined} />
                ) : (
                  empty
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "border-b border-takal-line hover:bg-takal-yellow-soft transition",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={[
                      "px-6 py-4 align-middle",
                      c.numeric ? "text-right tabular-nums" : "",
                      c.hideOnSmall ? "hidden md:table-cell" : "",
                      c.className ?? "",
                    ].join(" ")}
                  >
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
