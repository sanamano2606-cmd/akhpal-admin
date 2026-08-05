// Public privacy policy.
//
// Google Play REQUIRES a publicly reachable privacy policy URL before an app
// can be published. It must be readable without logging in, so this page sits
// outside /dashboard and outside /auth deliberately.
//
// It also has to MATCH the Data Safety form in Play Console. Google compares
// the two, and a policy claiming less collection than the form declares is a
// common cause of rejection. Everything listed below was taken from the actual
// code and database: the permissions in the built app bundle, the SDKs in
// pubspec.yaml, and the columns in the live schema.
//
// If you add an SDK, a permission, or a new column holding personal data,
// update this page and the Data Safety form together.

export const metadata = {
  title: "Privacy Policy — Takal",
  description:
    "How Takal collects, uses and protects your information across the Takal customer, vendor and rider apps.",
};

const UPDATED = "5 August 2026";

// Change these before publishing — Google may contact this address, and users
// need a real way to ask for their data to be deleted.
const CONTACT_EMAIL = "sanamano2606@gmail.com";
const BUSINESS_NAME = "Takal";
const BUSINESS_LOCATION = "Swat, Khyber Pakhtunkhwa, Pakistan";

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

function Row({ what, why }: { what: string; why: string }) {
  return (
    <tr className="border-b border-neutral-200 align-top">
      <td className="py-2 pr-4 font-medium text-neutral-900">{what}</td>
      <td className="py-2 text-neutral-700">{why}</td>
    </tr>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:py-14">
      <h1 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Last updated: {UPDATED}
      </p>

      <p className="mt-6 text-[15px] leading-relaxed text-neutral-700">
        This policy explains what {BUSINESS_NAME} collects, why, and what you can
        do about it. It covers all three of our apps — the customer app
        (Takal), the vendor app (Takal Vendors) and the rider app (Takal
        Riders) — and our website and admin systems.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-neutral-700">
        {BUSINESS_NAME} is a food and grocery delivery service operating in{" "}
        {BUSINESS_LOCATION}.
      </p>

      <Section title="Using Takal without an account">
        <p>
          You can browse shops and products in the customer app{" "}
          <strong>without creating an account</strong>. We ask for a delivery
          location so we can show you shops that can actually reach you, but you
          do not need to sign up until you place an order.
        </p>
      </Section>

      <Section title="What we collect, and why">
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-300 text-left">
              <th className="py-2 pr-4 font-semibold text-neutral-900">
                Information
              </th>
              <th className="py-2 font-semibold text-neutral-900">Why</th>
            </tr>
          </thead>
          <tbody>
            <Row
              what="Name and phone number"
              why="To create your account, verify your phone by code, and let the rider and shop reach you about your order."
            />
            <Row
              what="Email address (optional)"
              why="Account recovery and receipts. You can use Takal without one."
            />
            <Row
              what="Password"
              why="Stored only as an irreversible hash. We never store or see your actual password."
            />
            <Row
              what="Delivery address and map location"
              why="To work out whether a shop can deliver to you, calculate the delivery fee, and guide the rider to your door."
            />
            <Row
              what="Device location while the app is open"
              why="To find nearby shops and, for riders, to show the customer where their order is. We do not track location in the background."
            />
            <Row
              what="Order history"
              why="To show your past orders, handle refunds and complaints, and pay shops and riders correctly."
            />
            <Row
              what="Photos you upload"
              why="Profile pictures, shop logos, product photos and review photos."
            />
            <Row
              what="Notification token"
              why="To tell you when your order is accepted, picked up and delivered. Nothing else is sent to it."
            />
            <Row
              what="Riders: CNIC number, vehicle type and registration"
              why="Required to verify riders who handle your orders and your cash. Visible only to Takal staff, never to customers."
            />
            <Row
              what="Vendors: shop name, address, phone and location"
              why="Shown publicly in the app so customers can find and contact the shop."
            />
            <Row
              what="App usage and crash reports"
              why="To see which features are used and to fix crashes. Collected through Google Firebase."
            />
            <Row
              what="Advertising ID"
              why="Collected by Google Analytics for Firebase for app analytics only. We do NOT use it for advertising, and we do not show ads."
            />
          </tbody>
        </table>
      </Section>

      <Section title="Who can see your information">
        <p>When you place an order, we share only what is needed to deliver it:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>The shop</strong> sees your name, your order, and your
            delivery area.
          </li>
          <li>
            <strong>The rider</strong> sees your name, phone number and delivery
            address, so they can bring your order and call you if they cannot
            find it. They do not see your order history or your payment details.
          </li>
        </ul>
        <p>
          Riders and shops receive this only for orders they are actually
          handling, and only while the order is active.
        </p>
      </Section>

      <Section title="Companies that process data for us">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Supabase</strong> — stores our database and uploaded photos.
          </li>
          <li>
            <strong>Render</strong> — runs our server.
          </li>
          <li>
            <strong>Google Firebase</strong> — push notifications, crash reports
            and usage analytics.
          </li>
          <li>
            <strong>OpenStreetMap</strong> — supplies the map images shown in
            the app.
          </li>
        </ul>
        <p>
          These providers store data on servers outside Pakistan. They process
          it on our instructions only.
        </p>
      </Section>

      <Section title="What we do not do">
        <ul className="ml-5 list-disc space-y-1">
          <li>We do not sell your personal information to anyone.</li>
          <li>We do not show advertisements in our apps.</li>
          <li>
            We do not track your location when the app is closed or in the
            background.
          </li>
          <li>
            We do not store your card details. Orders are currently paid in cash
            on delivery.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p>
          Account and order information is kept while your account is open, and
          afterwards only where we must — for example, records of completed
          orders and payments that we are required to retain.
        </p>
        <p>
          Deleting your account removes your profile. Past orders are kept in a
          form that is no longer linked to your contact details, because shops
          and riders have already been paid for that work.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Location:</strong> you can refuse or withdraw the location
            permission in your phone&apos;s settings. You can still use Takal by
            typing an address instead.
          </li>
          <li>
            <strong>Notifications:</strong> you can turn these off in your
            phone&apos;s settings. Your orders will still work.
          </li>
          <li>
            <strong>Your data:</strong> you can ask us for a copy of what we hold
            about you, ask us to correct it, or ask us to delete your account.
          </li>
        </ul>
        <p>
          To request any of these, email{" "}
          <a
            className="font-medium text-blue-700 underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          . We will reply within 30 days.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Takal is not intended for children under 13, and we do not knowingly
          collect information from them. If you believe a child has created an
          account, contact us and we will remove it.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are stored only as irreversible hashes. Traffic between the
          apps and our server is encrypted. Access to customer data is limited to
          the Takal staff who need it, and every rider and shop sees only the
          orders they are handling.
        </p>
        <p>
          No system is perfectly secure. If a breach ever affects your
          information, we will tell you.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change how we handle your information, we will update this page
          and change the date at the top. Significant changes will be announced
          in the app.
        </p>
      </Section>

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
    </main>
  );
}
