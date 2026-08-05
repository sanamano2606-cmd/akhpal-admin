import { TermsShell, Section, Bullets } from "../_shared";

export const metadata = {
  title: "Vendor Terms — Takal",
  description:
    "The terms that apply to shops and restaurants selling through Takal.",
};

export default function VendorTermsPage() {
  return (
    <TermsShell
      title="Vendor Terms"
      intro={
        <>
          <p>
            These terms apply to shops, restaurants and other businesses selling
            through Takal.
          </p>
          <p>
            Takal lists your products and delivers them. You remain the seller —
            you are responsible for what you sell, its quality and its safety.
          </p>
        </>
      }
    >
      <Section title="Joining">
        <Bullets
          items={[
            "Every shop is reviewed by Takal before it goes live. We may decline an application without giving a reason.",
            "Your business details must be true — name, address, phone and location. Customers rely on them.",
            "You must be entitled to sell what you list. Anything requiring a licence — for example a pharmacy — must hold that licence.",
          ]}
        />
      </Section>

      <Section title="Your listings">
        <Bullets
          items={[
            <>
              <strong>Photographs must be of your own products.</strong> Do not
              use pictures taken from the internet or from another shop. A
              customer who receives something unlike the picture blames Takal as
              well as you.
            </>,
            "Descriptions, weights and quantities must be accurate.",
            "The price you set is the price. You may not ask the customer for more at the door, or add charges that were not shown in the app.",
            "Keep stock up to date. Switch off anything you have run out of, so nobody orders it.",
          ]}
        />
      </Section>

      <Section title="Opening hours and accepting orders">
        <Bullets
          items={[
            "Set your real opening hours. Customers can only order between them, and a wrong setting costs you sales.",
            "Use the open/closed switch when you close unexpectedly, rather than letting orders arrive that you cannot fill.",
            "Accept or decline an order promptly. Leaving a customer waiting is worse than declining.",
            "Mark an order Ready only when it truly is. A rider sent too early waits, and everyone behind that order is delayed.",
          ]}
        />
      </Section>

      <Section title="If you cancel too often">
        <p>
          Accepting an order and then cancelling is the most damaging thing that
          can happen to a customer&apos;s experience — they have waited, and now
          they have nothing.
        </p>
        <Bullets
          items={[
            "We monitor how often each shop cancels after accepting, and how often orders are late to be marked ready.",
            "A shop that cancels repeatedly may be shown lower in the app, suspended, or removed.",
            "Cancelling because of a genuine problem is understood. Cancelling because you did not want the order is not.",
          ]}
        />
      </Section>

      <Section title="Money">
        <Bullets
          items={[
            "Takal takes a commission on each order. Your rate is shown in your app and does not change without notice.",
            "Customers see prices with our margin added. Your payout is based on your own price, less commission.",
            "Payouts run on a regular cycle. You can see every order and the exact amount owed in your app.",
            "Delivery fees and rider pay are handled by Takal and are not taken from your payout.",
          ]}
        />
      </Section>

      <Section title="Customers and riders">
        <Bullets
          items={[
            "Hand orders to riders promptly and packed properly. Hot food should be sealed.",
            "Treat riders and customers with respect. Abuse is grounds for removal.",
            "You receive a customer's name and delivery area only to fulfil their order. Do not use it for your own marketing, and do not pass it to anyone else.",
            "Do not contact customers to sell to them outside Takal.",
          ]}
        />
      </Section>

      <Section title="Food safety and quality">
        <Bullets
          items={[
            "You are responsible for the safety, hygiene and legality of everything you sell.",
            "Follow the rules that apply to your trade, including any licences and inspections.",
            "If a customer reports illness or a serious quality problem, we will contact you and may suspend your listing while it is looked into.",
          ]}
        />
      </Section>

      <Section title="Suspension and removal">
        <p>We may suspend or remove a shop that:</p>
        <Bullets
          items={[
            "sells something different from what was listed,",
            "uses photographs that are not of its own products,",
            "asks customers for money beyond the app price,",
            "cancels accepted orders repeatedly,",
            "mistreats customers or riders, or",
            "breaks the law.",
          ]}
        />
        <p>
          Money already earned on completed orders is still paid to you. We will
          tell you why a suspension has happened and what would resolve it.
        </p>
      </Section>

      <Section title="Ending the arrangement">
        <p>
          You may leave Takal at any time. Please complete any orders you have
          already accepted first. We will pay everything owed on the next payout
          cycle.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change these terms we will update this page and the date at the
          top, and tell you in the vendor app if the change is significant.
        </p>
      </Section>
    </TermsShell>
  );
}
