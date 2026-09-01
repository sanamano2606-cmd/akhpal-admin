// ─────────────────────────────────────────────────────────────────────────────
// One line in the category tree.
//
// The arrow that opens it, its name, how many products sit under it, and the
// buttons to hide it, move it up or down, edit it or delete it.
//
// Split out of page.tsx on 2026-08-30. Not one line changed.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Eye, EyeOff,
  ArrowUp, ArrowDown, } from "lucide-react";
import { verticalLabel } from "@/lib/verticals";

import { Cat, ShopType, Node } from "./parts-types";

export function Row({
  node,
  siblings,
  filtering,
  isOpen,
  toggle,
  onEdit,
  onDelete,
  onToggleActive,
  onMove,
  onLinkShops,
  shopTypes,
}: {
  node: Node;
  siblings: Node[];
  filtering: boolean;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  onEdit: (c: Partial<Cat>) => void;
  onDelete: (n: Node) => void;
  onToggleActive: (n: Node) => void;
  onMove: (n: Node, siblings: Node[], dir: -1 | 1) => void;
  onLinkShops: (n: Node) => void;
  shopTypes: ShopType[];
}) {
  const hasKids = node.children.length > 0;
  const opened = isOpen(node.id);
  const i = siblings.findIndex((s) => s.id === node.id);

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-takal-page"
        style={{ paddingLeft: 12 + node.depth * 24 }}
      >
        <button
          onClick={() => hasKids && toggle(node.id)}
          className={`w-6 h-6 flex items-center justify-center rounded ${
            hasKids ? "text-takal-ink-soft hover:bg-slate-200" : "opacity-0 cursor-default"
          }`}
          aria-label={opened ? "Collapse" : "Expand"}
        >
          {opened ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <span className="w-6 text-center">{node.icon || ""}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-medium ${
                node.is_active ? "text-takal-ink" : "text-takal-disabled-text line-through"
              }`}
            >
              {node.name}
            </span>
            {node.depth === 0 &&
              node.taxonomy_version !== "v2" &&
              node.vendor_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-takal-ink-soft">
                  {verticalLabel(node.vendor_type)}
                </span>
              )}
            {/* The new list keeps shop types in their own table, because one
                department can be sold by several kinds of shop. */}
            {node.depth === 0 && node.taxonomy_version === "v2" && (
              <button
                onClick={() => onLinkShops(node)}
                title="Choose which kinds of shop may sell in this department"
                className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-takal-ink-soft hover:bg-slate-200 max-w-md truncate"
              >
                {(node.shop_types || []).length
                  ? (node.shop_types || [])
                      .map((c) => shopTypes.find((t) => t.code === c)?.name || c)
                      .join(", ")
                  : "No shop type yet - click to choose"}
              </button>
            )}
            {!node.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Hidden
              </span>
            )}
          </div>
          <div className="text-xs text-takal-disabled-text">
            {node.slug || "no web name"}
            {" · "}
            {node.total} product{node.total === 1 ? "" : "s"}
            {hasKids ? ` · ${node.children.length} inside` : ""}
          </div>
        </div>

        <button
          onClick={() => onMove(node, siblings, -1)}
          disabled={filtering || i <= 0}
          title={filtering ? "Clear the search to reorder" : "Move up"}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-25"
        >
          <ArrowUp size={15} />
        </button>
        <button
          onClick={() => onMove(node, siblings, 1)}
          disabled={filtering || i < 0 || i >= siblings.length - 1}
          title={filtering ? "Clear the search to reorder" : "Move down"}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-25"
        >
          <ArrowDown size={15} />
        </button>
        <button
          onClick={() => onToggleActive(node)}
          title={node.is_active ? "Hide from customers" : "Show to customers"}
          className="p-1.5 rounded hover:bg-slate-200 text-takal-ink-soft"
        >
          {node.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onClick={() =>
            onEdit({
              parent_id: node.id,
              display_order: 999,
              is_active: true,
              taxonomy_version: node.taxonomy_version || null,
            })
          }
          title="Add one inside this"
          className="p-1.5 rounded hover:bg-slate-200 text-takal-ink-soft"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={() => onEdit(node)}
          title="Edit"
          className="p-1.5 rounded hover:bg-slate-200 text-takal-ink-soft"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => onDelete(node)}
          title="Delete"
          className="p-1.5 rounded hover:bg-red-50 text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {opened &&
        node.children.map((c) => (
          <Row
            key={c.id}
            node={c}
            siblings={node.children}
            filtering={filtering}
            isOpen={isOpen}
            toggle={toggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
            onMove={onMove}
            onLinkShops={onLinkShops}
            shopTypes={shopTypes}
          />
        ))}
    </>
  );
}
