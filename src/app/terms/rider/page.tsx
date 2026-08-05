import { TermsShell, Section, Bullets } from "../_shared";

export const metadata = {
  title: "Rider Terms — Takal",
  description: "The terms that apply to riders delivering for Takal.",
};

export default function RiderTermsPage() {
  return (
    <TermsShell
      title="Rider Terms"
      intro={
        <>
          <p>
            These terms apply when you deliver orders for Takal. The most
            important parts are about the money you carry and the delivery code —
            please read those two sections carefully.
          </p>
        </>
      }
    >
      <Section title="Joining">
        <Bullets
          items={[
            "Every rider is checked by Takal before being approved. We may decline an application without giving a reason.",
            "Your CNIC, phone number and vehicle details must be your own and correct. We keep them to verify you and never show them to customers.",
            "You must have a valid licence for the vehicle you ride, and follow the road laws.",
            "You may not let anyone else use your account or deliver in your place.",
          ]}
        />
      </Section>

      <Section title="The cash you carry">
        <p>
          Most orders are paid in cash. That money belongs to Takal from the
          moment the customer hands it to you.
        </p>
        <Bullets
          items={[
            <>
              Deposit the cash you are holding{" "}
              <strong>within 2 days</strong>, and before it reaches{" "}
              <strong>Rs 10,000</strong>.
            </>,
            <>
              If you go past either limit, the app{" "}
              <strong>stops giving you new orders</strong> until you hand the
              money in. Orders you have already accepted are not affected — you
              must still deliver those.
            </>,
            "The block lifts by itself as soon as your handover is recorded. You do not need to wait for anyone.",
            "Your wallet in the app always shows what you are holding and what you are owed. Check it if a figure looks wrong, and tell us straight away.",
            "Failing to hand over cash is theft and will be treated as such.",
          ]}
        />
      </Section>

      <Section title="The delivery code">
        <p>
          The customer has a 4-digit code in their app. You must ask for it and
          enter it to complete a delivery.
        </p>
        <Bullets
          items={[
            <>
              <strong>Never mark an order delivered before you have handed it
              over.</strong> The code exists so that a completed order means a
              real delivery.
            </>,
            "You cannot see the code anywhere in your own app. That is deliberate — you get it from the customer, in person.",
            "If a customer genuinely cannot give you the code — a flat battery, a lost phone — call us. An admin can complete it, and every such case is recorded.",
            "Marking deliveries complete without delivering will end your account and be reported.",
          ]}
        />
      </Section>

      <Section title="Doing the work">
        <Bullets
          items={[
            "Accept an order only if you can actually do it. Accepting and then abandoning leaves a customer with cold food and no explanation.",
            "Do not open, taste or take any part of an order.",
            "Keep food upright and sealed. Deliver it in the condition you collected it.",
            "Be polite to customers and to shop staff, even when they are not.",
            "Go offline when you finish for the day, so orders are not offered to you.",
          ]}
        />
      </Section>

      <Section title="Your pay">
        <Bullets
          items={[
            "You are paid per delivery. The amount is shown before you accept an order.",
            "What you earn is separate from what the customer pays for delivery. A free-delivery promotion does not reduce your pay.",
            "Earnings are settled on a regular cycle. Your wallet shows every delivery and every amount.",
            "If you owe Takal cash, that is settled against what you are owed, and your wallet shows the net figure.",
          ]}
        />
      </Section>

      <Section title="Customer information">
        <Bullets
          items={[
            "You receive a customer's name, phone number and address only for the order you are delivering.",
            "Use it for that delivery and nothing else. Do not save it, share it, or contact a customer afterwards.",
            "Misusing customer information will end your account.",
          ]}
        />
      </Section>

      <Section title="Your safety">
        <Bullets
          items={[
            "Never ride in a way that puts you or anyone else at risk. No order is worth an accident.",
            "Wear a helmet.",
            "If you feel unsafe at a delivery, leave and tell us. You will not be penalised.",
            "You are responsible for your own vehicle, its papers and its insurance.",
          ]}
        />
      </Section>

      <Section title="Suspension and removal">
        <p>We may suspend or remove a rider who:</p>
        <Bullets
          items={[
            "marks an order delivered without delivering it,",
            "does not hand over cash on time,",
            "takes or tampers with an order,",
            "mistreats a customer or shop,",
            "lets someone else use their account, or",
            "rides dangerously or illegally.",
          ]}
        />
        <p>
          Pay you have already earned is still yours, less any cash you are
          holding.
        </p>
      </Section>

      <Section title="Ending the arrangement">
        <p>
          You may stop riding for Takal at any time. Please complete any orders
          you have accepted and hand over any cash you are holding first. We will
          settle what is owed on the next cycle.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we change these terms we will update this page and the date at the
          top, and tell you in the rider app if the change is significant.
        </p>
      </Section>
    </TermsShell>
  );
}
