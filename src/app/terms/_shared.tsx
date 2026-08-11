// Shared layout for the three terms documents and the privacy policy.
//
// Customers, vendors and riders get SEPARATE terms rather than one combined
// document, on purpose: a rider does not need the refund rules, and a customer
// should not have to read about cash handover limits to find out when they can
// cancel. Each person reads only what applies to them.
//
// Everything in these documents was taken from how the system actually behaves
// — the 2-minute cancellation window, the Rs 10,000 cash limit, the delivery
// code, the 10 km Express range. If you change a rule in the code or in admin
// settings, change it here too, or the terms become a promise you are not
// keeping.
//
// ── ENGLISH AND URDU, BOTH BINDING ──────────────────────────────────────────
// Every document is published in both languages, and neither is named as the
// governing text: they carry equal weight. That is Sana's decision and it is
// the fairer one for Swat, where most vendors and riders read Urdu far more
// comfortably than English.
//
// It also raises the stakes on the translation. If a sentence says one thing in
// English and something different in Urdu, BOTH versions are binding and there
// is nothing in the documents that settles which wins. So the Urdu here is not
// decoration — it has to be as exact as the English, and it must be checked by
// a native speaker before anyone is held to it.
//
// The types below exist to enforce the half of that we can enforce in code:
// every piece of text is a { en, ur } PAIR, so it is impossible to add an
// English sentence and forget the Urdu. The build fails instead of quietly
// publishing a document that is complete in one language and full of holes in
// the other.

import React from "react";
import { Noto_Nastaliq_Urdu } from "next/font/google";

// Nastaliq is the script Urdu is actually read in; the plain Arabic naskh forms
// look wrong to an Urdu reader. Loaded through next/font so the files are
// served from our own domain — the Content-Security-Policy sets
// `font-src 'self' data:`, which (correctly) blocks fonts fetched from Google.
const urduFont = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  display: "swap",
});

export const LAST_UPDATED = "5 August 2026";
export const LAST_UPDATED_UR = "5 اگست 2026";
export const CONTACT_EMAIL = "sanamano2606@gmail.com";
export const BUSINESS_NAME = "Takal";
export const BUSINESS_NAME_UR = "ٹکل";
export const BUSINESS_LOCATION = "Swat, Khyber Pakhtunkhwa, Pakistan";
export const BUSINESS_LOCATION_UR = "سوات، خیبر پختونخوا، پاکستان";

/** One idea, written in both languages. Neither half is optional. */
export type Bi = { en: React.ReactNode; ur: React.ReactNode };

// Nastaliq sits on a deep baseline and its ascenders and descenders overlap
// badly at normal line height, so it needs noticeably more room than the Latin
// text beside it. `leading-loose` is not a style preference here — at tighter
// spacing the dots of one line collide with the strokes of the next and the
// text becomes genuinely hard to read.
const URDU_TEXT = "text-right leading-loose text-[16px]";

/**
 * One row of the document: English on the left, Urdu on the right.
 *
 * On a phone there is no room for two columns, so the pair stacks — English
 * first, then the same thing in Urdu directly beneath it, marked off by a rule
 * and a tint so it reads as a repeat rather than as the next point.
 */
function Row({ en, ur }: Bi) {
  return (
    <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
      <div>{en}</div>
      <div
        dir="rtl"
        lang="ur"
        className={`${urduFont.className} ${URDU_TEXT} border-t border-neutral-200 pt-2 md:border-t-0 md:pt-0`}
      >
        {ur}
      </div>
    </div>
  );
}

/** A paragraph, in both languages. */
export function P({ en, ur }: Bi) {
  return <Row en={<p>{en}</p>} ur={<p>{ur}</p>} />;
}

export function Section({
  title,
  children,
}: {
  title: Bi;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <Row
        en={<h2 className="text-lg font-bold text-neutral-900">{title.en}</h2>}
        ur={<h2 className="text-lg font-bold text-neutral-900">{title.ur}</h2>}
      />
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

/**
 * A bulleted list, paired line by line.
 *
 * Deliberately NOT two separate <ul>s side by side: with one English list in
 * the left column and one Urdu list in the right, the two drift out of step as
 * soon as any line wraps, and by the tenth bullet a reader is comparing point 7
 * against point 9. Pairing each bullet as its own row keeps every line opposite
 * its own translation however the text reflows.
 */
export function Bullets({ items }: { items: Bi[] }) {
  return (
    <div role="list" className="space-y-2">
      {items.map((item, i) => (
        <div role="listitem" key={i}>
          <Row
            en={
              <div className="flex gap-2">
                <span aria-hidden className="select-none text-neutral-400">
                  •
                </span>
                <span>{item.en}</span>
              </div>
            }
            ur={
              <div className="flex gap-2">
                <span aria-hidden className="select-none text-neutral-400">
                  •
                </span>
                <span>{item.ur}</span>
              </div>
            }
          />
        </div>
      ))}
    </div>
  );
}

/** The notice that both languages count. Shown at the top of every document. */
function BothLanguagesNotice() {
  return (
    <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <Row
        en={
          <p className="text-sm text-neutral-600">
            This document is published in English and Urdu. Both versions have
            equal standing.
          </p>
        }
        ur={
          <p className="text-sm text-neutral-600">
            یہ دستاویز انگریزی اور اردو دونوں زبانوں میں شائع کی گئی ہے۔ دونوں
            متن یکساں حیثیت رکھتے ہیں۔
          </p>
        }
      />
    </div>
  );
}

export function TermsShell({
  title,
  intro,
  children,
}: {
  title: Bi;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 md:py-14">
      <Row
        en={
          <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
            {title.en}
          </h1>
        }
        ur={
          <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
            {title.ur}
          </h1>
        }
      />
      <Row
        en={
          <p className="mt-1 text-sm text-neutral-500">
            Last updated: {LAST_UPDATED}
          </p>
        }
        ur={
          <p className="mt-1 text-sm text-neutral-500">
            آخری تبدیلی: {LAST_UPDATED_UR}
          </p>
        }
      />
      <BothLanguagesNotice />
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-neutral-700">
        {intro}
      </div>
      {children}
      <Section title={{ en: "Contact", ur: "رابطہ" }}>
        <Row
          en={
            <p>
              {BUSINESS_NAME}
              <br />
              {BUSINESS_LOCATION}
              <br />
              <a
                className="font-medium text-blue-700 underline"
                href={`mailto:${CONTACT_EMAIL}`}
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          }
          ur={
            <p>
              {BUSINESS_NAME_UR}
              <br />
              {BUSINESS_LOCATION_UR}
              <br />
              {/* The address stays in Latin script: an email address is typed,
                  not read, and transliterating it would make it undeliverable. */}
              <a
                className="font-medium text-blue-700 underline"
                href={`mailto:${CONTACT_EMAIL}`}
                dir="ltr"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          }
        />
      </Section>
      <div className="mt-10 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        <Row
          en={
            <p>
              See also our{" "}
              <a className="text-blue-700 underline" href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          }
          ur={
            <p>
              ہماری{" "}
              <a className="text-blue-700 underline" href="/privacy">
                پرائیویسی پالیسی
              </a>{" "}
              بھی ملاحظہ کریں۔
            </p>
          }
        />
      </div>
    </main>
  );
}
