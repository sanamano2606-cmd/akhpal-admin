"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE LIVE CARD PREVIEW - drawn the way the app draws a Home Shops card
// (Mock 151, style D): the shop's logo filling the card, the short line on a
// ribbon, the name strip attached underneath. Every choice in "Look of the
// cards" changes it at once, before anything is saved.
//
// Sizes are the app's, at a 250-wide card: the logo part 100 tall (125 when
// "Tall"), the strip 36, corners 20 (round) or 8 (soft).
// ─────────────────────────────────────────────────────────────────────────────

export type CardLook = {
  ribbon_style: "corner" | "band" | "tag";
  ribbon_color: string;
  strip_color: "black" | "yellow" | "white" | "logo";
  strip_shows: "rating" | "time" | "name";
  card_height: "normal" | "tall";
  corners: "round" | "soft";
};

export type PreviewShop = {
  name: string;
  picture: string;
  tagline: string;
  rating?: number | null;
  ratingCount?: number | null;
  logoColor?: string | null;
};

export const TAKAL_YELLOW = "#FFFF00";
const STRIP_BLACK = "#141414";

/** Black writing on a light colour, white on a dark one - the app's rule. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#000000";
  const v = parseInt(m[1], 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return lum > 0.45 ? "#000000" : "#FFFFFF";
}

function stripColours(look: CardLook, shop: PreviewShop): [string, string, string] {
  switch (look.strip_color) {
    case "yellow":
      return [TAKAL_YELLOW, "#000000", "#000000"];
    case "white":
      return ["#FFFFFF", "#000000", "#000000"];
    case "logo": {
      const c = /^#[0-9a-f]{6}$/i.test(shop.logoColor || "") ? String(shop.logoColor) : STRIP_BLACK;
      const w = inkOn(c);
      return [c, w, w];
    }
    default:
      return [STRIP_BLACK, "#FFFFFF", TAKAL_YELLOW];
  }
}

export function ShopCardPreview({ look, shop, width = 250 }: { look: CardLook; shop: PreviewShop; width?: number }) {
  const k = width / 250;
  const picH = width * (look.card_height === "tall" ? 0.5 : 0.4);
  const radius = (look.corners === "soft" ? 8 : 20) * k;
  const [stripBg, nameInk, factInk] = stripColours(look, shop);
  const ribbonBg = /^#[0-9a-f]{6}$/i.test(look.ribbon_color) ? look.ribbon_color : TAKAL_YELLOW;
  const ribbonInk = inkOn(ribbonBg);
  const fact =
    look.strip_shows === "rating"
      ? shop.rating && shop.ratingCount ? `★ ${Number(shop.rating).toFixed(1)}` : ""
      : look.strip_shows === "time"
        ? "20–30 min"
        : "";
  const ribbonText = { color: ribbonInk, fontWeight: 800, fontSize: 11.5 * k, whiteSpace: "nowrap" as const };

  return (
    <div
      data-testid="shop-card-preview"
      className="shrink-0 overflow-hidden bg-white"
      style={{
        width,
        borderRadius: radius,
        boxShadow: "0 6px 16px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.08)",
        outline: look.strip_color === "white" ? "1px solid #E9EBEE" : undefined,
      }}
    >
      <div className="relative overflow-hidden bg-slate-100" style={{ height: picH }}>
        {shop.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.picture} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">shop logo</div>
        )}
        {shop.tagline ? (
          look.ribbon_style === "band" ? (
            <div className="absolute inset-x-0 bottom-0 text-center overflow-hidden text-ellipsis"
              style={{ background: ribbonBg, padding: `${3 * k}px ${12 * k}px`, ...ribbonText }}>
              {shop.tagline}
            </div>
          ) : look.ribbon_style === "tag" ? (
            <div className="absolute overflow-hidden text-ellipsis"
              style={{ top: 8 * k, left: 8 * k, maxWidth: width - 16 * k, background: ribbonBg, borderRadius: 999,
                padding: `${3 * k}px ${8 * k}px`, boxShadow: "0 2px 6px rgba(0,0,0,.25)", ...ribbonText }}>
              {shop.tagline}
            </div>
          ) : (
            <div className="absolute text-center overflow-hidden"
              style={{ top: width * 0.075, right: -width * 0.17, width: width * 0.72, transform: "rotate(30deg)",
                background: ribbonBg, padding: `${3 * k}px ${width * 0.72 * 0.21}px ${3 * k}px ${width * 0.72 * 0.27}px`,
                boxShadow: "0 2px 6px rgba(0,0,0,.25)", ...ribbonText }}>
              {/* The app shrinks the words to fit the corner; so does this. */}
              <span className="inline-block max-w-full align-middle"
                style={{ fontSize: Math.min(11.5 * k, (width * 0.72 * 0.52) / Math.max(1, shop.tagline.length * 0.62)) }}>
                {shop.tagline}
              </span>
            </div>
          )
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2" style={{ height: 36 * k, background: stripBg, padding: `0 ${12 * k}px` }}>
        <span className="truncate" style={{ color: nameInk, fontWeight: 800, fontSize: 14 * k }}>{shop.name}</span>
        {fact ? <span className="shrink-0" style={{ color: factInk, fontWeight: 700, fontSize: 11.5 * k }}>{fact}</span> : null}
      </div>
    </div>
  );
}

/** What the row looks like on a phone: one card and a half, then the dots. */
export function RowPreview({ look, shops }: { look: CardLook; shops: PreviewShop[] }) {
  const list = shops.length ? shops : [
    { name: "Habib Cafe", picture: "", tagline: "Buy 1 get 1 coffee", rating: 4.6, ratingCount: 10 },
    { name: "Bite Spot", picture: "", tagline: "20% OFF burgers", rating: 4.4, ratingCount: 10 },
  ];
  return (
    <div className="mx-auto w-[300px] rounded-[26px] border-[6px] border-takal-ink bg-white overflow-hidden shadow-xl">
      <div className="h-9 bg-takal-yellow" />
      <div className="px-2.5 pt-2 pb-1">
        <div className="h-12 rounded-xl bg-gradient-to-r from-[#141414] to-[#3A1C52]" />
      </div>
      <div className="flex gap-2 overflow-hidden pl-2.5 pt-2 pb-2">
        {list.slice(0, 2).map((s, i) => (
          <ShopCardPreview key={i} look={look} shop={s} width={190} />
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-2">
        {list.slice(0, 5).map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full ${i === 0 ? "w-4 bg-takal-ink" : "w-1.5 bg-slate-300"}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 px-2.5 pb-3">
        {["#FF9A33", "#A0CE3E", "#19B8C4", "#5C72E4"].map((c) => (
          <div key={c} className="h-14 rounded-xl opacity-70" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
