"use client";

/**
 * THE LETTERHEAD — write a letter, print it.
 *
 * Approved by Sana as Mock 7 on 4 September 2026:
 *   "Add setting in admin panel from where i can change the Email and contact
 *    number any time and can edit the Letter head if possible?"
 *   "editable and printable but in the Admin panel. Can it be?"
 *
 * WHY THE PAGE IS BUILT FRESH AND NOT SAVED AS A PICTURE
 * A letterhead saved as an image goes stale the day a detail changes, and then
 * letters go out with an old phone number on them for months, because nobody
 * remembers where the picture lives. The top and bottom of this page are drawn
 * from Settings every single time it is printed. Change the number in Settings
 * and the very next letter carries the new one.
 *
 * WHAT SANA CAN TYPE, AND WHAT SHE CANNOT
 * She types the date, who it is to, the subject, the letter and the signature.
 * She cannot type the letterhead itself - that is the point of a letterhead.
 *
 * PRINTING USES THE BROWSER'S OWN PRINT
 * No library, no server, nothing to install and nothing to pay for. The print
 * rules below hide the whole panel and leave one A4 page. The same box has a
 * "Save as PDF" choice, which is how a file is made.
 *
 * DESIGN: "B - Clean", chosen by Sana on 4 September 2026 out of three.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, Button, PRINT } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api-errors";

/**
 * The logo comes from the server, not from a file kept beside this page.
 * `/admin/logo.png` is the same picture the rest of the system uses, so the
 * letter can never end up carrying an older logo than the apps do.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";
const LOGO_URL = `${API_BASE}/admin/logo.png`;

type Head = {
  name: string;
  tagline: string;
  office1: string;
  office2: string;
  region: string;
  phone: string;
  email: string;
};

const EMPTY_HEAD: Head = {
  name: "", tagline: "", office1: "", office2: "", region: "", phone: "", email: "",
};

/** Today, written the way a letter writes it: 4 September 2026. */
function today(): string {
  const d = new Date();
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "long" })} ${d.getFullYear()}`;
}

export default function LetterheadPage() {
  const [head, setHead] = useState<Head>(EMPTY_HEAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [date, setDate] = useState(today());
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const s = (await apiClient.getSettings()) as any;
        setHead({
          name: s?.business_name ?? "",
          tagline: s?.business_tagline ?? "",
          office1: s?.business_office_1 ?? "",
          office2: s?.business_office_2 ?? "",
          region: s?.business_region ?? "",
          phone: s?.support_phone ?? "",
          email: s?.support_email ?? "",
        });
      } catch (err) {
        setError(errorMessage(err, "the business details"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Is there enough saved to print a letterhead at all?
   * A page with no name and no address on it is not a letterhead, and printing
   * one would waste paper and look worse than plain paper.
   */
  const headIsEmpty = useMemo(
    () => !head.name.trim() && !head.office1.trim() && !head.phone.trim(),
    [head]
  );

  /** Paragraphs, so a blank line in the box becomes a blank line on paper. */
  const paragraphs = useMemo(
    () => body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [body]
  );

  const print = (asPdf: boolean) => {
    if (asPdf) {
      toast('In the box that opens, choose "Save as PDF" instead of a printer.', "success");
    }
    // Let the toast paint before the print box freezes the page.
    setTimeout(() => window.print(), asPdf ? 400 : 0);
  };

  return (
    <div className="space-y-6">
      {/* PRINT RULES.
          Everything on the screen is hidden and the single A4 sheet is shown
          at its real size. `visibility` is used rather than `display` on
          purpose: hiding with `display` collapses the sheet's own parents and
          the page comes out blank. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #letterhead-sheet, #letterhead-sheet * { visibility: visible !important; }
          #letterhead-sheet {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            transform: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
          }
          #letterhead-scaler { transform: none !important; height: auto !important; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-takal-ink">Letterhead</h2>
          <p className="mt-1 text-takal-ink-soft">
            Write a letter and print it. The top and bottom fill in on their own.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => print(true)} disabled={loading || headIsEmpty}>
            Save as PDF
          </Button>
          <Button onClick={() => print(false)} disabled={loading || headIsEmpty}>
            Print
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-takal-red-soft px-4 py-3 text-sm text-takal-red print:hidden">
          {error}
        </p>
      ) : null}

      {!loading && headIsEmpty ? (
        <div className="rounded-r-lg border-l-4 border-takal-orange bg-takal-orange-soft px-4 py-3 text-sm leading-relaxed text-[#C8410F] print:hidden">
          <b>Nothing is filled in yet.</b> A letter with no name and no address
          on it is not a letterhead. Put the business name, an office and a
          phone number into{" "}
          <a href="/dashboard/settings" className="underline underline-offset-2">
            Settings → General
          </a>{" "}
          first. Printing is switched off until then.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
        {/* ── What Sana types ───────────────────────────────────────────── */}
        <Card className="print:hidden">
          <CardHeader
            title="Your letter"
            hint="Only this part is yours to write. The letterhead itself is locked."
          />
          <CardBody className="space-y-4">
            <Field label="Date">
              <input className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="To">
              <input
                className={INPUT}
                value={to}
                placeholder="Manager, Bank Alfalah — Mingora Branch"
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <Field label="Subject">
              <input
                className={INPUT}
                value={subject}
                placeholder="Request to open a business account"
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
            <Field label="Letter">
              <textarea
                className={`${INPUT} min-h-[220px] leading-relaxed`}
                value={body}
                placeholder={"Respected Sir,\n\nLeave a blank line between paragraphs."}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Signed by">
                <input
                  className={INPUT}
                  value={signedBy}
                  placeholder="Sana Ullah"
                  onChange={(e) => setSignedBy(e.target.value)}
                />
              </Field>
              <Field label="Title">
                <input
                  className={INPUT}
                  value={title}
                  placeholder="Owner, Takal"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-r-lg border-l-4 border-takal-yellow bg-takal-yellow-wash px-4 py-3 text-sm leading-relaxed text-takal-ink">
              <b>The top and bottom of the page are locked.</b> The logo, name,
              offices, phone and email come from{" "}
              <a href="/dashboard/settings" className="underline underline-offset-2">
                Settings → General
              </a>
              , so a letter can never go out with an old phone number on it.
              <br />
              <br />
              <b>Tip:</b> print with the boxes empty to get blank letterhead
              paper for writing on by hand.
            </div>
          </CardBody>
        </Card>

        {/* ── What prints ───────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-sm font-bold text-takal-ink print:hidden">
            Exactly what prints · A4
          </p>
          {/* Shrunk to fit the screen. The print rules above take the shrink
              off again, so paper gets the full size. */}
          <div
            id="letterhead-scaler"
            style={{ width: "148.5mm", height: "210mm" }}
            className="print:h-auto print:w-auto"
          >
            <div
              id="letterhead-sheet"
              style={{
                width: "210mm",
                height: "297mm",
                transform: "scale(0.7071)",
                transformOrigin: "top left",
              }}
              className="relative overflow-hidden border border-takal-line bg-white shadow-lg"
            >
              {/* ── the head ── */}
              <div className="absolute left-[18mm] top-[16mm] flex items-center gap-[4mm]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_URL} alt="" className="h-[16mm] w-[16mm] object-contain" />
                <div>
                  {head.name ? (
                    <div className="text-[26pt] font-black leading-none text-black">
                      {head.name}
                    </div>
                  ) : null}
                  {head.tagline ? (
                    <div className="mt-[1mm] text-[7pt] font-bold uppercase tracking-[0.14em] text-[#4A4A4A]">
                      {head.tagline}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="absolute right-[18mm] top-[17mm] text-right text-[8pt] leading-[1.7] text-black">
                {head.office1 ? <div>{head.office1}</div> : null}
                {head.office2 ? <div>{head.office2}</div> : null}
                {head.phone ? <div className="text-[#4A4A4A]">{head.phone}</div> : null}
                {head.email ? <div className="text-[#4A4A4A]">{head.email}</div> : null}
              </div>

              {/* The two rules — yellow across, red for the first third.
                  Yellow is the brand's main colour, #FFFF00, which never
                  changes. The red is PRINT.takalRed, measured from the red
                  inside the Takal logo so paper and logo match. It is
                  decoration only. It is NOT the danger red ACCENT.red, and
                  a test in tests/theme.test.ts goes red if the two are ever
                  swapped or if either drifts from the Brand Kit.
                  Source of truth: Takal_Brand_Kit/TAKAL_STYLE_GUIDE.md */}
              <div className="absolute left-[18mm] right-[18mm] top-[36mm] h-[1.6mm] bg-[#FFFF00]" />
              <div
                className="absolute left-[18mm] top-[36mm] h-[1.6mm] w-[30mm]"
                style={{ background: PRINT.takalRed }}
              />

              {/* ── the letter ── */}
              <div className="absolute left-[18mm] right-[18mm] top-[48mm] text-left text-[10.5pt] leading-[1.75] text-black">
                {date ? <div className="text-[#8a8a8a]">{date}</div> : null}
                {to ? <div className="mt-[3mm] font-bold">To: {to}</div> : null}
                {subject ? <div className="mt-[1mm] font-bold">Subject: {subject}</div> : null}
                <div className="mt-[4mm] space-y-[3mm]">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
                {signedBy || title ? (
                  <div className="mt-[10mm]">
                    <p>Yours sincerely,</p>
                    <p className="mt-[14mm] font-bold">{signedBy}</p>
                    {title ? <p className="text-[#8a8a8a]">{title}</p> : null}
                  </div>
                ) : null}
              </div>

              {/* ── the foot ── */}
              <div className="absolute bottom-[14mm] left-[18mm] right-[18mm]">
                <div className="h-px bg-[#E5E5E5]" />
                {head.region ? (
                  <div className="mt-[2.5mm] text-center text-[7pt] uppercase tracking-[0.05em] text-[#4A4A4A]">
                    {head.name ? `${head.name} · ` : ""}
                    {head.region}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border-2 border-takal-line px-3 py-2 text-sm outline-none focus:border-takal-yellow disabled:bg-takal-page";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-takal-ink">{label}</label>
      {children}
    </div>
  );
}
