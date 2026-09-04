"use client";

/**
 * THE EDITOR — every control Sana listed, grouped the way she said them.
 *
 *   "add more change colour, Font, size, Style, design, and when to appear and
 *    how to and how long should stay on top and if there are more the after how
 *    many time should they change/appear next one"
 *
 * Five groups, in that order: what it says · how it looks · how it arrives ·
 * when it shows · where it goes. The preview sits beside them and redraws on
 * every keystroke, because the whole reason this screen exists is that the old
 * one showed a colour the app never used.
 */

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  ALIGNMENTS, COLOUR_MOTION, DAYS, ENTRANCES, FLAT_COLOURS, FONTS,
  GRADIENTS, GRADIENT_LABELS, SHAPES, SIZES, WEIGHTS,
  announcementColourWarning, announcementInk,
} from "@/lib/announcements";
import { HEX } from "@/lib/marketing";
import { AnnouncementPreview } from "./parts-preview";

type Draft = Record<string, any>;

export const BLANK: Draft = {
  name: "", message: "", message_2: "", message_ur: "", icon: "",
  bg_color: "#FFFF00", bg_gradient: null, text_color: null,
  font: "poppins", text_size: "normal", text_weight: "bold",
  shape: "card", align: "left", uppercase: false,
  entrance: "wave", colour_motion: "settle", settle_secs: 6,
  stay_secs: 6, dismissible: true, return_hours: 24,
  starts_at: "", ends_at: "", days: [], hour_from: 0, hour_to: 0,
  for_customer: true, for_rider: false, for_vendor: false,
  action_type: "none", action_value: "", is_active: true,
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="flex items-center gap-2 text-[10.5px] font-black tracking-[1.1px] text-takal-ink mb-2.5">
        {title}
        <span className="flex-1 h-px bg-takal-line" />
      </p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[11.5px] font-bold text-takal-ink mb-1">{label}</label>
      {children}
      {hint ? <p className="text-[10.5px] text-takal-ink-soft mt-1 leading-snug">{hint}</p> : null}
    </div>
  );
}

/** A row of choices. Used everywhere a setting has a small fixed set, because a
 *  dropdown hides the options and this screen is about seeing them. */
function Choice<T extends string | number>({
  value, options, onPick,
}: {
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-takal-line overflow-hidden">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.hint}
          onClick={() => onPick(o.value)}
          className={`flex-1 text-[11px] py-1.5 px-1 border-r border-takal-line last:border-r-0 transition
            ${String(value) === String(o.value)
              ? "bg-takal-ink text-takal-yellow font-extrabold"
              : "text-takal-ink-soft hover:bg-takal-page"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onFlip, label, hint }: {
  on: boolean; onFlip: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <div className="mb-2">
      <button type="button" onClick={() => onFlip(!on)}
        className="flex items-center gap-2.5 text-[11.5px] text-takal-ink">
        <span className={`relative w-8 h-[18px] rounded-full transition shrink-0
                          ${on ? "bg-takal-ink" : "bg-[#D9D9D9]"}`}>
          <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all
                            ${on ? "left-[16px]" : "left-0.5"}`} />
        </span>
        {label}
      </button>
      {hint ? <p className="text-[10.5px] text-takal-ink-soft ml-[42px] leading-snug">{hint}</p> : null}
    </div>
  );
}

export function AnnouncementEditor({
  draft, setDraft, onSave, onCancel, saving, isNew,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  const set = (k: string, v: any) => setDraft({ ...draft, [k]: v });
  const warning = announcementColourWarning(draft);
  const ink = announcementInk(draft);
  const [hex, setHex] = useState<string>(draft.bg_color || "#FFFF00");

  const pickFlat = (colour: string) => {
    setHex(colour);
    setDraft({ ...draft, bg_color: colour, bg_gradient: null });
  };

  const toggleDay = (day: number) => {
    const days: number[] = Array.isArray(draft.days) ? [...draft.days] : [];
    const at = days.indexOf(day);
    if (at >= 0) days.splice(at, 1); else days.push(day);
    set("days", days.sort());
  };

  return (
    <div className="rounded-2xl border-2 border-takal-ink overflow-hidden">
      <div className="bg-takal-ink text-takal-yellow text-[12.5px] font-black px-4 py-2.5 tracking-wide">
        {isNew ? "NEW ANNOUNCEMENT" : `EDITING — “${draft.name || "untitled"}”`}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 p-4">
        {/* ── the controls ── */}
        <div>
          <Group title="WHAT IT SAYS">
            <Field label="Name — only you see this"
              hint="So you can find it in the list. Two announcements can carry the same words at different times of year.">
              <input value={draft.name || ""} onChange={(e) => set("name", e.target.value)}
                placeholder="Our tagline" maxLength={80} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Message">
                <input value={draft.message || ""} onChange={(e) => set("message", e.target.value)}
                  placeholder="Free delivery on your first 5 orders" maxLength={120} />
              </Field>
              <Field label="Second line — optional">
                <input value={draft.message_2 || ""} onChange={(e) => set("message_2", e.target.value)}
                  placeholder="Leave empty for a one-line strip" maxLength={120} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Icon" hint="One emoji, or leave it empty.">
                <input value={draft.icon || ""} onChange={(e) => set("icon", e.target.value.slice(0, 4))}
                  placeholder="🚚" />
              </Field>
              <Field label="The same words in Urdu or Pashto — optional"
                hint="Shown to customers using the app in Urdu.">
                <input dir="rtl" value={draft.message_ur || ""}
                  onChange={(e) => set("message_ur", e.target.value)} maxLength={120} />
              </Field>
            </div>
          </Group>

          <Group title="HOW IT LOOKS">
            <Field label="Background">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {FLAT_COLOURS.map((c) => (
                  <button key={c} type="button" onClick={() => pickFlat(c)} title={c}
                    style={{ background: c }}
                    className={`w-6 h-6 rounded-md border border-black/10
                      ${!draft.bg_gradient && draft.bg_color === c
                        ? "outline outline-2 outline-offset-[2px] outline-takal-ink" : ""}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {Object.entries(GRADIENTS).map(([name, stops]) => (
                  <button key={name} type="button" title={GRADIENT_LABELS[name]}
                    onClick={() => set("bg_gradient", name)}
                    style={{ background: `linear-gradient(100deg, ${stops.join(", ")})` }}
                    className={`w-9 h-6 rounded-md border border-black/10
                      ${draft.bg_gradient === name
                        ? "outline outline-2 outline-offset-[2px] outline-takal-ink" : ""}`} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input value={hex} onChange={(e) => setHex(e.target.value)}
                  onBlur={() => { if (HEX.test(hex.trim())) pickFlat(hex.trim().toUpperCase()); }}
                  className="w-28 font-mono text-[11.5px]" placeholder="#FFCC00" />
                {draft.bg_gradient ? (
                  <button type="button" onClick={() => pickFlat(draft.bg_color || "#FFFF00")}
                    className="text-[11px] font-semibold text-takal-ink underline">
                    Use one colour instead
                  </button>
                ) : null}
              </div>
              {warning ? (
                <p className="text-[10.5px] font-bold text-[#C8410F] mt-1.5">{warning}</p>
              ) : (
                <p className="text-[10.5px] font-bold text-takal-green mt-1.5">
                  ✓ {ink === "#000000" ? "Black" : "White"} writing reads clearly on this
                </p>
              )}
            </Field>

            <Field label="Writing colour"
              hint="“Pick it for me” lands on whichever of black or white can actually be read. On Takal yellow that is black, which is the Brand Kit rule anyway.">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Choice
                    value={draft.text_color ? "chosen" : "auto"}
                    options={[
                      { value: "auto", label: "Pick it for me" },
                      { value: "chosen", label: "Choose myself" },
                    ] as const}
                    onPick={(v) => set("text_color", v === "auto" ? null : ink)}
                  />
                </div>
                {draft.text_color ? (
                  <input value={draft.text_color}
                    onChange={(e) => set("text_color", e.target.value.toUpperCase())}
                    className="w-24 font-mono text-[11.5px]" />
                ) : null}
              </div>
            </Field>

            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Font">
                <Choice value={draft.font} options={FONTS} onPick={(v) => set("font", v)} />
              </Field>
              <Field label="Size">
                <Choice value={draft.text_size} options={SIZES} onPick={(v) => set("text_size", v)} />
              </Field>
              <Field label="Weight">
                <Choice value={draft.text_weight} options={WEIGHTS} onPick={(v) => set("text_weight", v)} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Shape">
                <Choice value={draft.shape} options={SHAPES} onPick={(v) => set("shape", v)} />
              </Field>
              <Field label="Line up">
                <Choice value={draft.align} options={ALIGNMENTS} onPick={(v) => set("align", v)} />
              </Field>
              <Field label="Letters">
                <Choice value={draft.uppercase ? "caps" : "typed"}
                  options={[{ value: "typed", label: "As typed" }, { value: "caps", label: "CAPITALS" }] as const}
                  onPick={(v) => set("uppercase", v === "caps")} />
              </Field>
            </div>
          </Group>

          <Group title="HOW IT ARRIVES AND MOVES">
            <Field label="Movement"
              hint={ENTRANCES.find((e) => e.value === draft.entrance)?.hint}>
              <Choice value={draft.entrance} options={ENTRANCES} onPick={(v) => set("entrance", v)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Do the colours move?"
                hint={COLOUR_MOTION.find((m) => m.value === draft.colour_motion)?.hint}>
                <Choice value={draft.colour_motion} options={COLOUR_MOTION}
                  onPick={(v) => set("colour_motion", v)} />
              </Field>
              <Field label="Settle after"
                hint="Only used by “Move, then settle”.">
                <input type="number" min={0} max={60} value={draft.settle_secs ?? 6}
                  onChange={(e) => set("settle_secs", Number(e.target.value))} />
              </Field>
            </div>
            {!draft.bg_gradient && draft.colour_motion !== "still" ? (
              <p className="text-[10.5px] font-bold text-[#C8410F] -mt-1 mb-2">
                One flat colour has nothing to move. Pick a multicolour background above,
                or set the movement to Still.
              </p>
            ) : null}
          </Group>

          <Group title="HOW LONG IT STAYS">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Stays on screen for"
                hint="Seconds. Put 0 for “until the customer closes it”.">
                <input type="number" min={0} max={120} value={draft.stay_secs ?? 6}
                  onChange={(e) => set("stay_secs", Number(e.target.value))} />
              </Field>
              <Field label="If they close it, bring it back after"
                hint="Hours. 0 means never bring it back.">
                <input type="number" min={0} max={8760} value={draft.return_hours ?? 24}
                  disabled={!draft.dismissible}
                  onChange={(e) => set("return_hours", Number(e.target.value))} />
              </Field>
            </div>
            <Switch on={!!draft.dismissible} onFlip={(v) => set("dismissible", v)}
              label="The customer can close it with an ✕"
              hint="The old strip's ✕ hid it for ever — one tap and that customer never saw another announcement." />
          </Group>

          <Group title="WHEN IT APPEARS">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Starts" hint="Leave empty to start straight away.">
                <input type="datetime-local" value={draft.starts_at || ""}
                  onChange={(e) => set("starts_at", e.target.value)} />
              </Field>
              <Field label="Ends" hint="Leave empty to run until you switch it off.">
                <input type="datetime-local" value={draft.ends_at || ""}
                  onChange={(e) => set("ends_at", e.target.value)} />
              </Field>
            </div>
            <Field label="Only on these days" hint="Pick none for every day.">
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((d) => {
                  const on = (draft.days || []).includes(d.value);
                  return (
                    <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition
                        ${on ? "bg-takal-ink text-takal-yellow border-takal-ink"
                             : "border-takal-line text-takal-ink-soft hover:bg-takal-page"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Only between these hours"
                hint="Same number twice means all day. 22 to 6 is an overnight window, and it works.">
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={23} value={draft.hour_from ?? 0}
                    onChange={(e) => set("hour_from", Number(e.target.value))} className="w-20" />
                  <span className="text-takal-ink-soft text-sm">to</span>
                  <input type="number" min={0} max={23} value={draft.hour_to ?? 0}
                    onChange={(e) => set("hour_to", Number(e.target.value))} className="w-20" />
                  <span className="text-[10.5px] text-takal-ink-soft">Pakistan time</span>
                </div>
              </Field>
              <Field label="Show it in">
                <Switch on={!!draft.for_customer} onFlip={(v) => set("for_customer", v)} label="Customer app" />
                <Switch on={!!draft.for_rider} onFlip={(v) => set("for_rider", v)} label="Takal Riders" />
                <Switch on={!!draft.for_vendor} onFlip={(v) => set("for_vendor", v)} label="Takal Partners" />
              </Field>
            </div>
          </Group>

          <Group title="WHEN THEY TAP IT">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Tapping it opens">
                <select value={draft.action_type}
                  onChange={(e) => set("action_type", e.target.value)}>
                  <option value="none">Nothing — it is just words</option>
                  <option value="promo">A discount code</option>
                  <option value="shop">A shop</option>
                  <option value="vertical">A category</option>
                  <option value="url">A web page</option>
                </select>
              </Field>
              {draft.action_type !== "none" ? (
                <Field label="Which one"
                  hint={draft.action_type === "promo" ? "The code itself, e.g. FIRST5."
                    : draft.action_type === "url" ? "The full address, starting https://"
                    : "The name the app knows it by."}>
                  <input value={draft.action_value || ""}
                    onChange={(e) => set("action_value", e.target.value)} />
                </Field>
              ) : null}
            </div>
            <Switch on={!!draft.is_active} onFlip={(v) => set("is_active", v)}
              label="Switched on"
              hint="Off keeps it here without showing it to anybody." />
          </Group>

          <div className="flex items-center gap-2.5 mt-5">
            <Button onClick={onSave} loading={saving}>
              {isNew ? "Create announcement" : "Save changes"}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
            <span className="text-[11px] text-takal-ink-soft">
              Saved changes reach every phone the next time it opens.
            </span>
          </div>
        </div>

        {/* ── the preview, always visible ── */}
        <div className="lg:sticky lg:top-4 self-start">
          <p className="text-[10.5px] font-black tracking-[1.1px] text-takal-ink mb-2.5">
            LIVE PREVIEW — WHAT THE PHONE DRAWS
          </p>
          <AnnouncementPreview draft={draft} />
        </div>
      </div>
    </div>
  );
}
