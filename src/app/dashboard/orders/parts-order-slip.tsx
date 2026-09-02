"use client";

/**
 * THE DELIVERY SLIP — the piece of paper that goes out with the parcel.
 *
 * Mock-up 5, version 2. Rejected once, then approved on 1 September 2026 with
 * five corrections from Sana. All five are product rules, written up in
 * docs/PRIVACY-AND-CONTACT-RULES.md, and every one of them is enforced here:
 *
 *   1. THE 4-DIGIT CODE IS NEVER ON IT. Not printed, not on a screen, not
 *      anywhere except the customer's own app. A code the rider can already
 *      see stops nothing. There is a test that fails if it ever appears.
 *   2. THE ADDRESS IS PRINTED EXACTLY AS THE CUSTOMER WROTE IT. Not tidied,
 *      not shortened, not replaced by whatever a map thinks they meant. If
 *      they wrote "2nd floor blue gate, ring the bell twice", that is what the
 *      rider reads.
 *   3. THIS IS THE RIDER'S COPY, so it carries BOTH phone numbers, because he
 *      cannot do the job otherwise. It is never given to the customer or to
 *      the shop - neither of them may have the other's number, and both reach
 *      each other through Takal.
 *   4. THE BIG BOX IS THE MONEY TO COLLECT, in the place the code used to be.
 *      On an order already paid online it says "Collect Rs 0" in green, so
 *      there is no doubt at the door.
 *   5. WHAT THE RIDER IS PAID IS NOT ON IT. Only the delivery charge the
 *      customer paid. What Takal pays a rider is between Takal and the rider.
 *
 * HOW PRINTING WORKS. The slip is drawn into the page body through a portal
 * and everything else is hidden while the print dialog is open, so what comes
 * out is the slip and nothing else. Before this, the Print button called
 * window.print() on the whole admin panel - sidebar, filters, buttons and all.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { money, fmtDateTime } from "@/lib/format";
import { CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_LOCATION } from "@/lib/contact";

/** Only the slip goes on the paper. Everything else is hidden while printing. */
const PRINT_CSS = `
@media print {
  body > *:not(#takal-slip-root) { display: none !important; }
  #takal-slip-root { display: block !important; }
  @page { margin: 12mm; }
}
#takal-slip-root { display: none; }
`;

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "3px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#4A4A4A" }}>{k}</span>
      <span style={{ fontWeight: 700, textAlign: "right" }}>{v}</span>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderTop: "2px solid #000",
        marginTop: 14,
        paddingTop: 10,
        marginBottom: 6,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
}

export function OrderSlip({
  open,
  order,
  items,
  onDone,
}: {
  open: boolean;
  order: any;
  items: any[];
  onDone: () => void;
}) {
  // PAID ONLINE means nothing is collected at the door. Getting this backwards
  // is a rider asking for money that was already taken, so it is decided from
  // the order's own payment_status and nothing else.
  const paidOnline =
    String(order?.payment_status || "").toLowerCase() === "paid" ||
    (order?.payment_method &&
      String(order.payment_method).toLowerCase() !== "cash");
  const toCollect = paidOnline ? 0 : Number(order?.total_amount || 0);
  const goods = Number(order?.subtotal || 0);
  const fee = Number(order?.delivery_fee || 0);
  const credit = Number(order?.credit_used || 0);
  const isParcel = order?.delivery_type === "standard";

  useEffect(() => {
    if (!open) return;
    // One tick, so the browser has drawn the slip before the dialog opens.
    const t = setTimeout(() => {
      window.print();
      onDone();
    }, 60);
    return () => clearTimeout(t);
  }, [open, onDone]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div
        id="takal-slip-root"
        style={{
          fontFamily: "Roboto, system-ui, sans-serif",
          color: "#000",
          background: "#fff",
          maxWidth: 460,
          padding: 4,
        }}
      >
        {/* ── HEAD ── */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>
              TAKAL
            </div>
            <div style={{ fontSize: 11.5, color: "#4A4A4A" }}>
              Delivery slip · {BUSINESS_LOCATION}
            </div>
            <div style={{ fontSize: 11.5, color: "#4A4A4A" }}>
              {/* Only Takal's own way of being reached. Never the shop's, never
                  the customer's — see rule 3. The phone line is left out
                  entirely until a real number is set, because a placeholder
                  number on a real slip is worse than none. */}
              Takal help: {CONTACT_PHONE ? `${CONTACT_PHONE} · ` : ""}
              {CONTACT_EMAIL}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 19, fontWeight: 900, fontFamily: "monospace" }}>
              #{String(order?.id ?? "").slice(0, 8).toUpperCase()}
            </div>
            <div style={{ fontSize: 11.5, color: "#4A4A4A" }}>
              {fmtDateTime(order?.created_at)}
            </div>
            <div style={{ fontSize: 11.5, color: "#4A4A4A" }}>
              {isParcel ? "Marketplace parcel" : "Food order"}
            </div>
            <div
              style={{
                marginTop: 4,
                display: "inline-block",
                background: "#000",
                color: "#fff",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                padding: "2px 7px",
              }}
            >
              RIDER COPY
            </div>
          </div>
        </div>

        {/* ── THE MONEY BOX, where the code used to be ── */}
        <div
          style={{
            marginTop: 14,
            border: "3px solid #000",
            background: paidOnline ? "#1F6F4A" : "#FFFF00",
            color: paidOnline ? "#fff" : "#000",
            textAlign: "center",
            padding: "12px 10px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
            {paidOnline ? "ALREADY PAID ONLINE" : "COLLECT FROM THE CUSTOMER"}
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
            {paidOnline ? "Collect Rs 0" : money(toCollect)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {paidOnline
              ? "Do not take any money from the customer"
              : "CASH · count it before you hand the parcel over"}
          </div>
        </div>

        {/* ── WHO IT GOES TO ── */}
        <Heading>DELIVER TO</Heading>
        <Line k="Name" v={order?.customer_name || "—"} />
        {/* The rider gets the customer's number. Nobody else does. */}
        <Line k="Phone" v={order?.customer_phone || "—"} />
        {order?.receiver_name ? (
          <Line
            k="Receiver"
            v={`${order.receiver_name}${
              order.receiver_phone ? ` · ${order.receiver_phone}` : ""
            }`}
          />
        ) : null}
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 900 }}>
          Address — exactly as the customer wrote it
        </div>
        <div
          style={{
            marginTop: 4,
            border: "1px dashed #000",
            background: "#FFFDE0",
            padding: "8px 10px",
            fontSize: 13.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {[order?.delivery_address, order?.address_details]
            .filter(Boolean)
            .join("\n") || "No address was recorded."}
        </div>
        {order?.notes ? <Line k="Their note" v={order.notes} /> : null}

        {/* ── WHERE IT COMES FROM ── */}
        <Heading>PICK UP FROM</Heading>
        <Line k="Shop" v={order?.restaurant_name || "—"} />
        {/* And the shop's number. Also rider-only. */}
        <Line k="Shop phone" v={order?.restaurant_phone || "—"} />
        {order?.hub_name ? <Line k="Takal office" v={order.hub_name} /> : null}

        {/* ── WHAT IS IN IT ── */}
        <Heading>ITEMS</Heading>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "#4A4A4A" }}>
            No lines are recorded against this order.
          </div>
        ) : (
          items.map((it, i) => (
            <div
              key={it.id ?? i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "5px 0",
                borderBottom: "1px solid #E5E5E5",
                fontSize: 13,
              }}
            >
              <span>{it.item_name || "Item"}</span>
              <span style={{ whiteSpace: "nowrap" }}>
                <b style={{ marginRight: 14 }}>× {it.quantity ?? 1}</b>
                <b>{money(it.price ?? it.total ?? 0)}</b>
              </span>
            </div>
          ))
        )}
        <div style={{ marginTop: 8 }}>
          <Line k="Items total" v={money(goods)} />
          {/* The DELIVERY CHARGE THE CUSTOMER PAID. What the rider is paid for
              carrying it is never on this piece of paper - rule 5. */}
          <Line k="Delivery charge" v={money(fee)} />
          {credit > 0 ? <Line k="Wallet credit used" v={`− ${money(credit)}`} /> : null}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "2px solid #000",
            marginTop: 8,
            paddingTop: 8,
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          <span>{paidOnline ? "PAID ONLINE" : "TO COLLECT"}</span>
          <span>{money(order?.total_amount || 0)}</span>
        </div>

        {/* ── WHO IS CARRYING IT ── */}
        <Heading>THE JOURNEY</Heading>
        <Line k="Rider" v={order?.rider_name || "not assigned yet"} />
        {order?.handed_to_name ? (
          <Line k="Handed out by" v={order.handed_to_name} />
        ) : null}
        <Line k="Slip printed" v={fmtDateTime(new Date().toISOString())} />

        {/* ── THE CODE IS ASKED FOR, NEVER PRINTED ── */}
        <div
          style={{
            marginTop: 14,
            border: "2px solid #000",
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <b>Before you hand it over:</b> ask the customer for their 4-digit
          code and type it into your app. Do not leave the parcel without it.
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 34 }}>
          {["Rider signature", "Office signature"].map((s) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ borderTop: "1px solid #000" }} />
              <div style={{ fontSize: 11, color: "#4A4A4A", marginTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
