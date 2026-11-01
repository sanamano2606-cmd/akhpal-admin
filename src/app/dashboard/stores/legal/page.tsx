"use client";

// ─────────────────────────────────────────────────────────────────────────────
// STORES › ⚖️ LEGAL CHECK (Mock 224-1 and 224-2, approved by Sana 1 Nov 2026).
//
// Sana: "Flag Any products that can be caused Legal Actions" -> "when a store
// get ready and when new products added" -> "editable list Change and add
// another name" -> "Approved".
//
// The words the Takal Assistant hides AND locks products for, in groups, each
// with the Roman Urdu sentence the vendor is told and an On switch; the safe
// phrases that are never hidden; and "If you save now" - the exact products
// these lists would hide, before anything changes. Typing a new word shows at
// once what it would catch (224-2).
//
// The reviewers (stores.approve) read it; only the Main Admin saves (the
// server refuses anybody else - PUT /admin/legal-check/save is __super__).
// The Assistant checks every product against saved lists within the hour.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { ErrorState, LoadingState } from "@/components/ui";
import { getMyPerms } from "@/lib/perms";
import {
  addWord, catches, listsChanged, newGroup, removeWord, wordCatches, wordProblem,
  type LegalGroup, type LegalHit, type LegalLists, type LegalPreview,
} from "@/lib/legal-check";

type Draft = { groups: LegalGroup[]; safe_phrases: string[] };

export default function LegalCheckPage() {
  const [saved, setSaved] = useState<LegalLists | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<LegalPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isMain, setIsMain] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const got = await apiClient.getLegalCheck();
      setSaved(got);
      setDraft({ groups: got.groups, safe_phrases: got.safe_phrases });
      setPreview(got.today || null);
      setIsMain(!!got.is_main_admin || getMyPerms().isSuper);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changed = !!saved && !!draft && listsChanged(draft, saved);
  const on = !!saved?.switched_on;
  const canEdit = on && isMain;

  // "If you save now": the lists on screen, half a second after the last change.
  const seq = useRef(0);
  useEffect(() => {
    if (!on || !draft || !saved) return;
    if (!listsChanged(draft, saved)) { setPreview(saved.today || null); return; }
    const mine = ++seq.current;
    setPreviewBusy(true);
    const t = setTimeout(async () => {
      try {
        const p = await apiClient.previewLegalCheck(draft.groups, draft.safe_phrases);
        if (mine === seq.current) setPreview(p);
      } catch (err) {
        if (mine === seq.current) toast(err instanceof Error ? err.message : "The preview could not be worked out", "error");
      } finally {
        if (mine === seq.current) setPreviewBusy(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [draft, saved, on]);

  const setGroup = (key: string, change: Partial<LegalGroup>) =>
    setDraft((d) => d && { ...d, groups: d.groups.map((g) => (g.key === key ? { ...g, ...change } : g)) });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await apiClient.saveLegalCheck(draft.groups, draft.safe_phrases);
      toast("Saved. The Takal Assistant checks every product against these words within the hour.", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That did not save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (failed) return <ErrorState message="The legal check could not be read just now." onRetry={load} />;
  if (!saved || !draft) return <LoadingState label="Reading the legal check…" />;

  const wordGroups = draft.groups.filter((g) => g.auto !== "medicine");
  const rx = draft.groups.find((g) => g.auto === "medicine");

  return (
    <div className="space-y-4" data-testid="legal-check">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-takal-ink">⚖️ Words the Takal Assistant looks for</h2>
          <p className="max-w-[900px] text-[13.5px] text-takal-ink-soft">
            When a store gets ready, and every hour for new or changed products, the Assistant reads each
            product&apos;s <b className="text-takal-ink">name, description and options</b>. A product using one of these
            words is <b className="text-takal-ink">hidden and locked</b>, and the vendor is told why in Roman Urdu.
            A product the Main Admin allows is never hidden again.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" data-new-group
              onClick={() => setDraft((d) => d && { ...d, groups: [...d.groups.filter((g) => g.auto !== "medicine"),
                newGroup(d.groups), ...d.groups.filter((g) => g.auto === "medicine")] })}
              className="whitespace-nowrap rounded-[10px] border-2 border-takal-ink bg-white px-3.5 py-2 text-[13.5px] font-bold">
              + New group
            </button>
            <button type="button" data-save onClick={save} disabled={!changed || saving}
              className="whitespace-nowrap rounded-[10px] border-2 border-takal-ink bg-takal-yellow px-3.5 py-2 text-[13.5px] font-bold text-black disabled:opacity-40">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {!on && (
        <p className="rounded-xl border border-takal-line bg-takal-page px-4 py-3 text-sm font-semibold text-takal-ink">
          The legal check starts after database update 155. These are the words it will start with.
        </p>
      )}
      {on && !isMain && (
        <p className="rounded-xl border border-takal-line bg-takal-page px-4 py-3 text-sm text-takal-ink">
          🔒 Only the Main Admin can change these words. You can see them and what they catch.
        </p>
      )}
      {on && saved.waiting_for_the_assistant && !changed && (
        <p data-waiting className="rounded-xl border border-takal-line bg-[#FFFEE0] px-4 py-3 text-sm text-takal-ink">
          ⏳ Saved. The Takal Assistant checks every product against these words within the hour.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {wordGroups.map((g) => (
              <GroupCard key={g.key} g={g} preview={preview} canEdit={canEdit}
                lists={draft} onChange={(c) => setGroup(g.key, c)}
                onRemove={() => setDraft((d) => d && { ...d, groups: d.groups.filter((x) => x.key !== g.key) })} />
            ))}
          </div>

          <SafeCard phrases={draft.safe_phrases} canEdit={canEdit}
            onChange={(safe_phrases) => setDraft((d) => d && { ...d, safe_phrases })} />

          {rx && (
            <div data-rx-group className="rounded-2xl border-[1.5px] border-takal-line bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-takal-page text-lg" aria-hidden>{rx.icon}</span>
                <b className="flex-1 text-[15px] text-takal-ink">{rx.name}</b>
                <span className="rounded-full bg-[#F2F2F2] px-2.5 py-0.5 text-[12px] font-bold text-takal-ink-soft">
                  {catches(preview, rx.key) > 0 ? `catches ${catches(preview, rx.key)} today` : "automatic"}
                </span>
                <OnSwitch on={rx.on} disabled={!canEdit} label={rx.name} onFlip={() => setGroup(rx.key, { on: !rx.on })} />
              </div>
              <p className="mt-2 text-[13px] text-takal-ink-soft">
                No words needed - Takal&apos;s own medicine check decides, only when it is sure (a &quot;cap&quot; can be a hat).
                Never in a pharmacy. <span data-herbal-never>Herbal, Unani and Homeopathic medicines are never caught.</span>
                {" "}Told: <b className="text-takal-ink">&quot;{rx.why}&quot;</b>
              </p>
            </div>
          )}
        </div>

        <IfYouSave preview={preview} busy={previewBusy} changed={changed} />
      </div>
    </div>
  );
}

function OnSwitch({ on, disabled, label, onFlip }: { on: boolean; disabled: boolean; label: string; onFlip: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={`${label} on or off`} disabled={disabled}
      onClick={onFlip}
      className={`relative inline-block h-6 w-11 shrink-0 rounded-full border-2 border-black transition disabled:cursor-not-allowed ${on ? "bg-takal-yellow" : "bg-[#D9D9D9]"}`}>
      <span className={`absolute top-[2px] h-4 w-4 rounded-full bg-black transition-all ${on ? "right-[2px]" : "left-[2px]"}`} />
    </button>
  );
}

function GroupCard({ g, preview, canEdit, lists, onChange, onRemove }: {
  g: LegalGroup; preview: LegalPreview | null; canEdit: boolean; lists: Draft;
  onChange: (c: Partial<LegalGroup>) => void; onRemove: () => void;
}) {
  const n = catches(preview, g.key);
  const [typing, setTyping] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const problem = typing !== null ? wordProblem(g.words, typing) : "";
  const add = () => {
    if (typing === null) return;
    const next = addWord(g.words, typing);
    if (next !== g.words) onChange({ words: next, on: g.on || g.words.length === 0 });
    setTyping(null);
  };
  return (
    <div data-legal-group={g.key}
      className={`min-w-0 rounded-2xl border-[1.5px] bg-white p-4 ${n > 0 ? "border-[#FF6B35]" : "border-takal-line"} ${g.on ? "" : "opacity-70"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-takal-page text-lg" aria-hidden>{g.icon}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input value={g.name} maxLength={80} aria-label="Group name" onChange={(e) => onChange({ name: e.target.value })}
              className="w-full rounded-md border-[1.5px] border-takal-ink px-2 py-1 text-[15px] font-bold" />
          ) : <b className="text-[15px] text-takal-ink">{g.name}</b>}
          {g.skip_types.includes("pharmacy") && (
            <span className="ml-1.5 rounded-md bg-[#E6EEF4] px-1.5 py-px text-[11px] font-bold text-[#0B3A5E]">not Health &amp; Pharmacy</span>
          )}
        </div>
        <span data-catches className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold ${n > 0
          ? "bg-[#FFEFE8] text-[#C8410F]" : "bg-[#F2F2F2] text-takal-ink-soft"}`}>
          {n > 0 ? `catches ${n} today` : "catches 0"}
        </span>
        <OnSwitch on={g.on} disabled={!canEdit || g.words.length === 0} label={g.name} onFlip={() => onChange({ on: !g.on })} />
      </div>

      <div className="mt-2 text-[13px] text-takal-ink-soft">
        Told to the vendor:{" "}
        {editing ? (
          <input value={g.why} maxLength={200} aria-label="What the vendor is told" onChange={(e) => onChange({ why: e.target.value })}
            className="mt-1 w-full rounded-md border-[1.5px] border-takal-ink px-2 py-1 text-[13px] font-bold text-takal-ink" />
        ) : <b className="text-takal-ink">&quot;{g.why}&quot;</b>}
        {canEdit && (
          <button type="button" data-edit-group onClick={() => setEditing(!editing)} className="ml-1 font-bold text-takal-ink"
            title={editing ? "Done" : "Change the name or the sentence"}>{editing ? "✓ Done" : "✏️"}</button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {g.words.map((w) => {
          const c = wordCatches(preview, g.key, w);
          return (
            <span key={w} data-word={w} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[13px] ${c > 0
              ? "border-[#FFB59A] bg-[#FFEFE8] font-bold text-[#C8410F]" : "border-takal-line bg-[#FAFAFA] text-takal-ink"}`}>
              {w}{c > 0 && ` ·${c}`}
              {canEdit && (
                <button type="button" aria-label={`Remove ${w}`} onClick={() => onChange({ words: removeWord(g.words, w) })}
                  className="text-takal-ink-soft hover:text-takal-red">✕</button>
              )}
            </span>
          );
        })}
        {canEdit && (typing === null ? (
          <button type="button" data-add-word onClick={() => setTyping("")}
            className="rounded-lg border border-dashed border-takal-ink-soft px-2 py-0.5 text-[13px] text-takal-ink-soft hover:text-takal-ink">
            + add word
          </button>
        ) : (
          <input autoFocus value={typing} maxLength={40} aria-label={`New word for ${g.name}`}
            onChange={(e) => setTyping(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setTyping(null); }}
            onBlur={() => { if (!typing?.trim()) setTyping(null); }}
            className="w-32 rounded-lg border-[1.5px] border-takal-ink px-2 py-0.5 text-[13px] outline-none shadow-[0_0_0_3px_#FFFF00]" />
        ))}
        {canEdit && g.words.length === 0 && (
          <button type="button" onClick={onRemove} className="text-[12px] font-bold text-takal-red">Remove group</button>
        )}
      </div>
      {typing !== null && typing.trim() && (
        problem ? <p className="mt-2 text-[12.5px] font-bold text-takal-red">{problem}</p>
          : <TypedWordNote group={g} word={typing.trim()} lists={lists} onAdd={add} />
      )}
    </div>
  );
}

/** MOCK 224-2: a new word shows what it would catch before it is saved. */
function TypedWordNote({ group, word, lists, onAdd }: { group: LegalGroup; word: string; lists: Draft; onAdd: () => void }) {
  const [hits, setHits] = useState<LegalHit[] | null>(null);
  useEffect(() => {
    let live = true;
    setHits(null);
    const t = setTimeout(async () => {
      try {
        const groups = lists.groups.map((g) => (g.key === group.key ? { ...g, on: true, words: [...g.words, word] } : g));
        const p = await apiClient.previewLegalCheck(groups, lists.safe_phrases);
        if (live) setHits([...p.would_hide, ...p.already_off].filter((h) => h.group === group.key && h.word === word));
      } catch {
        if (live) setHits([]);
      }
    }, 450);
    return () => { live = false; clearTimeout(t); };
  }, [group, word, lists]);
  return (
    <div data-typed-word className="mt-2 rounded-lg border border-[#E6D200] bg-[#FFFEE0] px-3 py-2 text-[12.5px] text-takal-ink">
      ✏️ {hits === null ? <>Checking what &quot;{word}&quot; would catch…</> : hits.length === 0
        ? <>&quot;{word}&quot; catches nothing today. Press Enter to add it.</>
        : <>&quot;{word}&quot; would catch <b>{hits.length} product{hits.length === 1 ? "" : "s"}</b> today -{" "}
          {hits.slice(0, 4).map((h) => `${h.name} (${h.shop})`).join(", ")}{hits.length > 4 ? "…" : ""}.
          {" "}Press Enter to add it, then Save changes - or add a longer phrase to Safe phrases.</>}
      {hits !== null && <button type="button" onClick={onAdd} className="ml-2 font-bold underline">Add</button>}
    </div>
  );
}

function SafeCard({ phrases, canEdit, onChange }: { phrases: string[]; canEdit: boolean; onChange: (p: string[]) => void }) {
  const [typing, setTyping] = useState<string | null>(null);
  const problem = typing !== null ? wordProblem(phrases, typing) : "";
  const add = () => {
    if (typing === null) return;
    const next = addWord(phrases, typing);
    if (next !== phrases) onChange(next);
    setTyping(null);
  };
  return (
    <div data-safe-phrases className="rounded-2xl border-[1.5px] border-[#9BD3B4] bg-[#EEF8F2] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-lg" aria-hidden>✅</span>
        <b className="flex-1 text-[15px] text-takal-ink">Safe phrases - never hidden</b>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-takal-ink-soft">{phrases.length} phrases</span>
      </div>
      <p className="mt-2 text-[13px] text-takal-ink-soft">
        A product containing one of these is skipped, even if it also has a word above (e.g. <b className="text-takal-ink">&quot;Kids Police Tricycle&quot;</b> is a toy).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {phrases.map((w) => (
          <span key={w} className="inline-flex items-center gap-1 rounded-lg border border-takal-line bg-white px-2 py-0.5 text-[13px] text-takal-ink">
            {w}
            {canEdit && <button type="button" aria-label={`Remove ${w}`} onClick={() => onChange(removeWord(phrases, w))}
              className="text-takal-ink-soft hover:text-takal-red">✕</button>}
          </span>
        ))}
        {canEdit && (typing === null ? (
          <button type="button" data-add-phrase onClick={() => setTyping("")}
            className="rounded-lg border border-dashed border-takal-ink-soft bg-white px-2 py-0.5 text-[13px] text-takal-ink-soft hover:text-takal-ink">
            + add phrase
          </button>
        ) : (
          <input autoFocus value={typing} maxLength={40} aria-label="New safe phrase"
            onChange={(e) => setTyping(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setTyping(null); }}
            onBlur={() => { if (!typing?.trim()) setTyping(null); }}
            className="w-40 rounded-lg border-[1.5px] border-takal-ink px-2 py-0.5 text-[13px] outline-none shadow-[0_0_0_3px_#FFFF00]" />
        ))}
      </div>
      {problem && <p className="mt-2 text-[12.5px] font-bold text-takal-red">{problem}</p>}
    </div>
  );
}

function IfYouSave({ preview, busy, changed }: { preview: LegalPreview | null; busy: boolean; changed: boolean }) {
  const rows = useMemo(() => [...(preview?.would_hide || []), ...(preview?.already_off || [])], [preview]);
  return (
    <aside data-if-you-save className="h-fit rounded-2xl border-2 border-black bg-[#FFFEE0] p-4 xl:sticky xl:top-4">
      <h3 className="text-[15px] font-extrabold text-takal-ink">
        {changed ? "If you save now" : "Today"} - checked against all {(preview?.checked ?? 0).toLocaleString("en-US")} products
        {busy && <span className="ml-1 text-[12px] font-semibold text-takal-ink-soft">(checking…)</span>}
      </h3>
      {!preview ? (
        <p className="mt-2 text-[13px] text-takal-ink-soft">Not worked out yet.</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-takal-ink">
            Hidden and locked: <b>{preview.would_hide.length}</b> · already Off: <b>{preview.already_off.length}</b>
            {preview.already_locked > 0 && <> · already locked: <b>{preview.already_locked}</b></>}
          </p>
          <div className="mt-2 divide-y divide-[#EFE7A8]">
            {rows.length === 0 && <p className="py-2 text-[13px] text-takal-ink-soft">Nothing would be hidden.</p>}
            {rows.slice(0, 60).map((h) => (
              <div key={h.id} data-would-hide className="flex items-center gap-2 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-base" aria-hidden>{h.icon}</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] text-takal-ink">{h.name}{h.is_available ? "" : " (Off)"}</b>
                  <span className="block truncate text-[12px] text-takal-ink-soft">{h.shop} · word: {h.word}</span>
                </div>
                <span className="whitespace-nowrap rounded-md bg-black px-1.5 py-0.5 text-[11px] font-bold text-takal-yellow">⚖️ {h.group_name.split(/[ ,&]/)[0]}</span>
              </div>
            ))}
            {rows.length > 60 && <p className="py-2 text-[12px] text-takal-ink-soft">…and {rows.length - 60} more.</p>}
          </div>
          {preview.skipped_safe_count > 0 && (
            <p className="mt-2 text-[12.5px] text-takal-ink-soft">
              Skipped as safe: {preview.skipped_safe.slice(0, 8).map((s) => s.name).join(", ")}
              {preview.skipped_safe_count > 8 ? ` and ${preview.skipped_safe_count - 8} more` : ""}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
