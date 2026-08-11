import { TermsShell, Section, Bullets, P } from "../_shared";

export const metadata = {
  title: "Vendor Terms — Takal",
  description:
    "The terms that apply to shops and restaurants selling through Takal.",
};

export default function VendorTermsPage() {
  return (
    <TermsShell
      title={{ en: "Vendor Terms", ur: "دکاندار کی شرائط" }}
      intro={
        <>
          <P
            en={
              <>
                These terms apply to shops, restaurants and other businesses
                selling through Takal.
              </>
            }
            ur={
              <>
                یہ شرائط اُن دکانوں، ریسٹورنٹس اور دیگر کاروباروں پر لاگو ہوتی
                ہیں جو ٹکل کے ذریعے فروخت کرتے ہیں۔
              </>
            }
          />
          <P
            en={
              <>
                Takal lists your products and delivers them. You remain the seller
                — you are responsible for what you sell, its quality and its
                safety.
              </>
            }
            ur={
              <>
                ٹکل آپ کی مصنوعات کی فہرست بناتا ہے اور انہیں پہنچاتا ہے۔ بیچنے
                والے آپ ہی رہتے ہیں — جو چیز آپ بیچتے ہیں، اُس کے، اُس کے معیار
                کے اور اُس کی حفاظت کے ذمہ دار آپ ہیں۔
              </>
            }
          />
        </>
      }
    >
      <Section title={{ en: "Joining", ur: "شمولیت" }}>
        <Bullets
          items={[
            {
              en: "Every shop is reviewed by Takal before it goes live. We may decline an application without giving a reason.",
              ur: "ہر دکان کو ایپ پر آنے سے پہلے ٹکل جانچتا ہے۔ ہم کوئی وجہ بتائے بغیر درخواست مسترد کر سکتے ہیں۔",
            },
            {
              en: "Your business details must be true — name, address, phone and location. Customers rely on them.",
              ur: "آپ کے کاروبار کی تفصیلات درست ہونی چاہئیں — نام، پتہ، فون اور مقام۔ گاہک انہی پر بھروسہ کرتے ہیں۔",
            },
            {
              en: "You must be entitled to sell what you list. Anything requiring a licence — for example a pharmacy — must hold that licence.",
              ur: "جو چیز آپ فہرست میں ڈالتے ہیں، اسے بیچنے کا حق آپ کے پاس ہونا چاہیے۔ جس کام کے لیے لائسنس درکار ہو — مثلاً میڈیکل اسٹور — اُس کے پاس وہ لائسنس ہونا لازمی ہے۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Your listings", ur: "آپ کی فہرست" }}>
        <Bullets
          items={[
            {
              en: (
                <>
                  <strong>Photographs must be of your own products.</strong> Do
                  not use pictures taken from the internet or from another shop. A
                  customer who receives something unlike the picture blames Takal
                  as well as you.
                </>
              ),
              ur: (
                <>
                  <strong>تصویریں آپ کی اپنی مصنوعات کی ہونی چاہئیں۔</strong>{" "}
                  انٹرنیٹ سے یا کسی اور دکان سے لی گئی تصویریں استعمال نہ کریں۔ جس
                  گاہک کو تصویر سے مختلف چیز ملے، وہ آپ کے ساتھ ٹکل کو بھی ذمہ دار
                  ٹھہراتا ہے۔
                </>
              ),
            },
            {
              en: "Descriptions, weights and quantities must be accurate.",
              ur: "تفصیل، وزن اور مقدار درست ہونی چاہیے۔",
            },
            {
              en: "The price you set is the price. You may not ask the customer for more at the door, or add charges that were not shown in the app.",
              ur: "جو قیمت آپ مقرر کرتے ہیں وہی قیمت ہے۔ آپ دروازے پر گاہک سے زیادہ رقم نہیں مانگ سکتے، اور نہ ایسے اخراجات شامل کر سکتے ہیں جو ایپ میں نہیں دکھائے گئے تھے۔",
            },
            {
              en: "Keep stock up to date. Switch off anything you have run out of, so nobody orders it.",
              ur: "اسٹاک کو تازہ رکھیں۔ جو چیز ختم ہو جائے اسے بند کر دیں، تاکہ کوئی اس کا آرڈر نہ دے۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{
          en: "Opening hours and accepting orders",
          ur: "اوقاتِ کار اور آرڈر قبول کرنا",
        }}
      >
        <Bullets
          items={[
            {
              en: "Set your real opening hours. Customers can only order between them, and a wrong setting costs you sales.",
              ur: "اپنے اصل اوقاتِ کار درج کریں۔ گاہک صرف انہی اوقات میں آرڈر دے سکتے ہیں، اور غلط اوقات آپ کی فروخت کا نقصان کرتے ہیں۔",
            },
            {
              en: "Use the open/closed switch when you close unexpectedly, rather than letting orders arrive that you cannot fill.",
              ur: "اگر آپ اچانک دکان بند کریں تو کھلا/بند کا بٹن استعمال کریں، بجائے اس کے کہ ایسے آرڈر آتے رہیں جو آپ پورے نہیں کر سکتے۔",
            },
            {
              en: "Accept or decline an order promptly. Leaving a customer waiting is worse than declining.",
              ur: "آرڈر جلد قبول یا مسترد کریں۔ گاہک کو انتظار میں رکھنا انکار سے بھی بُرا ہے۔",
            },
            {
              en: "Mark an order Ready only when it truly is. A rider sent too early waits, and everyone behind that order is delayed.",
              // Real quotation marks, not &quot;. This is a plain JavaScript
              // string, not JSX text — an HTML entity here would be printed on
              // the page exactly as written.
              ur: "آرڈر کو ”تیار“ صرف اُسی وقت درج کریں جب وہ واقعی تیار ہو۔ وقت سے پہلے بھیجا گیا رائیڈر انتظار کرتا ہے، اور اُس کے بعد والے سب آرڈر تاخیر کا شکار ہوتے ہیں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "If you cancel too often", ur: "اگر آپ بار بار منسوخ کریں" }}
      >
        <P
          en={
            <>
              Accepting an order and then cancelling is the most damaging thing
              that can happen to a customer&apos;s experience — they have waited,
              and now they have nothing.
            </>
          }
          ur={
            <>
              آرڈر قبول کر کے پھر منسوخ کر دینا گاہک کے تجربے کے لیے سب سے زیادہ
              نقصان دہ بات ہے — وہ انتظار کر چکا ہوتا ہے، اور اب اُس کے پاس کچھ
              نہیں ہوتا۔
            </>
          }
        />
        <Bullets
          items={[
            {
              en: "We monitor how often each shop cancels after accepting, and how often orders are late to be marked ready.",
              ur: "ہم نظر رکھتے ہیں کہ ہر دکان قبول کرنے کے بعد کتنی بار آرڈر منسوخ کرتی ہے، اور کتنی بار آرڈر کو تیار درج کرنے میں تاخیر ہوتی ہے۔",
            },
            {
              en: "A shop that cancels repeatedly may be shown lower in the app, suspended, or removed.",
              ur: "جو دکان بار بار آرڈر منسوخ کرے، اسے ایپ میں نیچے دکھایا جا سکتا ہے، معطل کیا جا سکتا ہے، یا ہٹایا جا سکتا ہے۔",
            },
            {
              en: "Cancelling because of a genuine problem is understood. Cancelling because you did not want the order is not.",
              ur: "کسی حقیقی مسئلے کی وجہ سے منسوخی قابلِ فہم ہے۔ صرف اس لیے منسوخ کرنا کہ آپ کو آرڈر لینا پسند نہیں تھا، قابلِ قبول نہیں۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Money", ur: "رقم" }}>
        <Bullets
          items={[
            {
              en: "Takal takes a commission on each order. Your rate is shown in your app and does not change without notice.",
              ur: "ٹکل ہر آرڈر پر کمیشن لیتا ہے۔ آپ کی شرح آپ کی ایپ میں دکھائی جاتی ہے اور بغیر اطلاع کے تبدیل نہیں ہوتی۔",
            },
            {
              en: "Customers see prices with our margin added. Your payout is based on your own price, less commission.",
              ur: "گاہکوں کو قیمتیں ہمارے مارجن سمیت نظر آتی ہیں۔ آپ کی ادائیگی آپ کی اپنی قیمت پر ہوتی ہے، کمیشن منہا کر کے۔",
            },
            {
              en: "Payouts run on a regular cycle. You can see every order and the exact amount owed in your app.",
              ur: "ادائیگیاں ایک مقررہ وقفے سے ہوتی ہیں۔ آپ اپنی ایپ میں ہر آرڈر اور واجب الادا صحیح رقم دیکھ سکتے ہیں۔",
            },
            {
              en: "Delivery fees and rider pay are handled by Takal and are not taken from your payout.",
              ur: "ڈیلیوری فیس اور رائیڈر کی اجرت ٹکل خود سنبھالتا ہے اور یہ آپ کی ادائیگی میں سے نہیں لی جاتی۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Customers and riders", ur: "گاہک اور رائیڈرز" }}
      >
        <Bullets
          items={[
            {
              en: "Hand orders to riders promptly and packed properly. Hot food should be sealed.",
              ur: "آرڈر رائیڈرز کو جلد اور ٹھیک طرح پیک کر کے دیں۔ گرم کھانا بند ہونا چاہیے۔",
            },
            {
              en: "Treat riders and customers with respect. Abuse is grounds for removal.",
              ur: "رائیڈرز اور گاہکوں کے ساتھ عزت سے پیش آئیں۔ بدسلوکی پر دکان ہٹائی جا سکتی ہے۔",
            },
            {
              en: "You receive a customer's name and delivery area only to fulfil their order. Do not use it for your own marketing, and do not pass it to anyone else.",
              ur: "گاہک کا نام اور ڈیلیوری کا علاقہ آپ کو صرف اُس کا آرڈر پورا کرنے کے لیے دیا جاتا ہے۔ اسے اپنی تشہیر کے لیے استعمال نہ کریں، اور نہ کسی اور کو دیں۔",
            },
            {
              en: "Do not contact customers to sell to them outside Takal.",
              ur: "ٹکل سے باہر فروخت کے لیے گاہکوں سے رابطہ نہ کریں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Food safety and quality", ur: "کھانے کی حفاظت اور معیار" }}
      >
        <Bullets
          items={[
            {
              en: "You are responsible for the safety, hygiene and legality of everything you sell.",
              ur: "جو کچھ آپ بیچتے ہیں اُس کی حفاظت، صفائی اور قانونی حیثیت کے ذمہ دار آپ ہیں۔",
            },
            {
              en: "Follow the rules that apply to your trade, including any licences and inspections.",
              ur: "اپنے کاروبار پر لاگو قوانین کی پابندی کریں، بشمول لائسنس اور معائنے۔",
            },
            {
              en: "If a customer reports illness or a serious quality problem, we will contact you and may suspend your listing while it is looked into.",
              ur: "اگر کوئی گاہک بیماری یا معیار کے سنگین مسئلے کی اطلاع دے تو ہم آپ سے رابطہ کریں گے اور تحقیقات کے دوران آپ کی فہرست معطل کر سکتے ہیں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Suspension and removal", ur: "معطلی اور اخراج" }}
      >
        <P
          en={<>We may suspend or remove a shop that:</>}
          ur={<>ہم ایسی دکان کو معطل یا خارج کر سکتے ہیں جو:</>}
        />
        <Bullets
          items={[
            {
              en: "sells something different from what was listed,",
              ur: "فہرست میں دی گئی چیز سے مختلف چیز بیچے،",
            },
            {
              en: "uses photographs that are not of its own products,",
              ur: "ایسی تصویریں استعمال کرے جو اُس کی اپنی مصنوعات کی نہ ہوں،",
            },
            {
              en: "asks customers for money beyond the app price,",
              ur: "گاہکوں سے ایپ کی قیمت سے زیادہ رقم مانگے،",
            },
            {
              en: "cancels accepted orders repeatedly,",
              ur: "قبول کیے گئے آرڈر بار بار منسوخ کرے،",
            },
            {
              en: "mistreats customers or riders, or",
              ur: "گاہکوں یا رائیڈرز کے ساتھ بدسلوکی کرے، یا",
            },
            {
              en: "breaks the law.",
              ur: "قانون کی خلاف ورزی کرے۔",
            },
          ]}
        />
        <P
          en={
            <>
              Money already earned on completed orders is still paid to you. We
              will tell you why a suspension has happened and what would resolve
              it.
            </>
          }
          ur={
            <>
              مکمل شدہ آرڈرز پر جو رقم آپ کما چکے ہیں وہ آپ کو بہرحال ادا کی جائے
              گی۔ ہم آپ کو بتائیں گے کہ معطلی کیوں ہوئی اور اسے ختم کرنے کے لیے
              کیا کرنا ہوگا۔
            </>
          }
        />
      </Section>

      <Section
        title={{ en: "Ending the arrangement", ur: "تعلق ختم کرنا" }}
      >
        <P
          en={
            <>
              You may leave Takal at any time. Please complete any orders you have
              already accepted first. We will pay everything owed on the next
              payout cycle.
            </>
          }
          ur={
            <>
              آپ جب چاہیں ٹکل چھوڑ سکتے ہیں۔ براہِ کرم پہلے وہ آرڈر مکمل کر دیں جو
              آپ قبول کر چکے ہیں۔ باقی تمام واجبات اگلے ادائیگی کے وقفے میں ادا کر
              دیے جائیں گے۔
            </>
          }
        />
      </Section>

      <Section title={{ en: "Changes", ur: "تبدیلیاں" }}>
        <P
          en={
            <>
              If we change these terms we will update this page and the date at
              the top, and tell you in the vendor app if the change is
              significant.
            </>
          }
          ur={
            <>
              اگر ہم ان شرائط میں تبدیلی کریں تو یہ صفحہ اور اوپر دی گئی تاریخ
              تبدیل کر دی جائے گی، اور اہم تبدیلی کی صورت میں وینڈر ایپ میں آپ کو
              مطلع کیا جائے گا۔
            </>
          }
        />
      </Section>
    </TermsShell>
  );
}
