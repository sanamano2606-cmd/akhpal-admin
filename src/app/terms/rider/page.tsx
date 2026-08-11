import { TermsShell, Section, Bullets, P } from "../_shared";

export const metadata = {
  title: "Rider Terms — Takal",
  description: "The terms that apply to riders delivering for Takal.",
};

export default function RiderTermsPage() {
  return (
    <TermsShell
      title={{ en: "Rider Terms", ur: "رائیڈر کی شرائط" }}
      intro={
        <P
          en={
            <>
              These terms apply when you deliver orders for Takal. The most
              important parts are about the money you carry and the delivery code
              — please read those two sections carefully.
            </>
          }
          ur={
            <>
              یہ شرائط اُس وقت لاگو ہوتی ہیں جب آپ تکل کے لیے آرڈر پہنچاتے ہیں۔
              سب سے اہم حصے وہ ہیں جو آپ کے پاس موجود رقم اور ڈیلیوری کوڈ سے
              متعلق ہیں — براہِ کرم یہ دو حصے غور سے پڑھیں۔
            </>
          }
        />
      }
    >
      <Section title={{ en: "Joining", ur: "شمولیت" }}>
        <Bullets
          items={[
            {
              en: "Every rider is checked by Takal before being approved. We may decline an application without giving a reason.",
              ur: "ہر رائیڈر کی منظوری سے پہلے تکل جانچ پڑتال کرتا ہے۔ ہم کوئی وجہ بتائے بغیر درخواست مسترد کر سکتے ہیں۔",
            },
            {
              en: "Your CNIC, phone number and vehicle details must be your own and correct. We keep them to verify you and never show them to customers.",
              ur: "آپ کا شناختی کارڈ، فون نمبر اور گاڑی کی تفصیلات آپ کی اپنی اور درست ہونی چاہئیں۔ ہم انہیں آپ کی تصدیق کے لیے محفوظ رکھتے ہیں اور کبھی گاہکوں کو نہیں دکھاتے۔",
            },
            {
              en: "You must have a valid licence for the vehicle you ride, and follow the road laws.",
              ur: "جو گاڑی آپ چلاتے ہیں اُس کا درست لائسنس آپ کے پاس ہونا چاہیے، اور آپ کو ٹریفک قوانین کی پابندی کرنی ہوگی۔",
            },
            {
              en: "You may not let anyone else use your account or deliver in your place.",
              ur: "آپ کسی اور کو اپنا اکاؤنٹ استعمال کرنے یا اپنی جگہ ڈیلیوری کرنے کی اجازت نہیں دے سکتے۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "The cash you carry", ur: "آپ کے پاس موجود نقد رقم" }}>
        <P
          en={
            <>
              Most orders are paid in cash. That money belongs to Takal from the
              moment the customer hands it to you.
            </>
          }
          ur={
            <>
              زیادہ تر آرڈرز کی ادائیگی نقد ہوتی ہے۔ گاہک کے ہاتھ سے وصول کرتے ہی
              وہ رقم تکل کی ملکیت ہے۔
            </>
          }
        />
        <Bullets
          items={[
            {
              en: (
                <>
                  Deposit the cash you are holding <strong>within 2 days</strong>
                  , and before it reaches <strong>Rs 10,000</strong>.
                </>
              ),
              ur: (
                <>
                  آپ کے پاس جو رقم موجود ہے وہ <strong>2 دن کے اندر</strong> جمع
                  کرائیں، اور <strong>10,000 روپے</strong> تک پہنچنے سے پہلے۔
                </>
              ),
            },
            {
              en: (
                <>
                  If you go past either limit, the app{" "}
                  <strong>stops giving you new orders</strong> until you hand the
                  money in. Orders you have already accepted are not affected —
                  you must still deliver those.
                </>
              ),
              ur: (
                <>
                  اگر آپ ان میں سے کوئی حد پار کر جائیں تو ایپ{" "}
                  <strong>آپ کو نئے آرڈر دینا بند کر دے گی</strong> جب تک آپ رقم
                  جمع نہ کرا دیں۔ جو آرڈر آپ پہلے قبول کر چکے ہیں اُن پر اثر نہیں
                  پڑتا — وہ آپ کو بہرحال پہنچانے ہوں گے۔
                </>
              ),
            },
            {
              en: "The block lifts by itself as soon as your handover is recorded. You do not need to wait for anyone.",
              ur: "جیسے ہی آپ کی جمع کرائی گئی رقم درج ہو جاتی ہے، پابندی خود بخود ختم ہو جاتی ہے۔ آپ کو کسی کا انتظار نہیں کرنا پڑتا۔",
            },
            {
              en: "Your wallet in the app always shows what you are holding and what you are owed. Check it if a figure looks wrong, and tell us straight away.",
              ur: "ایپ میں آپ کا والٹ ہر وقت دکھاتا ہے کہ آپ کے پاس کتنی رقم ہے اور آپ کو کتنی ملنی ہے۔ اگر کوئی رقم غلط لگے تو اسے دیکھیں اور فوراً ہمیں بتائیں۔",
            },
            {
              en: "Failing to hand over cash is theft and will be treated as such.",
              ur: "رقم جمع نہ کرانا چوری ہے اور اسی طرح اس سے نمٹا جائے گا۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "The delivery code", ur: "ڈیلیوری کوڈ" }}>
        <P
          en={
            <>
              The customer has a 4-digit code in their app. You must ask for it
              and enter it to complete a delivery.
            </>
          }
          ur={
            <>
              گاہک کی ایپ میں چار ہندسوں کا ایک کوڈ موجود ہوتا ہے۔ ڈیلیوری مکمل
              کرنے کے لیے آپ کو وہ کوڈ اُن سے پوچھ کر درج کرنا ہوگا۔
            </>
          }
        />
        <Bullets
          items={[
            {
              en: (
                <>
                  <strong>
                    Never mark an order delivered before you have handed it over.
                  </strong>{" "}
                  The code exists so that a completed order means a real delivery.
                </>
              ),
              ur: (
                <>
                  <strong>
                    آرڈر حوالے کرنے سے پہلے اسے کبھی &quot;ڈیلیور ہو گیا&quot; کے
                    طور پر درج نہ کریں۔
                  </strong>{" "}
                  یہ کوڈ اسی لیے ہے تاکہ مکمل شدہ آرڈر کا مطلب واقعی ایک حقیقی
                  ڈیلیوری ہو۔
                </>
              ),
            },
            {
              en: "You cannot see the code anywhere in your own app. That is deliberate — you get it from the customer, in person.",
              ur: "یہ کوڈ آپ کو اپنی ایپ میں کہیں نظر نہیں آئے گا۔ یہ جان بوجھ کر ایسا ہے — آپ یہ کوڈ گاہک سے، رُوبرُو، حاصل کرتے ہیں۔",
            },
            {
              en: "If a customer genuinely cannot give you the code — a flat battery, a lost phone — call us. An admin can complete it, and every such case is recorded.",
              ur: "اگر گاہک واقعی آپ کو کوڈ نہ دے سکے — موبائل کی بیٹری ختم ہو گئی ہو یا فون گم ہو گیا ہو — تو ہمیں کال کریں۔ ایڈمن آرڈر مکمل کر سکتا ہے، اور ایسا ہر واقعہ ریکارڈ کیا جاتا ہے۔",
            },
            {
              en: "Marking deliveries complete without delivering will end your account and be reported.",
              ur: "ڈیلیوری کیے بغیر آرڈر مکمل درج کرنے پر آپ کا اکاؤنٹ ختم کر دیا جائے گا اور معاملہ رپورٹ کیا جائے گا۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Doing the work", ur: "کام کا طریقہ" }}>
        <Bullets
          items={[
            {
              en: "Accept an order only if you can actually do it. Accepting and then abandoning leaves a customer with cold food and no explanation.",
              ur: "آرڈر صرف اُسی صورت میں قبول کریں جب آپ واقعی اسے پہنچا سکتے ہوں۔ قبول کر کے چھوڑ دینے سے گاہک کے پاس ٹھنڈا کھانا اور کوئی وضاحت نہیں بچتی۔",
            },
            {
              en: "Do not open, taste or take any part of an order.",
              ur: "آرڈر کو نہ کھولیں، نہ چکھیں اور نہ اس میں سے کچھ لیں۔",
            },
            {
              en: "Keep food upright and sealed. Deliver it in the condition you collected it.",
              ur: "کھانے کو سیدھا اور بند رکھیں۔ جس حالت میں آپ نے وصول کیا، اسی حالت میں پہنچائیں۔",
            },
            {
              en: "Be polite to customers and to shop staff, even when they are not.",
              ur: "گاہکوں اور دکان کے عملے کے ساتھ شائستگی سے پیش آئیں، چاہے وہ ایسا نہ کریں۔",
            },
            {
              en: "Go offline when you finish for the day, so orders are not offered to you.",
              ur: "دن کا کام ختم کرنے پر آف لائن ہو جائیں، تاکہ آپ کو آرڈر نہ بھیجے جائیں۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Your pay", ur: "آپ کی اجرت" }}>
        <Bullets
          items={[
            {
              en: "You are paid per delivery. The amount is shown before you accept an order.",
              ur: "آپ کو ہر ڈیلیوری کے حساب سے ادائیگی کی جاتی ہے۔ رقم آرڈر قبول کرنے سے پہلے دکھائی جاتی ہے۔",
            },
            {
              en: "What you earn is separate from what the customer pays for delivery. A free-delivery promotion does not reduce your pay.",
              ur: "آپ کی کمائی اُس رقم سے الگ ہے جو گاہک ڈیلیوری کے لیے ادا کرتا ہے۔ مفت ڈیلیوری کی کسی پیشکش سے آپ کی اجرت کم نہیں ہوتی۔",
            },
            {
              en: "Earnings are settled on a regular cycle. Your wallet shows every delivery and every amount.",
              ur: "کمائی ایک مقررہ وقفے سے ادا کی جاتی ہے۔ آپ کا والٹ ہر ڈیلیوری اور ہر رقم دکھاتا ہے۔",
            },
            {
              en: "If you owe Takal cash, that is settled against what you are owed, and your wallet shows the net figure.",
              ur: "اگر آپ کے ذمے تکل کی رقم واجب ہو تو وہ آپ کی واجب الادا کمائی میں سے منہا کر لی جاتی ہے، اور آپ کا والٹ بقیہ رقم دکھاتا ہے۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Customer information", ur: "گاہک کی معلومات" }}>
        <Bullets
          items={[
            {
              en: "You receive a customer's name, phone number and address only for the order you are delivering.",
              ur: "آپ کو گاہک کا نام، فون نمبر اور پتہ صرف اُسی آرڈر کے لیے دیا جاتا ہے جو آپ پہنچا رہے ہیں۔",
            },
            {
              en: "Use it for that delivery and nothing else. Do not save it, share it, or contact a customer afterwards.",
              ur: "اسے صرف اُسی ڈیلیوری کے لیے استعمال کریں، کسی اور مقصد کے لیے نہیں۔ نہ اسے محفوظ کریں، نہ کسی کو دیں، اور نہ بعد میں گاہک سے رابطہ کریں۔",
            },
            {
              en: "Misusing customer information will end your account.",
              ur: "گاہک کی معلومات کا غلط استعمال کرنے پر آپ کا اکاؤنٹ ختم کر دیا جائے گا۔",
            },
          ]}
        />
      </Section>

      <Section title={{ en: "Your safety", ur: "آپ کی حفاظت" }}>
        <Bullets
          items={[
            {
              en: "Never ride in a way that puts you or anyone else at risk. No order is worth an accident.",
              ur: "کبھی ایسے انداز میں گاڑی نہ چلائیں جس سے آپ یا کوئی اور خطرے میں پڑے۔ کوئی آرڈر حادثے کے قابل نہیں۔",
            },
            {
              en: "Wear a helmet.",
              ur: "ہیلمٹ پہنیں۔",
            },
            {
              en: "If you feel unsafe at a delivery, leave and tell us. You will not be penalised.",
              ur: "اگر ڈیلیوری کے دوران آپ کو خطرہ محسوس ہو تو وہاں سے چلے جائیں اور ہمیں بتائیں۔ آپ پر کوئی جرمانہ نہیں ہوگا۔",
            },
            {
              en: "You are responsible for your own vehicle, its papers and its insurance.",
              ur: "اپنی گاڑی، اس کے کاغذات اور اس کی انشورنس کے ذمہ دار آپ خود ہیں۔",
            },
          ]}
        />
      </Section>

      <Section
        title={{ en: "Suspension and removal", ur: "معطلی اور اخراج" }}
      >
        <P
          en={<>We may suspend or remove a rider who:</>}
          ur={<>ہم ایسے رائیڈر کو معطل یا خارج کر سکتے ہیں جو:</>}
        />
        <Bullets
          items={[
            {
              en: "marks an order delivered without delivering it,",
              ur: "آرڈر پہنچائے بغیر اسے ڈیلیور شدہ درج کرے،",
            },
            {
              en: "does not hand over cash on time,",
              ur: "رقم وقت پر جمع نہ کرائے،",
            },
            {
              en: "takes or tampers with an order,",
              ur: "آرڈر میں سے کچھ لے یا اس سے چھیڑ چھاڑ کرے،",
            },
            {
              en: "mistreats a customer or shop,",
              ur: "کسی گاہک یا دکان کے ساتھ بدسلوکی کرے،",
            },
            {
              en: "lets someone else use their account, or",
              ur: "کسی اور کو اپنا اکاؤنٹ استعمال کرنے دے، یا",
            },
            {
              en: "rides dangerously or illegally.",
              ur: "خطرناک یا غیر قانونی طریقے سے گاڑی چلائے۔",
            },
          ]}
        />
        <P
          en={
            <>
              Pay you have already earned is still yours, less any cash you are
              holding.
            </>
          }
          ur={
            <>
              جو اجرت آپ کما چکے ہیں وہ آپ ہی کی ہے، البتہ آپ کے پاس موجود نقد رقم
              اس میں سے منہا کر لی جائے گی۔
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
              You may stop riding for Takal at any time. Please complete any
              orders you have accepted and hand over any cash you are holding
              first. We will settle what is owed on the next cycle.
            </>
          }
          ur={
            <>
              آپ جب چاہیں تکل کے لیے کام کرنا بند کر سکتے ہیں۔ براہِ کرم پہلے وہ
              آرڈر مکمل کر دیں جو آپ قبول کر چکے ہیں اور اپنے پاس موجود رقم جمع
              کرا دیں۔ باقی واجبات اگلے ادائیگی کے وقفے میں ادا کر دیے جائیں گے۔
            </>
          }
        />
      </Section>

      <Section title={{ en: "Changes", ur: "تبدیلیاں" }}>
        <P
          en={
            <>
              If we change these terms we will update this page and the date at
              the top, and tell you in the rider app if the change is significant.
            </>
          }
          ur={
            <>
              اگر ہم ان شرائط میں تبدیلی کریں تو یہ صفحہ اور اوپر دی گئی تاریخ
              تبدیل کر دی جائے گی، اور اہم تبدیلی کی صورت میں رائیڈر ایپ میں آپ کو
              مطلع کیا جائے گا۔
            </>
          }
        />
      </Section>
    </TermsShell>
  );
}
