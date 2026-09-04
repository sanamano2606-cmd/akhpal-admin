"use client";

/**
 * HOME BANNERS — the coloured cards across the top of the customer home screen.
 *
 * REBUILT 2026-09-03. Sana: "the card cards banners and others that will be
 * shown in the customer app, must be latest designed and well connected to
 * what these will go to offer."
 *
 * WHAT WAS WRONG, read off the live database on the day:
 *
 *   * "Big Savings" promised FREE DELIVERY ON FIRST 5 ORDERS and, with no
 *     destination stored, dropped the customer on the categories list — which
 *     says nothing about any offer.
 *   * "Free Delivery" made the same promise and opened the restaurant list
 *     instead of the FIRST5 code.
 *   * A banner COULD NOT point at a discount code at all. The only choices
 *     were a section or nothing, so neither of those was a mistake anyone
 *     made: it was the only thing the screen offered.
 *   * No dates. A Ramadan banner had to be switched off by hand on the right
 *     morning, or it was still up in July.
 *   * No record of a banner ever being tapped, so after seven weeks live there
 *     was no way to say which one brought orders.
 *   * Positions typed by hand — 1, 3, 4, 5 — with nothing stopping two banners
 *     claiming the same number.
 *
 * All six are answered here. The destination is CHECKED by the server before
 * it saves: a banner pointing at a code that does not exist, or at one that is
 * switched off, is refused with the reason.
 */

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { VERTICALS } from "@/lib/verticals";
import { Badge, ConfirmDialog, ErrorState, Modal, Button } from "@/components/ui";
import { type ReadFailure, readFailure } from "@/lib/api-errors";
import { BANNER_STATUS, BANNER_DESTINATIONS, bannerReach, colourWarning, inkFor } from "@/lib/marketing";
import { errorMessage } from "@/lib/api-errors";
import { BannerPreview } from "./parts-banner-preview";
import { BannerColours } from "./parts-banner-colours";

type Banner = any;

const blank = {
  title: "",
  subtitle: "",
  emoji: "",
  // A NEW banner opens in Takal yellow. It used to open purple-into-indigo,
  // which is nobody's brand — so every banner had to be recoloured by hand or
  // shipped in a colour that is not Takal's.
  color1: "#FFFF00",
  color2: "#FFD400",
  image_url: "",
  cta_text: "Order Now",
  action_type: "none",
  action_value: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
  // The tag card's own colours. Empty means "not set yet" — the app draws
  // that banner the old way until a colour is chosen, so nothing breaks
  // between deploying this and building the app.
  bar_color: "",
  text_color: "",
  tag_style: "notch",
};

export default function HomeBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReadFailure>(null);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [removing, setRemoving] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiClient.getPromoBanners()) as any;
      setBanners(res?.banners || []);
      setSummary(res || {});
    } catch (e) {
      setError(readFailure(e, "the home banners"));
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * Move one banner up or down and save the WHOLE order.
   *
   * Sending the complete list rather than one banner's new number is the point:
   * renumbering one banner by hand is exactly how two of them end up sharing a
   * position. The server rewrites them as 1, 2, 3…
   */
  const move = async (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= banners.length) return;
    const next = [...banners];
    [next[index], next[to]] = [next[to], next[index]];
    setBanners(next);                       // moves on the screen straight away
    try {
      setBusy(true);
      const res = (await apiClient.reorderPromoBanners(
        next.map((b) => String(b.id)),
      )) as any;
      setBanners(res?.banners || next);
    } catch (e) {
      toast(errorMessage(e, "saving the new order"), "error");
      load();                               // put the screen back to the truth
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      setBusy(true);
      await apiClient.deletePromoBanner(String(removing.id));
      toast("Banner deleted", "success");
      setRemoving(null);
      load();
    } catch (e) {
      toast(errorMessage(e, "deleting the banner"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-takal-ink">Home Banners</h2>
          <p className="mt-1 text-sm text-takal-ink-soft">
            {banners.length} banner{banners.length === 1 ? "" : "s"} ·{" "}
            {summary.live_count ?? 0} showing now
            {summary.leads_nowhere_count > 0 && (
              <>
                {" · "}
                <strong className="text-takal-red">
                  {summary.leads_nowhere_count} lead
                  {summary.leads_nowhere_count === 1 ? "s" : ""} nowhere
                </strong>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...blank })}
          className="rounded-lg bg-takal-yellow px-4 py-2 font-medium text-takal-ink hover:bg-takal-yellow-dark"
        >
          + Add banner
        </button>
      </div>

      {error && (
        <ErrorState message={error.message} onRetry={load} denied={error.denied} />
      )}

      {loading ? (
        <div className="text-takal-ink-soft">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-takal-line bg-white p-8 text-center text-takal-ink-soft">
          The banners could not be read, so none can be listed here.
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-lg border border-takal-line bg-white p-8 text-center text-takal-ink-soft">
          No banners yet. Click &ldquo;Add banner&rdquo; to create one.
        </div>
      ) : (
        <div className="grid gap-3">
          {banners.map((b, i) => {
            const status = BANNER_STATUS[b.status] || BANNER_STATUS.off;
            return (
              <div
                key={b.id}
                className="flex items-center gap-4 rounded-xl border border-takal-line bg-white p-3"
              >
                {/* Order. Two buttons rather than a drag: a drag needs a mouse
                    and this page is opened on a phone as often as a laptop. */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy}
                    title="Move up"
                    className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === banners.length - 1 || busy}
                    title="Move down"
                    className="rounded border border-takal-line p-1 text-takal-ink-soft hover:bg-takal-page disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div
                  // THE TITLE WAS WHITE WHATEVER THE BANNER'S COLOUR WAS.
                  // On a pale banner - and every bright preset in this panel
                  // is pale, by design - white on white is nothing at all. The
                  // ink is now worked out from the colour behind it, by the
                  // same rule the customer app uses.
                  className="flex h-20 w-40 shrink-0 items-center overflow-hidden rounded-lg px-3"
                  
                  style={
                    b.image_url
                      ? {
                          backgroundImage: `url(${b.image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          // Over a photograph the white-with-a-shadow reading
                          // is right and stays; it is the flat-colour case
                          // below that was wrong.
                          color: "#FFFFFF",
                        }
                      : {
                          background: `linear-gradient(135deg, ${b.color1}, ${b.color2})`,
                          color: inkFor(b.color1),
                        }
                  }
                >
                  <div className="drop-shadow">
                    <div className="text-sm font-bold leading-tight">{b.title}</div>
                    <div className="text-[10px] leading-tight opacity-90">{b.subtitle}</div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-takal-ink">{b.title}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  {/* WHERE IT GOES, said in words, every time. A blank here
                      reads as "not filled in yet"; this banner actively does
                      nothing, and that has to be visible from the list. */}
                  <div
                    className={`mt-1 text-xs ${
                      b.leads_nowhere ? "font-bold text-takal-red" : "text-takal-ink-soft"
                    }`}
                  >
                    Tapping it opens: {b.goes_to}
                  </div>

                  <div className="mt-0.5 flex items-center gap-2 text-xs text-takal-ink-soft">
                    {b.bar_color ? (
                      <>
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10"
                          style={{ background: b.bar_color }}
                        />
                        <span className="font-mono">{b.bar_color}</span>
                      </>
                    ) : (
                      // Said out loud rather than left blank: a banner with no
                      // bar colour is still drawn the old way, words on top of
                      // the picture, and that is worth knowing at a glance.
                      <span className="font-medium text-takal-orange">Old style</span>
                    )}
                    <span>·</span>
                    <span>
                      {b.ends_at ? `Until ${String(b.ends_at).slice(0, 10)}` : "No end date"}
                    </span>
                    <span>·</span>
                    <span>{bannerReach(b.shown_count, b.tap_count)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setEditing(b)}
                  className="rounded-lg border border-takal-line px-3 py-1.5 text-sm hover:bg-takal-page"
                >
                  Edit
                </button>
                <button
                  onClick={() => setRemoving(b)}
                  className="rounded-lg px-3 py-1.5 text-sm text-takal-red hover:bg-takal-red-soft"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <BannerEditor
          banner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {/* Not window.confirm. A banner IS safe to delete — nothing about money
          hangs off it — but its shown and tapped counts go with it, and that
          is worth saying before rather than discovering after. */}
      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
        busy={busy}
        title={`Delete "${removing?.title ?? ""}"?`}
        confirmLabel="Delete it"
        message={
          <>
            It disappears from the customer app straight away.
            {Number(removing?.tap_count || 0) > 0 && (
              <>
                {" "}
                Its record of{" "}
                <strong>{Number(removing?.tap_count).toLocaleString()} taps</strong>{" "}
                goes with it. To stop it showing without losing that, edit it and
                untick <strong>Show in the app</strong> instead.
              </>
            )}
          </>
        }
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function BannerEditor({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!banner.id;
  const [f, setF] = useState<Banner>({
    ...blank,
    ...banner,
    starts_at: banner.starts_at ? String(banner.starts_at).slice(0, 10) : "",
    ends_at: banner.ends_at ? String(banner.ends_at).slice(0, 10) : "",
    bar_color: banner.bar_color || "",
    text_color: banner.text_color || "",
    tag_style: banner.tag_style || "notch",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [promos, setPromos] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const { upload: uploadImage, uploading } = useImageUpload();

  const set = (k: string, v: any) => setF((p: Banner) => ({ ...p, [k]: v }));

  // The codes and shops a banner can be pointed at.
  //
  // Both reads are ALLOWED TO FAIL without breaking the editor: a sub-admin
  // given only "promos" cannot read the shop list, and refusing to open the
  // banner editor for that reason would be this feature breaking a screen that
  // used to work. When a list is missing the field falls back to typing.
  useEffect(() => {
    apiClient
      .getPromos()
      .then((r: any) => setPromos(r?.promos || []))
      .catch(() => setPromos([]));
    apiClient
      .getRestaurants()
      .then((r: any) => setShops(r?.restaurants || r?.data || []))
      .catch(() => setShops([]));
  }, []);

  const upload = async (file: File | null) => {
    const url = await uploadImage(file);
    if (url) set("image_url", url);
  };

  const save = async () => {
    setError("");
    if (!f.title.trim()) {
      setError("Give the banner a title.");
      return;
    }
    if (f.action_type !== "none" && !String(f.action_value || "").trim()) {
      setError(
        "Say where this banner goes, or set it to go nowhere on purpose.",
      );
      return;
    }
    const payload = {
      title: f.title.trim(),
      subtitle: f.subtitle?.trim() || "",
      emoji: f.emoji?.trim() || "",
      color1: f.color1,
      color2: f.color2,
      image_url: f.image_url?.trim() || "",
      cta_text: f.cta_text?.trim() || "Order Now",
      action_type: f.action_type || "none",
      action_value: f.action_type === "none" ? "" : String(f.action_value || "").trim(),
      starts_at: f.starts_at || null,
      ends_at: f.ends_at || null,
      is_active: !!f.is_active,
      // NULL, not "". An empty colour means "go back to working it out", and
      // the server tells the two apart: a field left out is "leave it alone",
      // a field sent as null is "clear it".
      bar_color: (f.bar_color || "").trim() || null,
      text_color: (f.text_color || "").trim() || null,
      tag_style: f.tag_style || "notch",
    };
    try {
      setSaving(true);
      if (isEdit) await apiClient.updatePromoBanner(String(banner.id), payload);
      else await apiClient.createPromoBanner(payload);
      toast(isEdit ? "Banner updated" : "Banner added", "success");
      onSaved();
    } catch (e) {
      // The server's own sentence — "There is no discount code called EID25",
      // "TAKAL1 is switched off" — is more use than a generic failure.
      setError(errorMessage(e, "saving the banner"));
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow outline-none text-sm";

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit "${banner.title}"` : "Add a banner"}
      size="lg"
      lockClose={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {isEdit ? "Save changes" : "Add banner"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <input
            placeholder="Title"
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            className={input}
          />
          <input
            placeholder="The line underneath"
            value={f.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            className={input}
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Emoji (optional)"
              value={f.emoji}
              onChange={(e) => set("emoji", e.target.value)}
              className={input}
            />
            <input
              placeholder="Button text"
              value={f.cta_text}
              onChange={(e) => set("cta_text", e.target.value)}
              className={input}
            />
          </div>

          {/* THE TAG CARD'S COLOURS.
              These replaced the two old gradient boxes. The gradient only ever
              showed when a banner had NO picture, and all four live banners
              have one — so those two boxes changed nothing anybody could see.
              They are still saved and still used for a picture-less banner;
              they are just no longer the first thing on the screen. */}
          <BannerColours
            imageUrl={f.image_url}
            barColor={f.bar_color}
            textColor={f.text_color}
            tagStyle={f.tag_style}
            onChange={(patch) =>
              setF((p: Banner) => ({
                ...p,
                ...(("bar_color" in patch) ? { bar_color: patch.bar_color ?? "" } : {}),
                ...(("text_color" in patch) ? { text_color: patch.text_color ?? "" } : {}),
                ...(("tag_style" in patch) ? { tag_style: patch.tag_style ?? "notch" } : {}),
              }))
            }
          />

          <details className="rounded-lg border border-takal-line bg-white p-3">
            <summary className="cursor-pointer text-xs font-medium text-takal-ink-soft">
              Colours for a banner with no picture
            </summary>
            <div className="mt-3 flex items-center gap-4">
              <input
                type="color"
                value={f.color1}
                onChange={(e) => set("color1", e.target.value)}
                className="h-9 w-12 rounded border"
                title="Start colour"
              />
              <input
                type="color"
                value={f.color2}
                onChange={(e) => set("color2", e.target.value)}
                className="h-9 w-12 rounded border"
                title="End colour"
              />
              <span className="text-xs text-takal-ink-soft">
                Only used when there is no background picture.
              </span>
            </div>
            {/* The old fade warning still does its job here, where the fade is
                still the thing being drawn. It is no longer on the main screen
                because a banner WITH a picture never shows this gradient. */}
            {colourWarning(f.color1, f.color2) && (
              <p className="mt-3 rounded border-l-4 border-takal-orange bg-takal-orange-soft px-3 py-2 text-xs text-[#C8410F]">
                {colourWarning(f.color1, f.color2)} You can save it anyway.
              </p>
            )}
          </details>

          {/* Image */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-takal-ink">
                Background picture{" "}
                <span className="font-normal text-takal-ink-soft">
                  (optional — covers the colours)
                </span>
              </p>
              <label
                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  uploading
                    ? "bg-takal-page text-takal-ink-soft"
                    : "bg-takal-yellow text-takal-ink hover:bg-takal-yellow-dark"
                }`}
              >
                {uploading ? "Uploading…" : "＋ Upload"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => {
                    upload(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {f.image_url ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.image_url} alt="banner" className="h-12 w-24 rounded border object-cover" />
                <button
                  type="button"
                  onClick={() => set("image_url", "")}
                  className="text-sm text-takal-red"
                >
                  Remove picture
                </button>
              </div>
            ) : (
              <input
                placeholder="…or paste a picture address"
                value={f.image_url}
                onChange={(e) => set("image_url", e.target.value)}
                className={input}
              />
            )}
          </div>

          {/* WHERE IT GOES — the whole reason for this rebuild. */}
          <div className="rounded-lg border border-takal-line bg-takal-page p-3">
            <p className="mb-2 text-sm font-bold text-takal-ink">
              Tapping it opens
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={f.action_type}
                onChange={(e) => {
                  set("action_type", e.target.value);
                  set("action_value", "");   // a stale value would point at the wrong thing
                }}
                className={input}
              >
                {BANNER_DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>

              {f.action_type === "promo" &&
                (promos.length > 0 ? (
                  <select
                    value={f.action_value}
                    onChange={(e) => set("action_value", e.target.value)}
                    className={input}
                  >
                    <option value="">Choose a code…</option>
                    {promos.map((p: any) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {(p.gives || []).join(" + ") || "gives nothing"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="Type the code, e.g. FIRST5"
                    value={f.action_value}
                    onChange={(e) => set("action_value", e.target.value.toUpperCase())}
                    className={input}
                  />
                ))}

              {f.action_type === "vertical" && (
                <select
                  value={f.action_value}
                  onChange={(e) => set("action_value", e.target.value)}
                  className={input}
                >
                  <option value="">Choose a section…</option>
                  {VERTICALS.map(({ value: v, label, emoji }) => (
                    <option key={v} value={v}>
                      {emoji} {label}
                    </option>
                  ))}
                </select>
              )}

              {f.action_type === "shop" &&
                (shops.length > 0 ? (
                  <select
                    value={f.action_value}
                    onChange={(e) => set("action_value", e.target.value)}
                    className={input}
                  >
                    <option value="">Choose a shop…</option>
                    {shops.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="Paste the shop's id"
                    value={f.action_value}
                    onChange={(e) => set("action_value", e.target.value)}
                    className={input}
                  />
                ))}

              {f.action_type === "url" && (
                <input
                  placeholder="https://…"
                  value={f.action_value}
                  onChange={(e) => set("action_value", e.target.value)}
                  className={input}
                />
              )}
            </div>

            <p className="mt-2 text-xs text-takal-ink-soft">
              {BANNER_DESTINATIONS.find((d) => d.value === f.action_type)?.hint}
            </p>

            {f.action_type === "none" && (
              <p className="mt-2 rounded border-l-4 border-takal-red bg-takal-red-soft px-3 py-2 text-xs">
                <strong>Tapping this banner just opens the categories list.</strong>{" "}
                If the words promise an offer, point it at that code instead —
                a promise that lands somewhere unrelated costs more than no
                banner at all.
              </p>
            )}
          </div>

          {/* WHEN IT RUNS. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-takal-ink">
                Goes up (optional)
              </label>
              <input
                type="date"
                value={f.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-takal-ink">
                Comes down (optional)
              </label>
              <input
                type="date"
                value={f.ends_at}
                onChange={(e) => set("ends_at", e.target.value)}
                className={input}
              />
              <p className="mt-1 text-xs text-takal-ink-soft">
                Empty means it stays up until you switch it off.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-takal-ink">
            <input
              type="checkbox"
              checked={!!f.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            Show in the app
          </label>

          {error && (
            <p className="rounded-lg border-l-4 border-takal-red bg-takal-red-soft px-3 py-2 text-sm">
              {error}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-takal-ink-soft">
            What the customer sees
          </p>
          <BannerPreview
            title={f.title}
            subtitle={f.subtitle}
            cta={f.cta_text}
            imageUrl={f.image_url}
            barColor={f.bar_color}
            textColor={f.text_color}
            tagStyle={f.tag_style}
            badge={f.emoji ? undefined : "NEW"}
          />
        </div>
      </div>
    </Modal>
  );
}
