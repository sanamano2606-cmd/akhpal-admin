"use client";
/* eslint-disable @next/next/no-img-element -- the panel shows pictures with a plain <img>: images are unoptimized (next.config.js) and come from Takal's own picture store or the panel itself */

// THE PHONE PREVIEW (Mock 244): Home as a customer would see it, drawn from
// the DRAFT and the real shops and products of Mingora or Matta today. It is
// a close drawing for deciding, not the app itself - "Preview on my phone"
// shows the real thing on a real phone.

import { useEffect, useRef, type CSSProperties } from "react";
import { money } from "@/lib/format";
import {
  BLOCK_KEYS, CARD_LINES, CARD_NAMES, CARD_PHOTOS, blockName, lookOn, readyNow, tabName,
  liveFit, liveShown, tabLiveShown,
  type Card, type CardStyle, type Layout, type LivePictures, type Look, type Tabs,
} from "@/lib/app-home";

const sp = (w: number) => (v: number) => Math.min(Math.max((v * w) / 375, v * 0.7), v * 1.3);

export type PreviewData = {
  types: string[];
  rows: Record<string, any[]>;
  shops: any[];
  banner: any | null;
  collections: Record<string, { products?: any[]; shops?: any[] }>;
};

function round(code: string) {
  return `/app-home/round/${code}_1.jpg`;
}

function Picture({ urls, fallback, fit, style }: { urls: string[]; fallback: string; fit: string; style?: CSSProperties }) {
  const src = urls[0] || fallback;
  return <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: fit as any, display: "block", ...style }} />;
}

function TabsRow({ w, tabs, types, chosen, live }: { w: number; tabs: Tabs; types: string[]; chosen: string; live?: LivePictures }) {
  const s = sp(w);
  const side = w * 0.025;
  const tileW = Math.min(Math.max((w - side - s(8) * 4) / 4.6, 60), 110);
  const share = Math.min(tabs.size, 0.9);
  const c = tileW * share;
  const pad = Math.max(0, (s(11) * 2 + tileW * 0.63 + s(7) - tileW * share - s(4)) / 2);
  const listed = new Map(tabs.items.map((t) => [t.code, t]));
  const order = [
    ...tabs.items.filter((t) => t.on && types.includes(t.code)).map((t) => t.code),
    ...types.filter((t) => !listed.has(t)),
  ];
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", padding: `${s(14)}px 0 ${s(6)}px ${side}px` }}>
      <div style={{ display: "flex", gap: s(10) }}>
        {order.map((code) => {
          const t = listed.get(code);
          const on = code === chosen;
          const tiled = tabs.style === "tile" || tabs.style === "chip";
          const name = t?.name_en || tabName(code);
          // Mock 246: a tab follows its row - Takal's live pictures, unless the
          // tab has its own (chosen live products or uploads).
          const pic = t?.pic;
          const liveUrls = (!pic || pic.source === "auto")
            ? tabLiveShown(tabs, pic || ({ source: "auto" } as any), live?.tabs[code], live?.min).map((x) => x.url) : [];
          const own = liveUrls.length ? liveUrls
            : (pic && (pic.source === "live" || pic.source === "own") ? pic.items.map((x) => x.url || "").filter(Boolean) : []);
          const ownFit = liveUrls.length ? liveFit(live?.tab_card[code]) : (t?.pic.fit || "cover");
          const shape = tabs.style === "square" ? c * 0.28 : c / 2;
          const ring = on && !tiled && tabs.ring_width > 0 ? `0 0 0 ${tabs.ring_width}px ${tabs.ring}` :
            (!on && !tiled ? `0 0 0 1.5px ${tabs.line_color}` : "none");
          return (
            <div key={code} data-preview-tab={code} style={{
              flex: "0 0 auto", width: tileW, padding: `${pad}px 0`, display: "flex", flexDirection: "column", alignItems: "center",
              borderRadius: tabs.style === "chip" ? tileW / 2 : 22,
              background: tiled ? (on ? tabs.chosen_fill : (tabs.tile || "transparent")) : "transparent",
            }}>
              <div style={{ width: c, height: c, borderRadius: shape, overflow: "hidden", boxShadow: ring, background: "#eee" }}>
                <Picture urls={own} fallback={round(code)} fit={ownFit} />
              </div>
              <div style={{
                marginTop: s(4), fontFamily: "Poppins, sans-serif", fontSize: 11.5, fontWeight: on && !tiled ? 700 : 600,
                padding: on && !tiled ? "0 9px" : "0 4px", borderRadius: 20,
                background: on && !tiled ? tabs.chosen_fill : "transparent",
                color: on ? tabs.chosen_words : "#000", maxWidth: tileW, overflow: "hidden", textOverflow: "ellipsis",
              }}>{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardView({ w, style, card, live }: { w: number; style: CardStyle; card: Card; live?: LivePictures }) {
  const s = sp(w);
  const name = card.name_en || CARD_NAMES[card.key];
  const line = card.line_en || CARD_LINES[card.key];
  // Mock 246: "auto" = what Takal picks now (or the fixed picture when too few).
  const auto = card.pic.source === "auto" ? liveShown(card.pic, live?.cards[card.key], live?.min).map((x) => x.url) : [];
  const urls = card.pic.source === "auto" ? auto
    : card.pic.source === "takal" ? [] : card.pic.items.map((x) => x.url || "").filter(Boolean);
  const fit = auto.length ? liveFit(card.key) : card.pic.fit;
  const nameSize = card.text_size === "big" ? 18 : 15;
  const lineSize = card.text_size === "big" ? 12 : 11.5;
  const words = (nameColor: string, lineColor: string) => (
    <div>
      <div data-preview-card-name={card.key} style={{ fontFamily: "Poppins, sans-serif", fontWeight: card.bold ? 700 : 500, fontSize: nameSize, color: nameColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" }}>{name}</div>
      <div style={{ fontFamily: "Poppins, sans-serif", fontSize: lineSize, color: lineColor, lineHeight: 1.3, marginTop: 2 }}>{line}</div>
    </div>
  );
  const button = card.button_en ? (
    <span style={{ display: "inline-block", background: "#FFFF00", border: "1.5px solid #000", borderRadius: 20, padding: `${s(4)}px ${s(10)}px`, fontSize: 11.5, fontWeight: 700, fontFamily: "Poppins, sans-serif" }}>{card.button_en} ›</span>
  ) : null;
  const radius = card.pic.shape === "circle" ? "50%" : card.pic.shape === "round" ? s(14) : s(4);
  const frame = (side: number) => (
    <div style={{ width: side, height: side, flex: "0 0 auto", borderRadius: radius, overflow: "hidden",
      border: card.pic.line && card.pic.line_width ? `${card.pic.line_width}px solid ${card.pic.line_color}` : "none",
      boxShadow: card.pic.shadow ? "0 5px 12px rgba(0,0,0,.25)" : "none", position: "relative" }}>
      <Picture urls={urls} fallback={CARD_PHOTOS[card.key]} fit={fit} />
      {card.pic.fade && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent, rgba(0,0,0,.45))" }} />}
    </div>
  );
  if (style === "bigpic") {
    return (
      <div style={{ position: "relative", minHeight: s(150), borderRadius: 20, overflow: "hidden", background: "#000" }}>
        <div style={{ position: "absolute", inset: 0, background: "#fff" }}><Picture urls={urls} fallback={CARD_PHOTOS[card.key]} fit={auto.length ? fit : "cover"} /></div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 35%, rgba(0,0,0,.78))" }} />
        <div style={{ position: "absolute", left: s(12), right: s(10), bottom: s(10) }}>{words("#fff", "#eee")}{button && <div style={{ marginTop: 6 }}>{button}</div>}</div>
      </div>
    );
  }
  if (style === "pictop") {
    return (
      <div style={{ border: "1px solid #E8E8E3", borderRadius: 20, padding: s(5), background: "#fff" }}>
        <div style={{ height: s(86), borderRadius: 15, overflow: "hidden" }}><Picture urls={urls} fallback={CARD_PHOTOS[card.key]} fit={fit} /></div>
        <div style={{ padding: `${s(6)}px ${s(6)}px ${s(4)}px` }}>{words(card.name_color, card.line_color)}{button && <div style={{ marginTop: 6 }}>{button}</div>}</div>
      </div>
    );
  }
  if (style === "blend") {
    const inner = w / 2 - w * 0.025 - s(5) - s(24);
    const side = Math.max(s(52), inner * card.pic.size / 0.85);
    return (
      <div style={{ borderRadius: 20, padding: s(12), background: `linear-gradient(135deg, ${card.bg1} 0%, ${card.bg1} 35%, ${card.bg2} 100%)`, height: "100%" }}>
        {card.pic.place === "left" ? (
          <div style={{ display: "flex", gap: s(10) }}>{frame(side)}<div style={{ minWidth: 0 }}>{words(card.name_color, card.line_color)}{button && <div style={{ marginTop: 8 }}>{button}</div>}</div></div>
        ) : card.pic.place === "tr" ? (
          <div><div style={{ display: "flex", justifyContent: "flex-end" }}>{frame(side)}</div><div style={{ marginTop: 8 }}>{words(card.name_color, card.line_color)}</div>{button && <div style={{ marginTop: 8 }}>{button}</div>}</div>
        ) : (
          <div>{words(card.name_color, card.line_color)}
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 8, gap: 6 }}><div style={{ flex: 1 }}>{button}</div>{frame(side)}</div>
          </div>
        )}
      </div>
    );
  }
  const r = s(78) * Math.min(1.35, Math.max(0.75, card.pic.size / 0.43));
  return (
    <div style={{ position: "relative", minHeight: s(118), borderRadius: 20, overflow: "hidden", background: card.bg1, padding: `${s(13)}px ${s(10)}px ${s(13)}px ${s(14)}px`, height: "100%" }}>
      <div style={{ position: "absolute", right: -s(12), bottom: -s(12), width: r, height: r, borderRadius: radius, overflow: "hidden",
        border: card.pic.line ? `${card.pic.line_width}px solid rgba(255,255,255,.75)` : "none" }}>
        <Picture urls={urls} fallback={CARD_PHOTOS[card.key]} fit={fit} />
      </div>
      <div style={{ position: "relative", width: "100%" }}>
        <div data-preview-card-name={card.key} style={{ fontFamily: "Poppins, sans-serif", fontWeight: card.bold ? 700 : 500, fontSize: nameSize, color: card.name_color, whiteSpace: "nowrap", overflow: "hidden" }}>{name}</div>
        <div style={{ width: "62%", fontFamily: "Poppins, sans-serif", fontSize: lineSize, color: card.line_color, lineHeight: 1.3, marginTop: 2 }}>{line}</div>
        {button && <div style={{ marginTop: 8 }}>{button}</div>}
      </div>
    </div>
  );
}

function Cards({ w, look, live }: { w: number; look: Look; live?: LivePictures }) {
  const s = sp(w);
  const on = look.cards.items.filter((c) => c.on);
  const rows: Card[][] = [];
  for (let i = 0; i < on.length; i += 2) rows.push(on.slice(i, i + 2));
  return (
    <div data-preview-cards style={{ padding: `0 ${w * 0.025}px`, display: "grid", gap: s(10) }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: r.length === 2 ? "1fr 1fr" : "1fr", gap: s(10), alignItems: "stretch" }}>
          {r.map((c) => <CardView key={c.key} w={w} style={look.cards.style} card={c} live={live} />)}
        </div>
      ))}
    </div>
  );
}

function Head({ w, title }: { w: number; title: string }) {
  const s = sp(w);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `${s(16)}px ${w * 0.025}px ${s(10)}px` }}>
      <b style={{ fontSize: 18, fontFamily: "Poppins, sans-serif" }}>{title}</b>
      <span style={{ fontSize: 12, color: "#6E6E68", fontWeight: 600 }}>See all ›</span>
    </div>
  );
}

function Products({ w, items }: { w: number; items: any[] }) {
  const s = sp(w);
  const cw = Math.min(s(150), (w - w * 0.05) / 2.4);
  return (
    <div style={{ display: "flex", gap: s(10), overflow: "hidden", padding: `0 0 0 ${w * 0.025}px` }}>
      {items.slice(0, 6).map((p, i) => (
        <div key={p.id || i} style={{ flex: "0 0 auto", width: cw, border: "1px solid #E8E8E3", borderRadius: 20, padding: 5 }}>
          <div style={{ height: cw - 10, borderRadius: 15, overflow: "hidden", background: "#F2F2EF" }}>
            {p.image_url && <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ padding: "5px 5px 2px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
          <div style={{ padding: "0 5px 4px", fontSize: 13, fontWeight: 700 }}>{money(Number(p.final_price ?? p.price ?? 0))}</div>
        </div>
      ))}
    </div>
  );
}

function Shops({ w, items }: { w: number; items: any[] }) {
  const s = sp(w);
  return (
    <div style={{ display: "flex", gap: s(10), overflow: "hidden", padding: `0 0 0 ${w * 0.025}px` }}>
      {items.slice(0, 5).map((r, i) => (
        <div key={r.id || i} style={{ flex: "0 0 auto", width: s(200), border: "1px solid #E8E8E3", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ height: s(90), background: "#F2F2EF" }}>
            {(r.cover_url || r.image_url) && <img src={r.cover_url || r.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ padding: 8, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
        </div>
      ))}
    </div>
  );
}

function Note({ w, text }: { w: number; text: string }) {
  return <div style={{ margin: `8px ${w * 0.025}px 0`, padding: 10, borderRadius: 14, background: "#F6F6F3", color: "#6E6E68", fontSize: 12 }}>{text}</div>;
}

export function PhonePreview({ layout, data, w, town, day, minute, focus, live }: {
  layout: Layout; data: PreviewData; w: number; town: "mingora" | "matta"; day: string; minute: number;
  /** Mock 246: what Takal picks now in this town. */
  live?: LivePictures;
  /** The part being edited: the phone scrolls itself to it ("top" = the tabs). */
  focus?: string;
}) {
  const s = sp(w);
  const phone = useRef<HTMLDivElement>(null);
  // Editing the 4 cards with the phone still showing the tabs meant scrolling
  // the phone by hand every time. It now follows what is being edited.
  useEffect(() => {
    const box = phone.current;
    if (!box || !focus) return;
    if (focus === "top") { box.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const el = box.querySelector<HTMLElement>(`[data-preview-block="${CSS.escape(focus)}"]`);
    if (el) box.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
  }, [focus, w]);
  const clock = `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, "0")}`;
  const look = lookOn(layout, day);
  const types = data.types.length ? data.types : ["restaurant", "grocery", "pharmacy", "beauty_cosmetics", "clothing_store"];
  const listedOn = look.tabs.items.filter((t) => t.on).map((t) => t.code);
  const visible = [...listedOn.filter((c) => types.includes(c)),
    ...types.filter((t) => !look.tabs.items.some((x) => x.code === t))];
  const chosen = visible.includes(look.tabs.first) ? look.tabs.first : (visible.includes("restaurant") ? "restaurant" : visible[0]);
  const keys = new Set(layout.blocks.map((b) => b.key));
  const blocks = [...layout.blocks, ...BLOCK_KEYS.filter((k) => !keys.has(k)).map((k) => ({ key: k, on: true, where: "all" as const, when: {} }))]
    .filter((b) => b.on && (b.where === "all" || b.where === town) && readyNow(b.when, day, minute));
  const rain = layout.rain.on && layout.rain.text_en && (layout.rain.where === "all" || layout.rain.where === town) ? layout.rain : null;
  const chosenName = look.tabs.items.find((t) => t.code === chosen)?.name_en || tabName(chosen);

  return (
    <div ref={phone} data-phone-preview={w} style={{ width: w, height: 820, overflowY: "auto", background: "#fff", borderRadius: 24, border: "1px solid #d6d6d0", boxShadow: "0 6px 22px rgba(0,0,0,.14)", fontFamily: "Poppins, sans-serif", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: `${s(8)}px ${w * 0.025 + 6}px 2px`, fontSize: 11, fontWeight: 600, color: "#333" }}><span data-preview-clock>{clock}</span><span>4G</span></div>
      <div style={{ padding: `${s(6)}px ${w * 0.025}px`, fontSize: 15, fontWeight: 600 }}>📍 {town === "matta" ? "Matta" : "Mingora"} ▾</div>
      <div style={{ fontSize: w < 340 ? 22 : 26, fontWeight: 800, lineHeight: 1.15, padding: `${s(6)}px ${w * 0.025}px ${s(10)}px` }}>
        What would you like <span style={{ background: "linear-gradient(transparent 62%,#FFFF00 62%)" }}>today?</span>
      </div>
      <div style={{ margin: `0 ${w * 0.025}px`, height: s(46), borderRadius: s(23), background: "#F2F2EF", display: "flex", alignItems: "center", padding: `0 ${s(16)}px`, fontSize: 13, color: "#6E6E68" }}>🔍 Search food, groceries, shops…</div>
      {rain && (
        <div data-preview-rain style={{ margin: `${s(8)}px ${w * 0.025}px 0`, padding: `${s(8)}px ${s(12)}px`, borderRadius: 14, background: "#E3F2FD", color: "#1160C4", fontSize: 12, fontWeight: 600 }}>{rain.text_en}</div>
      )}
      <TabsRow w={w} tabs={look.tabs} types={visible} chosen={chosen} live={live} />
      {blocks.map((b) => {
        switch (b.key) {
          case "offers": {
            const ban = data.banner;
            return (
              <div key={b.key} data-preview-block="offers" style={{ margin: `${s(14)}px ${w * 0.025}px 0`, borderRadius: 22, background: "#FFFDE8", padding: s(12), display: "flex", gap: s(10), boxShadow: "0 3px 12px rgba(0,0,0,.07)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: 600, color: "#6E6E68" }}>{ban ? "OFFER" : "TAKAL · SWAT"}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{ban?.title || "Free delivery on your first order"}</div>
                  <div style={{ fontSize: 12, color: "#6E6E68" }}>{ban?.subtitle || "Food, groceries and medicine"}</div>
                </div>
                {ban?.image_url && <img src={ban.image_url} alt="" style={{ width: s(110), height: s(86), objectFit: "cover", borderRadius: 14 }} />}
              </div>
            );
          }
          case "departments":
            return <div key={b.key} data-preview-block="departments"><Head w={w} title="Shop by department" /><Cards w={w} look={look} live={live} /></div>;
          case "popular":
            return (data.rows[chosen] || []).length ? <div key={b.key} data-preview-block="popular"><Head w={w} title={`Popular in ${chosenName}`} /><Products w={w} items={data.rows[chosen]} /></div> : null;
          case "order_again":
            return <div key={b.key} data-preview-block="order_again"><Head w={w} title="Order again" /><Note w={w} text="Shows only for customers who ordered before." /></div>;
          case "deals":
            return chosen === "restaurant" ? <div key={b.key} data-preview-block="deals"><Head w={w} title="Deals & combos" /><Note w={w} text="The Food page's Deals & Combos products." /></div> : null;
          case "recently_viewed":
            return <div key={b.key} data-preview-block="recently_viewed"><Head w={w} title="Recently viewed" /><Note w={w} text="Shows only when the customer looked at products." /></div>;
          case "shops_near": {
            const near = data.shops.filter((r) => (r.vendor_type || "restaurant") === chosen);
            return near.length ? <div key={b.key} data-preview-block="shops_near"><Head w={w} title={`${chosenName} shops near you`} /><Shops w={w} items={near} /></div> : null;
          }
          default: {
            const id = b.key.startsWith("collection:") ? b.key.slice(11) : "";
            const got = data.collections[id];
            const items = got?.products || [];
            const shops = got?.shops || [];
            if (!items.length && !shops.length) return null;
            return (
              <div key={b.key} data-preview-block={b.key}>
                <Head w={w} title={blockName(b.key, layout).replace("📚 ", "")} />
                {items.length ? <Products w={w} items={items} /> : <Shops w={w} items={shops} />}
              </div>
            );
          }
        }
      })}
      <div style={{ height: 30 }} />
      <Note w={w} text="… the product feed keeps loading here." />
      <div style={{ height: 30 }} />
    </div>
  );
}
