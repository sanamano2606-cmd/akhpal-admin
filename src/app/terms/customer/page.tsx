import { TermsShell, Section, Bullets, P } from "../_shared";

export const metadata = {
  title: "Customer Terms — Takal",
  description: "The terms that apply when you order through the Takal app.",
};

export default function CustomerTermsPage() {
  return (
    <TermsShell
      title={{ en: "Customer Terms", ur: "گاہک کی شرائط" }}
      intro={
        <>
          <P
            en={
              <>
                These terms apply when you order through the Takal app. Please
                read them — they explain what we promise you, and what we ask
                from you.
              </>
            }
            ur={
              <>
                یہ شرائط اُس وقت لاگو ہوتی ہیں جب آپ تکل ایپ کے ذریعے آرڈر کرتے
                ہیں۔ براہِ کرم انہیں پڑھیں — ان میں بتایا گیا ہے کہ ہم آپ سے کیا
                وعدہ کرتے ہیں اور آپ سے کیا توقع رکھتے ہیں۔
              </>
            }
          />
          <P
            en={
              <>
                Takal is a delivery service. We connect you with shops and
                restaurants in Swat and bring their goods to your door. We do not
                cook the food or make the products ourselves.
              </>
            }
            ur={
              <>
                تکل ایک ڈیلیوری سروس ہے۔ ہم آپ کو سوات کی دکانوں اور ریسٹورنٹس سے
                ملاتے ہیں اور اُن کا سامان آپ کے دروازے تک پہنچاتے ہیں۔ کھانا ہم
                خود نہیں پکاتے اور نہ ہی مصنوعات خود بناتے ہیں۔
              </>
            }
          />
        </>
      }
    >
      <Section title={{ en: "Your account", ur: "آپ کا اکاؤنٹ" }}>
        <Bullets
          items={[
            {
              en: "You can browse without an account. You need one to place an order.",
              ur: "آپ بغیر اکاؤنٹ کے ایپ دیکھ سکتے ہیں۔ آرڈر دینے کے لیے اکاؤنٹ ضروری ہے۔",
            },
            {
              en: "You must give a real phone number. We verify it with a code.",
              ur: "آپ کو اصل فون نمبر دینا ہوگا۔ ہم ایک کوڈ کے ذریعے اس کی تصدیق کرتے ہیں۔",
            },
            {
              en: "One account per person. Do not create extra accounts to claim referral rewards more than once.",
              ur: "ہر شخص کے لیے ایک اکاؤنٹ۔ ریفرل انعام ایک سے زیادہ بار لینے کے لیے اضافی اکاؤنٹ نہ بنائیں۔",
            },
            {
              en: "Keep your password to yourself. Orders placed from your account are treated as yours.",
              ur: "اپنا پاس ورڈ صرف اپنے پاس رکھیں۔ آپ کے اکاؤنٹ سے دیے گئے آرڈر آپ ہی کے تصور کیے جائیں گے۔",
            },
            {
              en: "You must be at least 13 years old to use Takal.",
              ur: "تکل استعمال کرنے کے لیے آپ کی عمر کم از کم 13 سال ہونی چاہیے۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Placing an order", ur: "آرڈر دینا" }}>
        <Bullets
          items={[
            {
              en: (
                <>
                  <strong>Express delivery</strong> (food, groceries, pharmacy) is
                  brought by a rider, usually in 15–45 minutes, from shops within
                  about 10 km of your address.
                </>
              ),
              ur: (
                <>
                  <strong>ایکسپریس ڈیلیوری</strong> (کھانا، کریانہ، دوائیں) رائیڈر
                  لے کر آتا ہے، عموماً 15 سے 45 منٹ میں، اُن دکانوں سے جو آپ کے
                  پتے سے تقریباً 10 کلومیٹر کے اندر ہوں۔
                </>
              ),
            },
            {
              en: (
                <>
                  <strong>Standard delivery</strong> (other shops) is shipped by
                  the vendor and normally takes 1–3 days.
                </>
              ),
              ur: (
                <>
                  <strong>اسٹینڈرڈ ڈیلیوری</strong> (دیگر دکانیں) دکاندار خود
                  بھیجتا ہے اور عام طور پر اس میں 1 سے 3 دن لگتے ہیں۔
                </>
              ),
            },
            {
              en: "Some shops set a minimum order value. You will see it before you pay.",
              ur: "کچھ دکانیں کم از کم آرڈر کی رقم مقرر کرتی ہیں۔ ادائیگی سے پہلے آپ کو یہ نظر آ جائے گی۔",
            },
            {
              en: "Prices in the app include our service margin. What you see is what you pay.",
              ur: "ایپ میں دی گئی قیمتوں میں ہمارا سروس مارجن شامل ہے۔ جو قیمت آپ کو نظر آتی ہے، وہی آپ ادا کرتے ہیں۔",
            },
            {
              en: "A shop can refuse an order — for example if an item has just run out. You are not charged for a refused order.",
              ur: "دکان آرڈر لینے سے انکار کر سکتی ہے — مثلاً اگر کوئی چیز ابھی ختم ہو گئی ہو۔ مسترد شدہ آرڈر پر آپ سے کوئی رقم نہیں لی جاتی۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Cancelling", ur: "آرڈر منسوخ کرنا" }}>
        <Bullets
          items={[
            {
              en: (
                <>
                  You can cancel within <strong>2 minutes</strong> of placing an
                  immediate order. After that the shop has usually started
                  preparing it.
                </>
              ),
              ur: (
                <>
                  فوری آرڈر دینے کے بعد آپ <strong>2 منٹ</strong> کے اندر اسے
                  منسوخ کر سکتے ہیں۔ اس کے بعد عام طور پر دکان اسے تیار کرنا شروع
                  کر چکی ہوتی ہے۔
                </>
              ),
            },
            {
              en: (
                <>
                  A <strong>scheduled</strong> order can be cancelled any time
                  until the shop starts preparing it.
                </>
              ),
              ur: (
                <>
                  <strong>مقررہ وقت والا</strong> آرڈر اُس وقت تک کبھی بھی منسوخ
                  کیا جا سکتا ہے جب تک دکان اسے تیار کرنا شروع نہ کر دے۔
                </>
              ),
            },
            {
              en: "Once a shop has started preparing your order, it can no longer be cancelled in the app. Contact us if something has gone wrong.",
              ur: "جب دکان آپ کا آرڈر تیار کرنا شروع کر دے تو اسے ایپ میں منسوخ نہیں کیا جا سکتا۔ اگر کوئی مسئلہ ہو تو ہم سے رابطہ کریں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Paying and the delivery code", ur: "ادائیگی اور ڈیلیوری کوڈ" }}
      >
        <Bullets
          items={[
            {
              en: "Orders are currently paid in cash when the rider arrives. Please have the right amount ready.",
              ur: "فی الحال آرڈر کی ادائیگی رائیڈر کے پہنچنے پر نقد کی جاتی ہے۔ براہِ کرم پوری رقم تیار رکھیں۔",
            },
            {
              en: (
                <>
                  Your app shows a <strong>4-digit delivery code</strong>. Give it
                  to the rider when you receive your order. This is what proves
                  the delivery happened.
                </>
              ),
              ur: (
                <>
                  آپ کی ایپ میں <strong>چار ہندسوں کا ڈیلیوری کوڈ</strong> نظر آتا
                  ہے۔ آرڈر وصول کرتے وقت یہ کوڈ رائیڈر کو بتائیں۔ یہی اس بات کا
                  ثبوت ہے کہ ڈیلیوری ہوئی۔
                </>
              ),
            },
            {
              en: (
                <>
                  <strong>
                    Do not share the code before you have your order.
                  </strong>{" "}
                  Once the rider enters it, the order is recorded as delivered and
                  paid.
                </>
              ),
              ur: (
                <>
                  <strong>
                    آرڈر ہاتھ میں آنے سے پہلے کوڈ کسی کو نہ بتائیں۔
                  </strong>{" "}
                  رائیڈر کے کوڈ درج کرتے ہی آرڈر ڈیلیور شدہ اور ادا شدہ ریکارڈ ہو
                  جاتا ہے۔
                </>
              ),
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Accepting your order", ur: "آرڈر وصول کرنا" }}>
        <P
          en={
            <>
              When you place a cash order, a shop prepares real goods and a rider
              travels to you. Refusing to accept an order costs both of them.
            </>
          }
          ur={
            <>
              جب آپ نقد ادائیگی والا آرڈر دیتے ہیں تو ایک دکان اصل سامان تیار کرتی
              ہے اور ایک رائیڈر آپ تک سفر کرتا ہے۔ آرڈر لینے سے انکار دونوں کا
              نقصان کرتا ہے۔
            </>
          }
        />
        <Bullets
          items={[
            {
              en: "Please be reachable on the phone number you gave us while your order is on the way.",
              ur: "جب تک آپ کا آرڈر راستے میں ہے، براہِ کرم اُس فون نمبر پر دستیاب رہیں جو آپ نے ہمیں دیا ہے۔",
            },
            {
              en: "If you refuse delivery repeatedly without a good reason, we may require payment in advance on future orders, or close your account.",
              ur: "اگر آپ بغیر کسی معقول وجہ کے بار بار ڈیلیوری لینے سے انکار کریں تو ہم آئندہ آرڈرز پر پیشگی ادائیگی کا تقاضا کر سکتے ہیں، یا آپ کا اکاؤنٹ بند کر سکتے ہیں۔",
            },
            {
              en: "If your order is wrong, damaged, or never arrives, tell us — that is not a refusal and will not count against you.",
              ur: "اگر آپ کا آرڈر غلط ہو، خراب ہو، یا پہنچے ہی نہیں، تو ہمیں بتائیں — یہ انکار شمار نہیں ہوتا اور آپ کے خلاف نہیں جائے گا۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Problems with an order", ur: "آرڈر میں کوئی مسئلہ" }}
      >
        <Bullets
          items={[
            {
              en: "Tell us as soon as you can, ideally the same day, and keep the items if you can.",
              ur: "جتنی جلدی ممکن ہو ہمیں بتائیں، بہتر ہے اسی دن، اور اگر ہو سکے تو سامان اپنے پاس رکھیں۔",
            },
            {
              en: "For a missing or wrong item, we will arrange a refund or a replacement with the shop.",
              ur: "کوئی چیز کم ہو یا غلط آئے تو ہم دکان کے ساتھ مل کر رقم کی واپسی یا تبدیلی کا بندوبست کریں گے۔",
            },
            {
              en: "Photographs help. You can attach them to a review or send them to us.",
              ur: "تصویریں مددگار ثابت ہوتی ہیں۔ آپ انہیں ریویو کے ساتھ لگا سکتے ہیں یا ہمیں بھیج سکتے ہیں۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Reviews", ur: "ریویو" }}>
        <Bullets
          items={[
            {
              en: "You can only review a shop, product or rider from an order you actually received. This keeps reviews honest.",
              ur: "آپ کسی دکان، چیز یا رائیڈر کا ریویو صرف اُسی آرڈر پر دے سکتے ہیں جو آپ کو واقعی موصول ہوا ہو۔ اس سے ریویو سچے رہتے ہیں۔",
            },
            {
              en: "Write about your real experience. Do not post abuse, or anything untrue about a shop or a rider.",
              ur: "اپنا اصل تجربہ لکھیں۔ گالی گلوچ نہ کریں، اور کسی دکان یا رائیڈر کے بارے میں جھوٹی بات نہ لکھیں۔",
            },
            {
              en: "We may remove reviews that break these rules.",
              ur: "ان اصولوں کی خلاف ورزی کرنے والے ریویو ہم ہٹا سکتے ہیں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{
          en: "What we are responsible for",
          ur: "ہماری ذمہ داری کیا ہے",
        }}
      >
        <P
          en={
            <>
              We are responsible for delivering your order and handling it with
              care. The shop is responsible for the quality, safety and
              description of what it sells.
            </>
          }
          ur={
            <>
              آپ کا آرڈر پہنچانا اور اسے احتیاط سے سنبھالنا ہماری ذمہ داری ہے۔ جو
              چیز دکان بیچتی ہے اُس کے معیار، حفاظت اور تفصیل کی ذمہ دار دکان ہے۔
            </>
          }
        />
        <P
          en={
            <>
              If something goes wrong with an order, our responsibility is limited
              to putting that order right — a refund, a replacement, or a credit.
              We are not liable for indirect losses, such as time lost waiting.
            </>
          }
          ur={
            <>
              اگر کسی آرڈر میں کچھ غلط ہو جائے تو ہماری ذمہ داری اُسی آرڈر کو
              درست کرنے تک محدود ہے — رقم کی واپسی، تبدیلی، یا کریڈٹ۔ بالواسطہ
              نقصانات، مثلاً انتظار میں ضائع ہونے والے وقت، کے ہم ذمہ دار نہیں۔
            </>
          }
        />
        <P
          en={
            <>Nothing here removes rights you have under Pakistani consumer law.</>
          }
          ur={
            <>
              یہاں کوئی بات پاکستانی صارف قوانین کے تحت حاصل آپ کے حقوق کو ختم
              نہیں کرتی۔
            </>
          }
        />
      </Section>

      <Section
        title={{ en: "Closing your account", ur: "اکاؤنٹ بند کرنا" }}
      >
        <P
          en={
            <>
              You can ask us to close your account at any time. We may suspend an
              account that repeatedly breaks these terms — for example fake
              orders, abuse of riders or shop staff, or repeated refused
              deliveries.
            </>
          }
          ur={
            <>
              آپ جب چاہیں ہم سے اپنا اکاؤنٹ بند کرنے کا کہہ سکتے ہیں۔ جو اکاؤنٹ
              بار بار ان شرائط کی خلاف ورزی کرے، ہم اسے معطل کر سکتے ہیں — مثلاً
              جھوٹے آرڈر، رائیڈرز یا دکان کے عملے سے بدسلوکی، یا بار بار ڈیلیوری
              لینے سے انکار۔
            </>
          }
        />
      </Section>

      <Section title={{ en: "Changes", ur: "تبدیلیاں" }}>
        <P
          en={
            <>
              If we change these terms we will update this page and the date at
              the top, and tell you in the app if the change is significant.
            </>
          }
          ur={
            <>
              اگر ہم ان شرائط میں تبدیلی کریں تو یہ صفحہ اور اوپر دی گئی تاریخ
              تبدیل کر دی جائے گی، اور اہم تبدیلی کی صورت میں ایپ میں آپ کو مطلع
              کیا جائے گا۔
            </>
          }
        />
      </Section>
    </TermsShell>
  );
}
