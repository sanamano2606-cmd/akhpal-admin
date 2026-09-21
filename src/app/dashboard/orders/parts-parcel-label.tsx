"use client";

/**
 * THE PARCEL LABEL — the paper stuck ON THE OUTSIDE of the box.
 *
 * Mock 94, APPROVED by Sana on 18 September 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS THE OPPOSITE OF THE RECEIPT, AND THAT IS THE WHOLE POINT.
 *
 * The receipt (parts-customer-receipt.tsx) is SEALED INSIDE the parcel and is
 * read by the customer, so it names every item and the size or colour they
 * chose. This is stuck on the OUTSIDE, where anyone who handles the box can
 * read it — the Takal staff who carry standard parcels, whoever opens the
 * door, anyone standing near it.
 *
 * Sana, 18 September 2026: Swat is a small place and a customer may order
 * something private. So, from docs/PRIVACY-AND-CONTACT-RULES.md §7:
 *
 *   ✓ Customer name, phone, address, order number
 *   ✓ The SHOP'S NAME
 *   ✓ The amount to collect
 *   ✓ Takal's own phone and email, so the customer can ask about anything
 *   ✗ NEVER a product name, a size or a colour
 *   ✗ NEVER the shop's phone number — a customer reaches a shop through Takal
 *   ✗ NEVER the 4-digit delivery code
 *
 * There are tests named after those lines in tests/parcel-label.test.ts. This
 * component is never handed the order's items at all, so a product cannot
 * reach it even by accident.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TWO PAPER SIZES, ONE LABEL.
 *
 *   "roll"  80mm thermal roll — the printer Takal ALREADY has, the one the
 *           receipt comes off. This is the default: no second machine and no
 *           second kind of paper.
 *   "4x6"   100×150mm, what every courier uses. Chosen when there is a real
 *           label printer.
 *
 * BLACK ONLY. A thermal head burns black dots and can do nothing else, so the
 * brand yellow would come out as grey mush. Emphasis here is size, weight and
 * ONE black band on the amount — the single number that must not be misread.
 */

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import qrcode from "qrcode-generator";
import { money, orderCode } from "@/lib/format";
import { code128Bars } from "@/lib/code128";
import { CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_NAME } from "@/lib/contact";
import { qrTarget, type ReceiptSettings } from "./parts-customer-receipt";

export type LabelSize = "roll" | "4x6";

/** The label, and nothing else, on the paper it was made for. */
const PRINT_CSS = (size: LabelSize) => `
@media print {
  body > *:not(#takal-label-root) { display: none !important; }
  #takal-label-root { display: block !important; }
  .takal-label { break-after: page; page-break-after: always; }
  .takal-label:last-child { break-after: auto; page-break-after: auto; }
  @page { size: ${size === "4x6" ? "100mm 150mm" : "80mm auto"}; margin: 0; }
}
#takal-label-root { display: none; }
`;

/**
 * THE BARCODE, drawn as plain rectangles.
 *
 * No image, no font, nothing to fetch — so it cannot be missing at the moment
 * the print dialog asks for the page. If the order number cannot be encoded,
 * nothing is drawn and the number printed underneath still identifies the
 * parcel.
 */
function Barcode({ value, width, height }: { value: string; width: string; height: string }) {
  const runs = useMemo(() => code128Bars(value), [value]);
  if (!runs) return null;
  const total = runs.reduce((a, b) => a + b, 0);
  let x = 0;
  const rects: { x: number; w: number }[] = [];
  runs.forEach((run, i) => {
    if (i % 2 === 0) rects.push({ x, w: run });   // even runs are bars
    x += run;
  });
  return (
    <svg
      viewBox={`0 0 ${total} 10`}
      preserveAspectRatio="none"
      style={{ width, height, display: "block" }}
      shapeRendering="crispEdges"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={10} fill="#000" />
      ))}
    </svg>
  );
}

/** One parcel's worth of paper. NEVER given the order's items. */
export function ParcelLabelBody({
  order,
  settings,
  size = "roll",
}: {
  order: any;
  settings?: ReceiptSettings;
  size?: LabelSize;
}) {
  const short = orderCode(order).toUpperCase();
  const code = `TKL-${short}`;
  const phone = (settings?.support_phone ?? CONTACT_PHONE ?? "").trim();
  const email = (settings?.support_email ?? CONTACT_EMAIL ?? "").trim();
  const whatsapp = (settings?.support_whatsapp ?? "").trim();

  // WHO IS CARRYING IT. The badge is the only difference between the two, so
  // the office can tell a rider's parcel from a staff parcel at a glance on a
  // stack of printed labels.
  const isParcel = order?.delivery_type === "standard";
  const service = isParcel ? "STANDARD" : "EXPRESS";
  const carrier = isParcel ? "TAKAL STAFF" : "RIDER";

  // WHO TO HAND IT TO. An order can be placed for somebody else, and it is the
  // receiver who opens the door.
  const name =
    (order?.receiver_name || order?.customer_name || "").toString().trim() || "Customer";
  const tel = (order?.receiver_phone || order?.customer_phone || "").toString().trim();

  // THE ONE NUMBER THAT MUST NOT BE MISREAD. `paid_online` is worked out by
  // the server; a cash order is everything else. Rs 0 is never printed as an
  // amount, because "collect Rs 0" reads like a mistake — it says so in words.
  const paidOnline = order?.paid_online === true;
  const amount = Number(order?.total_amount || 0);

  const target = useMemo(
    () => qrTarget(`#${short}`, phone, email, whatsapp),
    [short, phone, email, whatsapp]
  );
  const qrSvg = useMemo(() => {
    if (!target) return null;
    try {
      const qr = qrcode(0, "M");
      qr.addData(target.url);
      qr.make();
      return qr.createSvgTag({ cellSize: 3, margin: 0 });
    } catch {
      return null;   // a label without a QR is still a label; a crash is not
    }
  }, [target]);

  const big = size === "4x6";
  const W = big ? "100mm" : "80mm";
  const pad = big ? "4mm" : "3mm";

  return (
    <div
      className="takal-label"
      style={{
        width: W,
        ...(big ? { height: "150mm" } : {}),
        background: "#fff",
        color: "#000",
        fontFamily: "Roboto, Arial, system-ui, sans-serif",
        lineHeight: 1.3,
        border: "1mm solid #000",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* ── 1. BRAND BAND ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "2.5mm", padding: `${pad} ${pad} 2mm` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: big ? "7mm" : "5.6mm", fontWeight: 900, letterSpacing: "0.5mm", lineHeight: 1 }}>
            {BUSINESS_NAME.toUpperCase()}
          </div>
          <div style={{ fontSize: "2.3mm", letterSpacing: "0.4mm", marginTop: "0.6mm" }}>
            FOOD &amp; GROCERY DELIVERY &middot; SWAT
          </div>
        </div>
        <div style={{ background: "#000", color: "#fff", padding: big ? "2mm 3mm" : "1.6mm 2.4mm", textAlign: "center" }}>
          <div style={{ fontSize: big ? "4.4mm" : "3.4mm", fontWeight: 900, lineHeight: 1 }}>{service}</div>
          <div style={{ fontSize: "2.1mm", letterSpacing: "0.3mm", marginTop: "0.7mm" }}>{carrier}</div>
        </div>
      </div>
      <div style={{ height: "0.8mm", background: "#000" }} />

      {/* ── 2. BARCODE, with the number under it in case a scan fails ── */}
      <div style={{ padding: `2.2mm ${pad} 1.8mm`, textAlign: "center" }}>
        <Barcode value={code} width={big ? "88mm" : "70mm"} height={big ? "13mm" : "11mm"} />
        <div style={{ fontSize: big ? "3.6mm" : "3.2mm", fontWeight: 700, letterSpacing: "1mm", marginTop: "1mm" }}>
          {code}
        </div>
      </div>
      <div style={{ height: "0.3mm", background: "#000" }} />

      {/* ── 3. DELIVER TO — the biggest block on the paper ── */}
      <div style={{ padding: `2.6mm ${pad}`, flex: 1 }}>
        <div style={{ fontSize: "2.4mm", fontWeight: 900, letterSpacing: "0.9mm" }}>DELIVER TO</div>
        <div style={{ fontSize: big ? "6.2mm" : "5.2mm", fontWeight: 900, lineHeight: 1.05, marginTop: "1.5mm" }}>
          {name}
        </div>
        {tel ? (
          <div style={{ fontSize: big ? "5mm" : "4.4mm", fontWeight: 700, marginTop: "1.2mm", fontVariantNumeric: "tabular-nums" }}>
            {tel}
          </div>
        ) : null}
        <div style={{ fontSize: big ? "3.9mm" : "3.5mm", marginTop: "1.8mm", wordBreak: "break-word" }}>
          {order?.delivery_address || "No address on this order — phone the customer"}
        </div>
        {order?.address_details ? (
          <div style={{ fontSize: "3mm", marginTop: "0.9mm", wordBreak: "break-word" }}>
            {order.address_details}
          </div>
        ) : null}
      </div>

      <div style={{ height: "0.3mm", background: "#000" }} />

      {/* ── 4. FROM — the shop's NAME. Never its phone number. ── */}
      <div style={{ padding: `1.8mm ${pad}`, display: "flex", alignItems: "baseline", gap: "2.2mm" }}>
        <div style={{ fontSize: "2.2mm", fontWeight: 900, letterSpacing: "0.8mm" }}>FROM</div>
        <div style={{ fontSize: big ? "3.8mm" : "3.5mm", fontWeight: 700 }}>
          {order?.restaurant_name || BUSINESS_NAME}
        </div>
      </div>

      {/* ── 5. COLLECT — white on black, the heaviest thing here ── */}
      <div
        style={{
          background: "#000",
          color: "#fff",
          padding: `${big ? "3mm" : "2.4mm"} ${pad}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2mm",
        }}
      >
        <div>
          <div style={{ fontSize: "2.5mm", fontWeight: 700, letterSpacing: "0.7mm", whiteSpace: "nowrap" }}>
            {paidOnline ? "NOTHING TO COLLECT" : "COLLECT ON DELIVERY"}
          </div>
          <div style={{ fontSize: "2.3mm", marginTop: "0.7mm" }}>
            {paidOnline ? "Already paid online" : "Cash · ask for the customer’s code"}
          </div>
        </div>
        {paidOnline ? (
          <div style={{ fontSize: big ? "5mm" : "4.4mm", fontWeight: 900, whiteSpace: "nowrap" }}>PAID</div>
        ) : (
          // "Rs" and the amount on ONE line, tight (Sana, 18 September 2026).
          <div style={{ whiteSpace: "nowrap", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: big ? "5.4mm" : "4.6mm", fontWeight: 900, verticalAlign: big ? "0.9mm" : "0.7mm" }}>
              Rs
            </span>
            <span style={{ fontSize: big ? "9.6mm" : "8.2mm", fontWeight: 900, marginLeft: "1.1mm" }}>
              {money(amount).replace(/^Rs\s*/i, "")}
            </span>
          </div>
        )}
      </div>

      {/* ── 6. TAKAL'S OWN CONTACT — never the shop's ── */}
      <div style={{ display: "flex", gap: "2.5mm", padding: `2.4mm ${pad} ${pad}` }}>
        {qrSvg ? (
          <div
            style={{ width: big ? "14mm" : "12mm", height: big ? "14mm" : "12mm", flex: "none" }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "2.8mm", fontWeight: 700 }}>Any question about this parcel?</div>
          {phone ? <div style={{ fontSize: "3.1mm", fontWeight: 700, marginTop: "0.7mm" }}>{phone}</div> : null}
          {email ? <div style={{ fontSize: "2.7mm", wordBreak: "break-all" }}>{email}</div> : null}
          {!phone && !email ? (
            <div style={{ fontSize: "2.5mm" }}>
              Set a phone and email in Settings so this label can carry them
            </div>
          ) : null}
          <div style={{ fontSize: "2.3mm", marginTop: "0.8mm" }}>
            Do not accept if the seal is broken
          </div>
        </div>
      </div>
    </div>
  );
}

/** The hidden print area, the stylesheet, and opening the dialog once drawn. */
function LabelPrinter({
  open,
  size,
  onDone,
  children,
}: {
  open: boolean;
  size: LabelSize;
  onDone: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    // One tick, so the browser has drawn the paper before the dialog opens.
    const t = setTimeout(() => {
      window.print();
      onDone();
    }, 120);
    return () => clearTimeout(t);
  }, [open, onDone]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS(size) }} />
      <div id="takal-label-root">{children}</div>
    </>,
    document.body
  );
}

/** One parcel's label, printed from the order page. */
export function ParcelLabel({
  open,
  order,
  settings,
  size = "roll",
  onDone,
}: {
  open: boolean;
  order: any;
  settings?: ReceiptSettings;
  size?: LabelSize;
  onDone: () => void;
}) {
  return (
    <LabelPrinter open={open} size={size} onDone={onDone}>
      <ParcelLabelBody order={order} settings={settings} size={size} />
    </LabelPrinter>
  );
}

/**
 * MANY LABELS AT ONCE, from the Parcels desk — where packing actually happens.
 * Only the ORDERS are passed in. The items are not, and cannot be.
 */
export function ParcelLabelBatch({
  open,
  orders,
  settings,
  size = "roll",
  onDone,
}: {
  open: boolean;
  orders: any[];
  settings?: ReceiptSettings;
  size?: LabelSize;
  onDone: () => void;
}) {
  return (
    <LabelPrinter open={open && orders.length > 0} size={size} onDone={onDone}>
      {orders.map((o, i) => (
        <ParcelLabelBody key={o?.id ?? i} order={o} settings={settings} size={size} />
      ))}
    </LabelPrinter>
  );
}
