"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 225 - THE SMALL FORM INSIDE "CHOOSE A SHELF" (approved by Sana,
// 2 Nov 2026: "Approved" + "Add Group Button Too under Group").
//
// One form for the three buttons:
//   + Add shelf       - a shelf's name (+ Urdu name), the Rx tick inside
//                        Health & Pharmacy;
//   + Add group       - the group's name and ITS FIRST SHELF;
//   + Add department  - the department's name and ITS FIRST SHELF.
// A product goes on a shelf, so a new group or department always comes with
// one. Nothing is saved until the yellow button; the window (CategoryPicker)
// does the saving and tells the form if the server said no.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { cleanName, nameProblem, nameTaken, similarName, type AddKind, MAX_NAME } from "@/lib/shelf-add";

export interface ShelfAddValues { name: string; nameUr: string; first: string; rx: boolean }

const TITLE: Record<AddKind, string> = { shelf: "New shelf", group: "New group", department: "New department" };
const BUTTON: Record<AddKind, string> = { shelf: "Add shelf", group: "Add group", department: "Add department" };

export function ShelfAddForm({ kind, where, rxOffered, siblings, shelfNames, onCancel, onSave }: {
  kind: AddKind;
  /** "Health & Pharmacy › Medicines" - where the new row goes. */
  where: string;
  rxOffered: boolean;
  /** The names already at that level (a second "Herbal" is refused). */
  siblings: string[];
  /** Every shelf name - for "a shelf with a similar name already exists". */
  shelfNames: string[];
  onCancel: () => void;
  /** Saves; resolves to an error sentence, or "" when it worked. */
  onSave: (v: ShelfAddValues) => Promise<string>;
}) {
  const [name, setName] = useState("");
  const [nameUr, setNameUr] = useState("");
  const [first, setFirst] = useState("");
  const [rx, setRx] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const what = kind === "shelf" ? "shelf name" : kind === "group" ? "group name" : "department name";
  const needsFirst = kind !== "shelf";
  const problem = nameProblem(name, what)
    || (nameTaken(siblings, name) ? `“${cleanName(name)}” is already here.` : "")
    || (needsFirst ? nameProblem(first, "first shelf's name") : "");
  const like = similarName(shelfNames, needsFirst ? first : name);

  const go = async () => {
    if (problem || busy) return;
    setBusy(true);
    setSaid("");
    const err = await onSave({ name: cleanName(name), nameUr: nameUr.trim(), first: cleanName(first), rx });
    setBusy(false);
    if (err) setSaid(err);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); go(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };
  const box = "w-full rounded-lg border-[1.5px] border-takal-ink bg-white px-2.5 py-1.5 text-[14px] outline-none focus:shadow-[0_0_0_3px_#FFFF00]";

  return (
    <div data-shelf-add={kind} onKeyDown={keys}
      className="col-span-full rounded-xl border-2 border-takal-ink bg-white p-3 shadow-[0_0_0_4px_#FFFF00]">
      <p className="text-[14px] font-black">+ {TITLE[kind]}{kind === "department" ? "" : ` in ${where}`}</p>
      <p className="mb-2 text-[12px] text-takal-ink-soft">
        {needsFirst ? "A product goes on a shelf, so it starts with its first shelf. " : "It appears here at once. "}
        Customers see it only when a product is on it.
      </p>
      <div className={kind === "shelf" ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
        <label className="block">
          <span className="text-[11.5px] font-bold text-takal-ink">{kind === "shelf" ? "Shelf name" : kind === "group" ? "Group name" : "Department name"}</span>
          <input autoFocus value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} className={box}
            aria-label={what} />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-bold text-takal-ink">Urdu name (optional)</span>
          <input dir="rtl" lang="ur" value={nameUr} maxLength={MAX_NAME} onChange={(e) => setNameUr(e.target.value)}
            placeholder="اردو نام" aria-label="Urdu name" className={`${box} font-urdu text-right`}
            style={{ fontFamily: "'Noto Naskh Arabic', serif" }} />
        </label>
        {needsFirst && (
          <label className="block">
            <span className="text-[11.5px] font-bold text-takal-ink">Its first shelf</span>
            <input value={first} maxLength={MAX_NAME} onChange={(e) => setFirst(e.target.value)} className={box}
              aria-label="Its first shelf" />
          </label>
        )}
      </div>
      {(rxOffered || kind === "department") && (
        <label className="mt-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={rx} onChange={(e) => setRx(e.target.checked)} className="h-4 w-4 accent-black" />
          Needs a prescription (Rx){rxOffered ? " - off for Herbal, Unani and Homeopathic" : ""}
        </label>
      )}
      {like && !problem && (
        <p data-similar className="mt-2 rounded-lg bg-takal-blue-soft px-2.5 py-1.5 text-[12.5px] text-takal-blue">
          ℹ️ A shelf with a similar name already exists: <b>{like}</b>. You can still add this one.
        </p>
      )}
      {(said || (problem && (name || first))) && (
        <p className="mt-2 text-[12.5px] font-bold text-takal-red">{said || problem}</p>
      )}
      <div className="mt-2.5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy}
          className="rounded-[9px] border-[1.5px] border-takal-ink bg-white px-3.5 py-1.5 text-[13px] font-bold">Cancel</button>
        <button type="button" data-shelf-add-go onClick={go} disabled={busy || !!problem}
          className="rounded-[9px] border-[1.5px] border-takal-ink bg-takal-yellow px-3.5 py-1.5 text-[13px] font-bold text-black disabled:opacity-50">
          {busy ? "Adding…" : BUTTON[kind]}
        </button>
      </div>
    </div>
  );
}
