// Shared layout for the three terms documents.
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

import React from "react";

export const LAST_UPDATED = "5 August 2026";
export const CONTACT_EMAIL = "sanamano2606@gmail.com";
export const BUSINESS_NAME = "Takal";
export const BUSINESS_LOCATION = "Swat, Khyber Pakhtunkhwa, Pakistan";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function TermsShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:py-14">
      <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Last updated: {LAST_UPDATED}
      </p>
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-neutral-700">
        {intro}
      </div>
      {children}
      <Section title="Contact">
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
      </Section>
      <p className="mt-10 border-t border-neutral-200 pt-4 text-sm text-neutral-500">
        See also our{" "}
        <a className="text-blue-700 underline" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}
