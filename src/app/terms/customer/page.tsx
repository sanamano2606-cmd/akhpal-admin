import { TermsShell, Section, Bullets } from "../_shared";

export const metadata = {
  title: "Customer Terms — Takal",
  description: "The terms that apply when you order through the Takal app.",
};

export default function CustomerTermsPage() {
  return (
    <TermsShell
      title="Customer Terms"
      intro={
        <>
          <p>
            These terms apply when you order through the Takal app. Please read
            them — they explain what we promise you, and what we ask from you.
          </p>
          <p>
            Takal is a delivery service. We connect you with shops and
            restaurants in Swat and bring their goods to your door. We do not
            cook the food or make the products ourselves.
          </p>
        </>
      }
    >
      <Section title="Your account">
        <Bullets
          items={[
            "You can browse without an account. You need one to place an order.",
            "You must give a real phone number. We verify it with a code.",
            "One account per person. Do not create extra accounts to claim referral rewards more than once.",
            "Keep your password to yourself. Orders placed from your account are treated as yours.",
            "You must be at least 13 years old to use Takal.",
          ]}
        />
      </Section>

      <Section title="Placing an order">
        <Bullets
          items={[
            <>
              <strong>Express delivery</strong> (food, groceries, pharmacy) is
              brought by a rider, usually in 15–45 minutes, from shops within
              about 10 km of your address.
            </>,
            <>
              <strong>Standard delivery</strong> (other shops) is shipped by the
              vendor and normally takes 1–3 days.
            </>,
            "Some shops set a minimum order value. You will see it before you pay.",
            "Prices in the app include our service margin. What you see is what you pay.",
            "A shop can refuse an order — for example if an item has just run out. You are not charged for a refused order.",
          ]}
        />
      </Section>

      <Section title="Cancelling">
        <Bullets
          items={[
            <>
              You can cancel within <strong>2 minutes</strong> of placing an
              immediate order. After that the shop has usually started preparing
              it.
            </>,
            <>
              A <strong>scheduled</strong> order can be cancelled any time until
              the shop starts preparing it.
            </>,
            "Once a shop has started preparing your order, it can no longer be cancelled in the app. Contact us if something has gone wrong.",
          ]}
        />
      </Section>

      <Section title="Paying and the delivery code">
        <Bullets
          items={[
            "Orders are currently paid in cash when the rider arrives. Please have the right amount ready.",
            <>
              Your app shows a <strong>4-digit delivery code</strong>. Give it to
              the rider when you receive your order. This is what proves the
              delivery happened.
            </>,
            <>
              <strong>Do not share the code before you have your order.</strong>{" "}
              Once the rider enters it, the order is recorded as delivered and
              paid.
            </>,
          ]}
        />
      </Section>

      <Section title="Accepting your order">
        <p>
          When you place a cash order, a shop prepares real goods and a rider
          travels to you. Refusing to accept an order costs both of them.
        </p>
        <Bullets
          items={[
            "Please be reachable on the phone number you gave us while your order is on the way.",
            "If you refuse delivery repeatedly without a good reason, we may require payment in advance on future orders, or close your account.",
            "If your order is wrong, damaged, or never arrives, tell us — that is not a refusal and will not count against you.",
          ]}
        />
      </Section>

      <Section title="Problems with an order">
        <Bullets
          items={[
            "Tell us as soon as you can, ideally the same day, and keep the items if you can.",
            "For a missing or wrong item, we will arrange a refund or a replacement with the shop.",
            "Photographs help. You can attach them to a review or send them to us.",
          ]}
        />
      </Section>

      <Section title="Reviews">
        <Bullets
          items={[
            "You can only review a shop, product or rider from an order you actually received. This keeps reviews honest.",
            "Write about your real experience. Do not post abuse, or anything untrue about a shop or a rider.",
            "We may remove reviews that break these rules.",
          ]}
        />
      </Section>

      <Section title="What we are responsible for">
        <p>
          We are responsible for delivering your order and handling it with care.
          The shop is responsible for the quality, safety and description of what
          it sells.
        </p>
        <p>
          If something goes wrong with an order, our responsibility is limited to
          putting that order right — a refund, a replacement, or a credit. We are
          not liable for indirect losses, such as time lost waiting.
        </p>
        <p>
          Nothing here removes rights you have under Pakistani consumer law.
        </p>
      </Section>

      <Section title="Closing your account">
        <p>
          You can ask us to close your account at any time. We may suspend an
          account that repeatedly breaks these terms — for example fake orders,
          abuse of riders or shop staff, or repeated refused deliveries.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change these terms we will update this page and the date at the
          top, and tell you in the app if the change is significant.
        </p>
      </Section>
    </TermsShell>
  );
}
