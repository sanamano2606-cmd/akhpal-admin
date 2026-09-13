// Public support page.
//
// WHY THIS PAGE EXISTS
// Apple REQUIRES a "Support URL" on every App Store product page, and the
// address must lead somewhere a person can actually get help. Google Play
// shows the same link. Until this page existed there was nothing to give
// them: the site had /privacy and /terms and nothing else, and a privacy
// policy is not support.
//
// It sits outside /dashboard and outside /auth deliberately, exactly like
// /privacy and /terms, so it is readable without logging in.
//
// THE CONTACT DETAILS ARE NOT WRITTEN HERE.
// They come from src/lib/contact.ts, the one place they are written down.
// That file's rule is followed to the letter: CONTACT_PHONE is deliberately
// empty until Sana gives a real number, and a blank stays blank. A phone
// line that is not there is better than one nobody answers - somebody rings
// a placeholder, gets nothing, and stops trusting the page.
//
// If the support email or phone ever changes, change contact.ts. Nothing on
// this page needs touching.

import { CONTACT_EMAIL, CONTACT_PHONE, BUSINESS_NAME, BUSINESS_LOCATION } from "@/lib/contact";

export const metadata = {
  title: "Support — Takal",
  description:
    "How to get help with the Takal customer, rider and vendor apps: contact details, common questions, and how to ask for your data to be deleted.",
};

function Section({
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

function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-neutral-900">{q}</h3>
      <div className="mt-1 space-y-2 text-[15px] leading-relaxed text-neutral-700">
        {children}
      </div>
    </div>
  );
}

export default function SupportPage() {
  // WHY THE PHONE NUMBER IS COPIED INTO A PLAIN STRING FIRST.
  //
  // contact.ts sets CONTACT_PHONE to "" on purpose, until Sana gives a real
  // number. TypeScript reads that as the exact value "" and nothing else, so
  // inside `CONTACT_PHONE ? ... : ...` it decides the true branch can never
  // happen and gives the value the type `never` - and `never` has no
  // .replace(). The Vercel build stopped on exactly that on 13 September 2026.
  //
  // Saying "this is a string" restores the ordinary meaning: today it is
  // empty and the line is left out; the day a number is typed into
  // contact.ts, the line appears. No change is needed here either way.
  const phone: string = CONTACT_PHONE;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:py-14">
      <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
        Support
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
        Help for the Takal customer app, Takal Riders and Takal Vendors. If your
        question is not answered below, write to us and a person will reply.
      </p>

      <Section title="Contact us">
        <p>
          <a
            className="font-medium text-blue-700 underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        {/* The phone line appears only once a real number is set in
            src/lib/contact.ts. See the note at the top of this file. */}
        {phone ? (
          <p>
            <a
              className="font-medium text-blue-700 underline"
              href={`tel:${phone.replace(/\s+/g, "")}`}
            >
              {phone}
            </a>
          </p>
        ) : null}
        <p>
          We answer emails within two working days. Please tell us which app you
          are using, the phone number on your account, and the order number if
          your question is about an order.
        </p>
      </Section>

      <Section title="Common questions">
        <div className="space-y-5">
          <Question q="How do I place an order?">
            <p>
              Open the Takal app, choose a shop, add items to your cart and tap
              to order. You will see the delivery fee and the total before you
              confirm.
            </p>
          </Question>

          <Question q="Where is my order?">
            <p>
              The Takal app shows each stage of your order — accepted, being
              prepared, picked up, and delivered. If it has been much longer
              than the time shown, email us with your order number.
            </p>
          </Question>

          <Question q="Can I cancel an order?">
            <p>
              You can cancel from the order screen while the shop has not yet
              started preparing your food. After that, email us and we will look
              at it case by case.
            </p>
          </Question>

          <Question q="Something was wrong with my order.">
            <p>
              Email us on the same day with your order number and, if you can, a
              photo. We will put it right.
            </p>
          </Question>

          <Question q="I did not get the code to sign in.">
            <p>
              Check that the phone number you typed is the one you use, wait a
              minute, then ask for the code again. If it still does not arrive,
              email us the number and we will check it from our side.
            </p>
          </Question>

          <Question q="I want to become a rider or list my shop.">
            <p>
              Email us and say which one. Riders and shops are approved by Takal
              before they can take orders, and we will tell you what is needed.
            </p>
          </Question>

          <Question q="I want my account and my data deleted.">
            <p>
              Email us from the address on your account, or include the phone
              number you sign in with, and ask for deletion. We remove your
              personal information and confirm when it is done. Records we are
              required to keep for tax or fraud reasons are explained in the{" "}
              <a className="font-medium text-blue-700 underline" href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          </Question>
        </div>
      </Section>

      <Section title="Our documents">
        <p>
          <a className="font-medium text-blue-700 underline" href="/privacy">
            Privacy Policy
          </a>
          <br />
          <a
            className="font-medium text-blue-700 underline"
            href="/terms/customer"
          >
            Terms for customers
          </a>
          <br />
          <a className="font-medium text-blue-700 underline" href="/terms/rider">
            Terms for riders
          </a>
          <br />
          <a
            className="font-medium text-blue-700 underline"
            href="/terms/vendor"
          >
            Terms for shops
          </a>
        </p>
      </Section>

      <Section title="Who we are">
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
    </main>
  );
}
