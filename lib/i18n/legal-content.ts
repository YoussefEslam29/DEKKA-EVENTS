/**
 * The prose of the four policy documents, kept out of `dictionaries.ts` on
 * purpose.
 *
 * `Providers` hands both complete dictionaries to `I18nProvider` for the
 * bilingual-label pattern, which means every string in `dictionaries.ts` is
 * serialised into the payload of every page. These 68 paragraphs are 22KB of
 * that, needed by exactly four server-rendered pages that most visitors never
 * open — so they live here instead, imported only by `lib/legal.ts`, and reach
 * the browser only as the rendered text of the page actually being read.
 *
 * Titles and the consent/banner strings stay in `dictionaries.ts`: those are
 * short, and the footer, cookie banner and consent checkboxes genuinely need
 * them everywhere.
 *
 * Same contract as `dictionaries.ts`: Arabic is the source of truth and the
 * type is derived from it, so a missing or misspelled English key is a compile
 * error rather than a blank policy section.
 */

export const legalContentAr = {
  privacy: {
    scope: {
      heading: "من نحن ونطاق هذه السياسة",
      body: "هذا الموقع يديره «دكة» (Dekka)، وهو مقهى وفضاء لحفلات موسيقية حية في الإسكندرية، مصر، تحت الاسم التجاري «دكة» دون وجود شركة مسجّلة منفصلة. تشرح هذه السياسة ما هي البيانات التي نجمعها عن زوار الموقع وأعضائه وضيوف حفلاتنا، ولماذا نجمعها، ومَن نشاركها معه. تخضع هذه السياسة أساساً لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020، ونحاول أيضاً مراعاة مبادئ اللائحة الأوروبية العامة لحماية البيانات (GDPR) كوننا موقعاً عاماً بلغتين يمكن أن يزوره مقيمون في الاتحاد الأوروبي.",
    },
    dataWeCollect: {
      heading: "البيانات التي نجمعها",
      body: "بيانات الحساب: عند إنشاء حساب نجمع اسمك وبريدك الإلكتروني ورقم هاتفك، وصورة الملف الشخصي إن رفعتها؛ إذا سجّلت الدخول بجوجل أو فيسبوك أو آبل فإننا نستقبل الاسم والبريد والصورة التي يمنحنا إياها هذا المزوّد.\n– الحجوزات: عند حجز مكان في حفلة، ننسخ اسمك ورقم هاتفك المسجَّلين في حسابك إلى سجل الحجز نفسه، ليظهرا لفريق الباب.\n– تسجيل الدخول عند الباب: يسجّل فريقنا في الحفلة اسم الحاضر ورقم هاتفه وطريقة الدفع (كاش أو إنستاباي) والمبلغ المدفوع، وأحياناً النوع (ذكر/أنثى) بشكل اختياري بحت — يُستخدم هذا الحقل فقط لتحليل داخلي عن طبيعة الحضور في تلك الليلة (كتأكيد أن ليلة معينة كانت للسيدات فقط)، ولا يُشترط إدخاله.\n– طلبات عزف الفرق: إن قدّمت عرضاً للعزف في دكة، نجمع اسم المسؤول وبريده ورقم هاتفه وروابطه الفنية ووصف العرض.\n– إشعارات المتصفح: إن فعّلت الإشعارات، نحتفظ بمعرّف الاشتراك الخاص بمتصفحك (لا يحمل اسمك) لنرسل إليه إشعاراً عند إعلان ليلة جديدة.\n– ملفات تعريف الارتباط: راجع سياسة الكوكيز للتفاصيل.",
    },
    legalBasis: {
      heading: "الأساس القانوني للمعالجة",
      body: "نعالج بيانات الحساب والحجوزات على أساس تنفيذ العقد بيننا وبينك (تقديم خدمة الحجز)، وبيانات تسجيل الدخول عند الباب على أساس المصلحة المشروعة في إدارة الحفلة وتحليل الحضور، وبيانات طلبات عزف الفرق على أساس موافقتك الصريحة عند إرسال الطلب، واستخدام خرائط جوجل على أساس موافقتك التي تُبديها عبر شريط إعدادات الكوكيز.",
    },
    thirdParties: {
      heading: "مع مَن نشارك بياناتك",
      body: "لا نبيع بياناتك لأي طرف، ولا نستخدم أي أدوات تحليلات أو إعلانات على هذا الموقع. نستعين بعدد من مزودي الخدمة التقنية لتشغيل الموقع، وكل منهم يعالج البيانات نيابة عنا فقط:\n– MongoDB Atlas: تخزين قاعدة البيانات.\n– Vercel واستضافة Vercel Blob: استضافة الموقع وتخزين الصور المرفوعة.\n– Sentry: تتبّع الأخطاء التقنية فقط؛ مُعدّ بحيث لا يجمع أي بيانات شخصية افتراضياً (sendDefaultPii: false) ويمرّ كل حدث بمرشّح داخلي يحذف كلمات السر والرموز السرّية وملفات تعريف الارتباط قبل إرساله.\n– Upstash: عدّاد مؤقت لعدد المحاولات على بعض الصفحات (لمنع إساءة الاستخدام)، لا يخزّن محتوى شخصياً.\n– Resend: إرسال بريد واحد فقط، وهو رابط إعادة تعيين كلمة السر.\n– جوجل وفيسبوك وآبل: فقط إن اخترت تسجيل الدخول عبر أحدها.\n– خرائط جوجل: تظهر فقط بعد موافقتك (راجع سياسة الكوكيز).\n– خدمات الإشعارات (جوجل / موزيلا / آبل): فقط إن فعّلت الإشعارات.",
    },
    transfers: {
      heading: "نقل البيانات دولياً",
      body: "دكة كافيه في مصر، لكن بعض مزودي الخدمة المذكورين أعلاه يستضيفون بياناتك على خوادم خارج مصر. نتعامل مع مزودين معروفين يطبّقون معايير حماية بيانات معقولة، لكننا لا نستطيع أن نضمن أن كل دولة تمر بها بياناتك توفر نفس مستوى الحماية الموجود في مصر أو الاتحاد الأوروبي.",
    },
    retention: {
      heading: "مدة الاحتفاظ بالبيانات",
      body: "نحتفظ ببيانات حسابك وسجلات حجوزاتك وحضورك طالما حسابك قائم، ولا يوجد لدينا حالياً حذف تلقائي لهذه البيانات بعد مدة معينة. إذا ألغيت حجزاً فإن سجله لا يُحذف بل تتغير حالته إلى «ملغي» لأغراض السجلات الداخلية. يمكنك في أي وقت أن تطلب حذف بياناتك كما هو موضح أدناه.",
    },
    yourRights: {
      heading: "حقوقك",
      body: "بحسب قانون حماية البيانات الشخصية المصري (وبما يتوافق مع الحقوق المكافئة في اللائحة الأوروبية GDPR)، يحق لك أن تطلب: الاطلاع على البيانات التي نحتفظ بها عنك، تصحيح أي بيانات غير دقيقة، حذف بياناتك، أو الحصول على نسخة منها. بعض هذه الحقوق متاح مباشرة من صفحة «حسابي» (الاسم ورقم الهاتف والصورة)، وأي طلب آخر — بما فيه حذف الحساب بالكامل — نُنفّذه يدوياً بعد استلام طلبك على {email}.",
    },
    children: {
      heading: "الأطفال",
      body: "هذا الموقع غير موجَّه للأطفال، ولا نطلب عن قصد بيانات شخصية من أي شخص نعلم أنه دون السن القانونية لإبرام العقود.",
    },
    security: {
      heading: "أمان بياناتك",
      body: "نخزّن كلمات السر مشفَّرة بخوارزمية bcrypt ولا نحتفظ بها كنص صريح أبداً، وجلسة تسجيل دخولك محمية بملف تعريف ارتباط لا يمكن لأي سكريبت في المتصفح قراءته (HttpOnly)، ويتم نقل البيانات عبر اتصال مشفّر (HTTPS).",
    },
    changes: {
      heading: "التعديلات على هذه السياسة",
      body: "قد نُحدّث هذه السياسة من وقت لآخر لتعكس تغييرات في خدماتنا أو في القانون. سيظهر تاريخ آخر تحديث أعلى هذه الصفحة دائماً.",
    },
    contact: {
      heading: "تواصل معنا",
      body: "لأي سؤال عن خصوصيتك أو لطلب الاطلاع على بياناتك أو حذفها، راسلنا على {email}.",
    },
  },
  terms: {
    scope: {
      heading: "نطاق هذه الشروط",
      body: "تنظّم هذه الصفحة استخدامك لموقع دكة بشكل عام: الحسابات، الحجوزات، وطلبات عزف الفرق. هذه الشروط منفصلة عن أي «شروط وأحكام» خاصة بحفلة بعينها قد يكتبها فريقنا في صفحة تلك الحفلة — تلك الشروط تخص تفاصيل تلك الليلة تحديداً (مثل مواعيد الحضور)، وتُقرأ بالإضافة إلى هذه الصفحة وليس بدلاً منها.",
    },
    accounts: {
      heading: "الحسابات",
      body: "عليك تقديم اسم ورقم هاتف صحيحين عند إنشاء حساب، ولا يجوز إنشاء أكثر من حساب واحد لنفس الشخص. أنت مسؤول عن الحفاظ على سرّية كلمة سرّك.",
    },
    reservations: {
      heading: "الحجوزات",
      body: "الحجز يثبّت مكانك في الحفلة فقط — لا يتم تحصيل أي مبلغ عبر هذا الموقع؛ الدفع بالكامل (كاش أو إنستاباي) يتم شخصياً في الكافيه يوم الحفلة. يمكنك حجز مكان واحد فقط لكل حفلة بنفس الحساب. لمزيد من التفاصيل حول إلغاء الحجز وحالات عدم الحضور، راجع سياسة الاسترداد والإلغاء.",
    },
    bandSubmissions: {
      heading: "طلبات عزف الفرق",
      body: "تقديم طلب عزف لا يضمن قبوله أو الرد عليه خلال مدة معينة؛ يراجع فريق دكة كل طلب وفق تقديره الخاص ويحاول الرد على البريد الإلكتروني المرسَل به الطلب.",
    },
    acceptableUse: {
      heading: "الاستخدام المقبول",
      body: "يُمنع استخدام الموقع لإرسال طلبات وهمية أو حجوزات كيدية أو أي محتوى مسيء أو غير قانوني عبر نموذج طلب العزف أو أي نموذج آخر.",
    },
    intellectualProperty: {
      heading: "الملكية الفكرية",
      body: "اسم «دكة» وشعارها ومحتوى هذا الموقع ملك لدكة. عند إرسال طلب عزف، فإنك تمنحنا فقط الإذن بمراجعة المحتوى الذي أرسلته لتقييم طلبك، دون أي حقوق أخرى.",
    },
    thirdPartyLinks: {
      heading: "روابط ومواقع خارجية",
      body: "يحتوي الموقع على روابط لحسابات التواصل الاجتماعي وخريطة جوجل؛ لا نتحمّل مسؤولية محتوى هذه المواقع الخارجية أو سياساتها.",
    },
    disclaimers: {
      heading: "إخلاء المسؤولية",
      body: "تفاصيل الحفلات (المواعيد، الأسعار، توفر الأماكن) قابلة للتغيير، والأماكن المتاحة المعروضة تقديرية وقد لا تأخذ في الاعتبار الحضور دون حجز مسبق. الموقع والحفلات مفتوحة للجميع ما لم تنصّ صفحة حفلة معينة على خلاف ذلك.",
    },
    governingLaw: {
      heading: "القانون الحاكم",
      body: "تخضع هذه الشروط لقوانين جمهورية مصر العربية.",
    },
    changes: {
      heading: "التعديلات على هذه الشروط",
      body: "قد نُحدّث هذه الشروط من وقت لآخر، وسيظهر تاريخ آخر تحديث أعلى هذه الصفحة دائماً.",
    },
    contact: {
      heading: "تواصل معنا",
      body: "لأي استفسار حول هذه الشروط، راسلنا على {email}.",
    },
  },
  cookies: {
    whatWeUse: {
      heading: "ما هي ملفات تعريف الارتباط (الكوكيز) التي نستخدمها",
      body: "هذا جدول كامل وصريح بكل ما نضعه في متصفحك — لا يوجد شيء آخر غير مذكور هنا:\n– dekka_locale: كوكي وظيفي يحفظ اختيارك للغة (عربي/إنجليزي)، مدته سنة واحدة، ولا يُستخدم لأي تتبّع.\n– كوكي جلسة الدخول (NextAuth): كوكي ضروري لتسجيل دخولك والحفاظ عليه، محمي بحيث لا يمكن لأي سكريبت قراءته.\n– dekka_cookie_consent: كوكي وظيفي يحفظ اختيارك بخصوص الكوكيز نفسه (الكل / الضروري فقط).\n– كوكيز خرائط جوجل: تُضاف فقط إن اخترت تحميل خريطة جوجل المضمّنة في صفحة «عن دكة» أو صفحة أي حفلة — وهي الحالة الوحيدة لكوكيز طرف ثالث في هذا الموقع.",
    },
    noAnalytics: {
      heading: "لا تحليلات ولا إعلانات",
      body: "لا يستخدم هذا الموقع أي أداة تحليل زوار (مثل Google Analytics) ولا أي بكسل إعلاني (مثل بكسل فيسبوك)، ولا يشارك بيانات التصفح مع أي معلن.",
    },
    yourChoices: {
      heading: "خياراتك",
      body: "عند أول زيارة، يظهر لك شريط يتيح لك اختيار «الموافقة على الكل» أو «الضروري فقط» — الاختيار الثاني يمنع تحميل خريطة جوجل تلقائياً، وتظل قادراً على تحميلها يدوياً من داخل الصفحة نفسها متى أردت. يمكنك تغيير اختيارك في أي وقت من رابط «إدارة الكوكيز» أسفل الصفحة. إشعارات المتصفح إذن منفصل تماماً عن الكوكيز، ويمكنك إلغاؤه من إعدادات متصفحك في أي وقت.",
    },
    changes: {
      heading: "التعديلات على هذه السياسة",
      body: "قد نُحدّث هذه السياسة إن تغيّرت الكوكيز التي نستخدمها، وسيظهر تاريخ آخر تحديث أعلى هذه الصفحة دائماً.",
    },
    contact: {
      heading: "تواصل معنا",
      body: "لأي سؤال عن الكوكيز، راسلنا على {email}.",
    },
  },
  refundPolicy: {
    howPaymentWorks: {
      heading: "كيف يتم الدفع",
      body: "هذا الموقع لا يُحصّل أي مبلغ مالي عبر الإنترنت مطلقاً. الحجز على الموقع يثبّت مكانك فقط، والدفع الكامل — كاش أو إنستاباي — يتم شخصياً في الكافيه يوم الحفلة.",
    },
    cancellingYourReservation: {
      heading: "إلغاء حجزك",
      body: "يمكنك إلغاء حجزك في أي وقت قبل الحفلة من صفحة «حفلاتي» دون أي غرامة، لأنه لم يُحصَّل منك أي مبلغ أصلاً.",
    },
    noShows: {
      heading: "عدم الحضور",
      body: "لا توجد حالياً غرامة مالية تلقائية على عدم الحضور بعد الحجز، لكن قد يُطلق مكانك المحجوز لغيرك بعد بداية الحفلة بوقت معين — إن كانت لحفلة معينة شروط خاصة بهذا الخصوص، ستجدها مكتوبة في صفحة تلك الحفلة.",
    },
    ifDekkaCancels: {
      heading: "إذا ألغت دكة حفلة أو غيّرت موعدها",
      body: "في حالة إلغاء حفلة أو تغيير موعدها من جانبنا، سيُعلَن ذلك في صفحة الحفلة وعبر قنواتنا على السوشيال ميديا. أي مبلغ سبق ودفعته شخصياً في الكافيه (كاش أو إنستاباي) لهذه الحفلة يُرد إليك مباشرة من الكافيه — راسلنا على {email} لترتيب ذلك، لأن هذا الموقع لا يحتفظ بأي سجل للمدفوعات ليتم الاسترداد آلياً من خلاله.",
    },
    whatAReservationIs: {
      heading: "ما هو الحجز قانونياً",
      body: "الحجز عبر هذا الموقع هو مجرد تثبيت لمكانك في القائمة، وليس إيصالاً أو دليلاً على دفع أي مبلغ. السجل المعتمد للمدفوعات هو ما يُسجَّل يدوياً عند الباب وقت الحفلة.",
    },
    changes: {
      heading: "التعديلات على هذه السياسة",
      body: "قد نُحدّث هذه السياسة، وسيظهر تاريخ آخر تحديث أعلى هذه الصفحة دائماً.",
    },
    contact: {
      heading: "تواصل معنا",
      body: "لأي سؤال عن حجزك أو استرداد مبلغ، راسلنا على {email}.",
    },
  },
} as const;

export type LegalContent = typeof legalContentAr;

type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : DeepMutable<T[K]>;
};

export const legalContentEn: DeepMutable<LegalContent> = {
  privacy: {
    scope: {
      heading: "Who we are and what this policy covers",
      body: "This website is run by Dekka, a coffee shop and live-music space in Alexandria, Egypt, operating under the trade name 'Dekka' without a separate registered company. This policy explains what personal data we collect from visitors, members, and guests of our events, why we collect it, and who we share it with. It's written primarily around Egypt's Personal Data Protection Law No. 151 of 2020, and we've also tried to keep it consistent with the principles of the EU's GDPR, since this is a public, bilingual site that EU-based visitors can reach.",
    },
    dataWeCollect: {
      heading: "Data we collect",
      body: "Account data: when you create an account we collect your name, email, and phone number, and a profile photo if you upload one; if you sign in with Google, Facebook, or Apple, we receive the name, email, and photo that provider gives us.\n– Reservations: when you reserve a spot at an event, your account's name and phone number are copied into that reservation record so our door staff can see them.\n– Door check-in: our staff record a guest's name, phone number, payment method (cash or InstaPay), and amount paid on the night, and sometimes gender on a purely optional basis — this field is only used for internal analysis of that night's attendance (for example, confirming a night was women-only), and is never required.\n– Band submissions: if you pitch a show, we collect the contact name, email, phone number, links, and pitch you submit.\n– Browser push notifications: if you enable notifications, we keep your browser's subscription identifier (it carries no name) so we can notify it when a new night is announced.\n– Cookies: see our Cookie Policy for the full list.",
    },
    legalBasis: {
      heading: "Legal basis for processing",
      body: "We process account and reservation data to perform our contract with you (providing the reservation service), door check-in data on the basis of our legitimate interest in running the event and understanding attendance, band-submission data on the basis of your explicit consent when you submit a pitch, and the Google Maps embed only once you've given consent through the cookie banner.",
    },
    thirdParties: {
      heading: "Who we share your data with",
      body: "We do not sell your data to anyone, and this site runs no analytics or advertising tools of any kind. We rely on a small number of technical service providers to run the site, each processing data only on our behalf:\n– MongoDB Atlas: our database.\n– Vercel and Vercel Blob storage: site hosting and uploaded images.\n– Sentry: technical error monitoring only; configured to collect no personal data by default (sendDefaultPii: false), and every event passes through a scrubber that strips passwords, tokens, and cookies before it's sent.\n– Upstash: a short-lived request counter on a few endpoints to prevent abuse — it stores no personal content.\n– Resend: sends exactly one kind of email, the password-reset link.\n– Google, Facebook, Apple: only if you choose to sign in with one of them.\n– Google Maps: only appears once you've given consent (see our Cookie Policy).\n– Push notification services (Google/Mozilla/Apple): only if you enable notifications.",
    },
    transfers: {
      heading: "International transfers",
      body: "Dekka operates in Egypt, but some of the providers above host your data on servers outside Egypt. We work with established providers who apply reasonable data-protection standards, but we can't guarantee every country your data passes through offers the same level of protection as Egypt or the EU.",
    },
    retention: {
      heading: "How long we keep data",
      body: "We keep your account, reservation, and attendance records for as long as your account exists — there's currently no automatic deletion after a set period. Cancelling a reservation doesn't delete its record; it's marked \"cancelled\" for our internal records. You can ask us to delete your data at any time, as described below.",
    },
    yourRights: {
      heading: "Your rights",
      body: "Under Egypt's Personal Data Protection Law (and consistent with the equivalent GDPR rights), you can ask to: access the data we hold about you, correct anything inaccurate, delete your data, or receive a copy of it. Some of this is available directly from your Account page (name, phone, photo); anything else — including deleting your account entirely — we handle by hand once you email {email}.",
    },
    children: {
      heading: "Children",
      body: "This site isn't directed at children, and we don't knowingly collect personal data from anyone below the legal age to enter into a contract.",
    },
    security: {
      heading: "How we protect your data",
      body: "Passwords are hashed with bcrypt and never stored as plain text, your sign-in session is protected by a cookie your browser scripts can't read (HttpOnly), and data travels over an encrypted connection (HTTPS).",
    },
    changes: {
      heading: "Changes to this policy",
      body: "We may update this policy from time to time as our services or the law change. The date at the top of this page always reflects the latest update.",
    },
    contact: {
      heading: "Contact us",
      body: "For any question about your privacy, or to request access to or deletion of your data, email us at {email}.",
    },
  },
  terms: {
    scope: {
      heading: "What these terms cover",
      body: "This page governs your use of the Dekka website in general: accounts, reservations, and band submissions. It's separate from any event-specific terms our team may write on a particular event's page — those cover details specific to that one night (like arrival windows) and apply alongside this page, not instead of it.",
    },
    accounts: {
      heading: "Accounts",
      body: "You need to give an accurate name and phone number when creating an account, and one account per person. You're responsible for keeping your password confidential.",
    },
    reservations: {
      heading: "Reservations",
      body: "A reservation only holds your spot at an event — no payment is ever taken through this website; the full amount (cash or InstaPay) is paid in person at the cafe on the night. You may hold one reservation per event per account. See our Refund & Cancellation Policy for how cancellations and no-shows are handled.",
    },
    bandSubmissions: {
      heading: "Band submissions",
      body: "Submitting a pitch doesn't guarantee it will be accepted or answered by any particular date; our team reviews every submission at our own discretion and tries to reply to the email address you gave us.",
    },
    acceptableUse: {
      heading: "Acceptable use",
      body: "Don't use this site to send fake submissions, bad-faith reservations, or abusive or unlawful content through the band-submission form or any other form.",
    },
    intellectualProperty: {
      heading: "Intellectual property",
      body: "The Dekka name, logo, and the content of this site belong to Dekka. Submitting a band pitch only grants us permission to review the content you sent in order to evaluate it — nothing more.",
    },
    thirdPartyLinks: {
      heading: "Third-party links",
      body: "This site links to our social media accounts and an embedded Google map; we aren't responsible for the content or policies of those external sites.",
    },
    disclaimers: {
      heading: "Disclaimers",
      body: "Event details (timing, price, availability) can change, and the spots-left figure shown is an estimate that may not account for walk-ins. The cafe and its events are open to the public unless a specific event's page states otherwise.",
    },
    governingLaw: {
      heading: "Governing law",
      body: "These terms are governed by the laws of the Arab Republic of Egypt.",
    },
    changes: {
      heading: "Changes to these terms",
      body: "We may update these terms from time to time. The date at the top of this page always reflects the latest update.",
    },
    contact: {
      heading: "Contact us",
      body: "For any question about these terms, email us at {email}.",
    },
  },
  cookies: {
    whatWeUse: {
      heading: "The cookies we actually use",
      body: "A complete, honest list — nothing else is set on your browser beyond this:\n– dekka_locale: a functional cookie that remembers your language choice (Arabic/English), lasts one year, and is never used for tracking.\n– Sign-in session cookie (NextAuth): strictly necessary to sign you in and keep you signed in; no browser script can read it.\n– dekka_cookie_consent: a functional cookie that remembers your own cookie choice.\n– Google Maps cookies: only set if you choose to load the embedded Google map on our About page or an event page — the one genuine third-party cookie on this site.",
    },
    noAnalytics: {
      heading: "No analytics, no advertising",
      body: "This site runs no visitor-analytics tool (like Google Analytics) and no advertising pixel (like the Facebook pixel), and shares no browsing data with any advertiser.",
    },
    yourChoices: {
      heading: "Your choices",
      body: "On your first visit, a banner lets you choose 'Accept all' or 'Necessary only' — the second option stops the Google map from loading automatically, though you can still load it by hand from within the page whenever you want. You can change your choice at any time from the 'Manage cookies' link in the footer. Push notifications are a completely separate browser permission from cookies, and you can turn them off from your browser settings at any time.",
    },
    changes: {
      heading: "Changes to this policy",
      body: "We may update this policy if the cookies we use change. The date at the top of this page always reflects the latest update.",
    },
    contact: {
      heading: "Contact us",
      body: "For any question about cookies, email us at {email}.",
    },
  },
  refundPolicy: {
    howPaymentWorks: {
      heading: "How payment works",
      body: "This website never processes any payment online. A reservation made here only holds your spot — the full amount, cash or InstaPay, is paid in person at the cafe on the night.",
    },
    cancellingYourReservation: {
      heading: "Cancelling your reservation",
      body: "You can cancel your reservation any time before the event from your My Events page, at no cost, since nothing was ever charged in the first place.",
    },
    noShows: {
      heading: "No-shows",
      body: "There's currently no automatic financial penalty for reserving and not showing up, but your held spot may be released to someone else a set time after the show starts — if a specific event has its own rule about this, it will be stated on that event's page.",
    },
    ifDekkaCancels: {
      heading: "If Dekka cancels or reschedules a night",
      body: "If we cancel or reschedule an event, we'll announce it on the event page and our social channels. Any amount you already paid in person (cash or InstaPay) for that night is refunded to you directly by the cafe — email us at {email} to arrange it, since this website keeps no online payment record to refund against.",
    },
    whatAReservationIs: {
      heading: "What a reservation legally is",
      body: "A reservation made through this site is only a placeholder on our list — it isn't a receipt or proof that any amount was paid. The door list recorded in person on the night is the authoritative payment record.",
    },
    changes: {
      heading: "Changes to this policy",
      body: "We may update this policy from time to time. The date at the top of this page always reflects the latest update.",
    },
    contact: {
      heading: "Contact us",
      body: "For any question about your reservation or a refund, email us at {email}.",
    },
  },
};

export const legalContent = { ar: legalContentAr, en: legalContentEn } as const;
