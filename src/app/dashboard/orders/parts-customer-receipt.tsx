"use client";

/**
 * THE CUSTOMER'S RECEIPT — the piece of paper packed inside the parcel.
 *
 * Sana, 2 September 2026: "I want a print of the receipt to pack inside the
 * parcel. That will be printed on small paper size / thermal printer."
 *
 * And, in the same message, the thing that made the old rider slip pointless:
 * "you know the rider will be assigned, so everything he will have in the
 * rider app." She is right. The A5 rider slip was the same information twice -
 * once on his screen and once on paper that goes in a bin - and it needed two
 * pages for a one-item order. It has been deleted.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS DOCUMENT FOLLOWS THE OPPOSITE PRIVACY RULES TO THE RIDER SLIP.
 *
 * That is the whole reason it is a separate file and not a smaller version of
 * the old one. The rider slip carried BOTH phone numbers, because a rider
 * cannot do the job without them. This is read by the CUSTOMER, and under
 * Sana's own rule (docs/PRIVACY-AND-CONTACT-RULES.md, section 3):
 *
 *   ✗ NEVER the shop's phone number. A customer reaches a shop through Takal.
 *   ✗ NEVER the 4-digit delivery code.
 *   ✗ NEVER what the rider was paid.
 *   ✗ NEVER Takal's commission or mark-up. The customer sees what they paid,
 *     never what Takal kept out of it.
 *   ✓ Takal's own phone and email, which Sana sets in Settings.
 *
 * There are tests named after every one of those lines.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY IT IS BUILT THE WAY IT IS, FOR A THERMAL PRINTER
 *
 *   80mm ROLL, ENDLESS LENGTH. `@page { size: 80mm auto }`. "auto" is what
 *   makes the paper cut where the receipt ends. The old A5 slip ran to two
 *   pages on a one-item order; on a roll there are no pages to run onto.
 *
 *   BLACK ONLY. A thermal head burns black dots and can do nothing else. The
 *   yellow "COLLECT" box on the rider slip would come out as grey mush or
 *   as nothing at all. Emphasis here is size, weight, rules and ONE black
 *   band on the total - which is the only line that has to be unmissable.
 *
 *   NARROW. 80mm of paper leaves about 72mm to print on. Item names wrap
 *   rather than being cut off, because a cut-off item name on a receipt is
 *   how an argument about what was in the parcel starts.
 */

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import qrcode from "qrcode-generator";
import { money, fmtDateTime } from "@/lib/format";
import { CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_NAME } from "@/lib/contact";

/** Only the receipt goes on the roll, and the roll decides its own length.
 *
 *  `break-after: page` between receipts is what makes a thermal printer CUT
 *  between them when several are printed at once. Without it five receipts
 *  come out as one long unbroken strip that somebody has to cut by hand, and
 *  the cut lands in the middle of an order. */
const PRINT_CSS = `
@media print {
  body > *:not(#takal-receipt-root) { display: none !important; }
  #takal-receipt-root { display: block !important; }
  .takal-receipt { break-after: page; page-break-after: always; }
  .takal-receipt:last-child { break-after: auto; page-break-after: auto; }
  @page { size: 80mm auto; margin: 0; }
}
#takal-receipt-root { display: none; }
`;

/**
 * WHAT THE QR CODE OPENS.
 *
 * A code that opens nothing useful is decoration, so this is chosen in order
 * of what actually helps somebody holding the receipt:
 *
 *   1. WhatsApp Takal, with the order number already written in the message.
 *      In Pakistan this is how people complain about an order, and it saves
 *      them typing a reference they will otherwise get wrong.
 *   2. Failing that, ring Takal.
 *   3. Failing that, email Takal.
 *   4. Failing all three, no code at all - because a QR that goes nowhere is
 *      worse than no QR.
 *
 * WhatsApp needs the number in international form. A Pakistani number typed as
 * 0300 1234567 becomes 923001234567. A number already typed with 92 or +92 is
 * left alone, so it is never doubled.
 */
function whatsappNumber(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.length === 10) return "92" + digits;
  return digits;
}

function qrTarget(
  code: string,
  phone: string,
  email: string,
  whatsapp: string
): { url: string; caption: string } | null {
  const label = `Takal order ${code}`;
  const wa = whatsappNumber(whatsapp || phone);
  if (whatsapp && wa) {
    return {
      url: `https://wa.me/${wa}?text=${encodeURIComponent(label + " - ")}`,
      caption: "Scan to message us on WhatsApp about this order",
    };
  }
  if (phone) {
    return {
      url: `tel:${phone.replace(/[^\d+]/g, "")}`,
      caption: "Scan to call Takal about this order",
    };
  }
  if (email) {
    return {
      url: `mailto:${email}?subject=${encodeURIComponent(label)}`,
      caption: "Scan to email Takal about this order",
    };
  }
  return null;
}

function Row({
  k,
  v,
  bold,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 6,
        padding: "1.2mm 0",
        fontSize: "3.1mm",
        fontWeight: bold ? 700 : 400,
      }}
    >
      <span>{k}</span>
      <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}

const RULE = { borderTop: "0.4mm dashed #000", margin: "2mm 0" } as const;

export type ReceiptSettings = {
    support_phone?: string | null;
    support_email?: string | null;
    support_whatsapp?: string | null;
    return_window_days_standard?: number | null;
    return_window_hours_quick?: number | null;
} | null;

/** ONE receipt's worth of paper.
 *
 *  Shared by the single print from an order, and by the batch print from the
 *  Parcels desk. Two copies of this would be two receipts that slowly stopped
 *  agreeing about what a customer is shown - and one of them would be the one
 *  that leaks the shop's phone number. */
export function ReceiptBody({
  order,
  items,
  settings,
}: {
  order: any;
  items: any[];
  settings?: ReceiptSettings;
}) {
  const code = `#${String(order?.id ?? "").slice(0, 8).toUpperCase()}`;
  const phone = (settings?.support_phone ?? CONTACT_PHONE ?? "").trim();
  const email = (settings?.support_email ?? CONTACT_EMAIL ?? "").trim();
  const whatsapp = (settings?.support_whatsapp ?? "").trim();

  const paidOnline = order?.paid_online === true;
  const isParcel = order?.delivery_type === "standard";
  const goods = Number(order?.subtotal || 0);
  const fee = Number(order?.delivery_fee || 0);
  const credit = Number(order?.credit_used || 0);
  const total = Number(order?.total_amount || 0);

  // HOW LONG THEY HAVE TO ASK FOR A RETURN, read from the settings rather than
  // typed here. A number printed on paper that disagrees with what the app
  // will actually allow is a promise Takal cannot keep.
  const days = Number(settings?.return_window_days_standard ?? 0);
  const hours = Number(settings?.return_window_hours_quick ?? 0);
  const returnLine = isParcel
    ? days > 0
      ? `You can ask to return this within ${days} day${days === 1 ? "" : "s"}.`
      : null
    : hours > 0
    ? `You can report a problem with this order within ${hours} hour${hours === 1 ? "" : "s"}.`
    : null;

  const target = useMemo(
    () => qrTarget(code, phone, email, whatsapp),
    [code, phone, email, whatsapp]
  );

  const qrSvg = useMemo(() => {
    if (!target) return null;
    try {
      const qr = qrcode(0, "M");
      qr.addData(target.url);
      qr.make();
      // cellSize 3 gives roughly a 25mm square on an 80mm roll — big enough
      // for a phone camera, small enough not to eat the paper.
      return qr.createSvgTag({ cellSize: 3, margin: 0 });
    } catch {
      // A receipt without a QR is still a receipt. A crash is not.
      return null;
    }
  }, [target]);

  return (
      <div
        className="takal-receipt"
        style={{
          width: "80mm",
          padding: "4mm",
          background: "#fff",
          color: "#000",
          fontFamily: "Roboto, Arial, system-ui, sans-serif",
          lineHeight: 1.35,
        }}
      >
        {/* ── WHO IT IS FROM ── */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "7mm", fontWeight: 900, letterSpacing: "0.4mm" }}>
            {BUSINESS_NAME.toUpperCase()}
          </div>
          {phone ? <div style={{ fontSize: "3mm" }}>{phone}</div> : null}
          {email ? <div style={{ fontSize: "3mm" }}>{email}</div> : null}
          {!phone && !email ? (
            <div style={{ fontSize: "2.8mm" }}>
              Set a phone and email in Settings so this receipt can carry them
            </div>
          ) : null}
        </div>

        <div style={RULE} />

        <Row k="Order" v={<b>{code}</b>} />
        <Row k="Placed" v={fmtDateTime(order?.created_at)} />
        {/* THE SHOP'S NAME, AND NOT ITS NUMBER. The customer knows who they
            bought from; they reach them through Takal. */}
        <Row k="From" v={order?.restaurant_name || "—"} />

        <div style={RULE} />

        {/* ── WHAT IS IN THE PARCEL ── */}
        <div style={{ fontSize: "2.9mm", fontWeight: 900, letterSpacing: "0.3mm" }}>
          YOUR ORDER
        </div>
        <div style={{ marginTop: "1.5mm" }}>
          {items.length === 0 ? (
            <div style={{ fontSize: "3.1mm" }}>No items recorded.</div>
          ) : (
            items.map((it, i) => (
              <div
                key={it.id ?? i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "2mm",
                  padding: "1.2mm 0",
                  fontSize: "3.1mm",
                }}
              >
                {/* The name wraps. A cut-off item name on a receipt is how an
                    argument about what was in the parcel starts. */}
                <span style={{ flex: 1, wordBreak: "break-word" }}>
                  <b>{it.quantity ?? 1}×</b> {it.item_name || "Item"}
                </span>
                <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {money(it.price ?? it.total ?? 0)}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={RULE} />

        <Row k="Items" v={money(goods)} />
        <Row k="Delivery" v={money(fee)} />
        {credit > 0 ? <Row k="Wallet credit" v={`− ${money(credit)}`} /> : null}

        {/* THE ONE BLACK BAND. The only line that has to be unmissable, and
            the only place a thermal printer's solid black is worth the heat. */}
        <div
          style={{
            marginTop: "2mm",
            background: "#000",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            padding: "2mm 2.5mm",
            fontSize: "4.6mm",
            fontWeight: 900,
          }}
        >
          <span>TOTAL</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(total)}</span>
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: "3.2mm",
            fontWeight: 700,
            marginTop: "1.5mm",
          }}
        >
          {paidOnline ? "PAID ONLINE" : "PAID IN CASH ON DELIVERY"}
        </div>

        <div style={RULE} />

        {/* ── WHO IT WENT TO ── */}
        <div style={{ fontSize: "2.9mm", fontWeight: 900, letterSpacing: "0.3mm" }}>
          DELIVERED TO
        </div>
        <div style={{ fontSize: "3.1mm", marginTop: "1mm" }}>
          <b>{order?.customer_name || "—"}</b>
        </div>
        <div style={{ fontSize: "3mm", whiteSpace: "pre-wrap" }}>
          {[order?.delivery_address, order?.address_details].filter(Boolean).join("\n")}
        </div>

        {returnLine ? (
          <>
            <div style={RULE} />
            <div style={{ fontSize: "3mm" }}>{returnLine}</div>
            <div style={{ fontSize: "3mm" }}>
              Ask in the Takal app, or contact us using the details above.
            </div>
          </>
        ) : null}

        {/* ── THE QR ── */}
        {qrSvg ? (
          <div style={{ textAlign: "center", marginTop: "3mm" }}>
            <div
              style={{ display: "inline-block" }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div style={{ fontSize: "2.7mm", marginTop: "1mm" }}>
              {target?.caption}
            </div>
          </div>
        ) : null}

        <div style={RULE} />
        <div style={{ textAlign: "center", fontSize: "3.2mm", fontWeight: 700 }}>
          Thank you for ordering from {BUSINESS_NAME}
        </div>
        {/* The order number again, in plain text, so it can still be read if
            the QR smudges or the customer has no camera to hand. */}
        <div
          style={{
            textAlign: "center",
            fontSize: "2.8mm",
            marginTop: "1mm",
            letterSpacing: "0.3mm",
          }}
        >
          Quote {code} if you contact us
        </div>
        <div style={{ height: "6mm" }} />
      </div>
  );
}


/**
 * THE WINDOW-DRESSING ROUND ONE OR MANY RECEIPTS.
 *
 * Everything that is the same whether you print one receipt or fifteen: the
 * hidden print area, the stylesheet that hides the rest of the panel, and
 * opening the print dialog once the paper has been drawn.
 */
function ReceiptPrinter({
  open,
  onDone,
  children,
}: {
  open: boolean;
  onDone: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    // One tick, so the browser has drawn the paper before the dialog opens.
    // With a batch this matters more: fifteen receipts and fifteen QR codes
    // are not on the page the instant the button is pressed.
    const t = setTimeout(() => {
      window.print();
      onDone();
    }, 120);
    return () => clearTimeout(t);
  }, [open, onDone]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div id="takal-receipt-root">{children}</div>
    </>,
    document.body
  );
}


/** One order's receipt, printed from the order panel. */
export function CustomerReceipt({
  open,
  order,
  items,
  settings,
  onDone,
}: {
  open: boolean;
  order: any;
  items: any[];
  settings?: ReceiptSettings;
  onDone: () => void;
}) {
  return (
    <ReceiptPrinter open={open} onDone={onDone}>
      <ReceiptBody order={order} items={items} settings={settings} />
    </ReceiptPrinter>
  );
}


/**
 * SEVERAL RECEIPTS AT ONCE, from the Parcels desk.
 *
 * WHY IT LIVES ON THAT DESK. Receipts are printed at PACKING time, and packing
 * happens at the parcel desk - not by opening fifteen orders one at a time and
 * pressing print on each. The office ticks the parcels it is packing and
 * prints the lot.
 *
 * Each receipt is cut from the next by the print stylesheet above, so what
 * comes off the roll is a stack of receipts rather than one long strip.
 */
export function ReceiptBatch({
  open,
  orders,
  settings,
  onDone,
}: {
  open: boolean;
  /** One entry per parcel: the order, and the lines that were in it. */
  orders: { order: any; items: any[] }[];
  settings?: ReceiptSettings;
  onDone: () => void;
}) {
  return (
    <ReceiptPrinter open={open && orders.length > 0} onDone={onDone}>
      {orders.map((o, i) => (
        <ReceiptBody
          key={o.order?.id ?? i}
          order={o.order}
          items={o.items}
          settings={settings}
        />
      ))}
    </ReceiptPrinter>
  );
}
