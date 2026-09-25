// Legal documents (drafts for counsel review before launch). Egypt PDPL (Law 151 of 2020) applies.
import type { Locale } from '@agarha/schemas';

export type LegalDoc = 'terms' | 'privacy' | 'dealer-terms';
export interface LegalSection {
  h: string;
  p: string[];
}

const updated = '2026-09-25';

const docs: Record<LegalDoc, Record<Locale, LegalSection[]>> = {
  terms: {
    ar: [
      {
        h: 'مين إحنا',
        p: [
          'أجّرها منصة إعلانات بتعرض عربيات للإيجار من مكاتب تأجير مرخّصة في مصر.',
          'أجّرها مش طرف في أي عقد إيجار، ومش بيأجّر عربيات، ومش بيستلم أي فلوس من العملاء.',
        ],
      },
      {
        h: 'استخدام المنصة',
        p: [
          'تقدر تتصفح وتتواصل مع المكاتب من غير حساب. الحساب مطلوب لحفظ العربيات والبحث وكتابة التقييمات والبلاغات.',
          'ممنوع جمع البيانات آلياً من المنصة أو استخدامها لأي غرض غير قانوني.',
        ],
      },
      {
        h: 'الإعلانات والأسعار',
        p: [
          'المكاتب مسؤولة عن صحة الأسعار والتأمين والشروط وتوفر العربيات. بنعرض آخر وقت أكّد فيه المكتب إن العربية متاحة، والإعلانات اللي متأكدتش من 14 يوم بتختفي.',
          'الاتفاق النهائي والدفع بيتم مباشرة بينك وبين المكتب. متدفعش أي تأمين قبل ما تشوف العربية.',
        ],
      },
      {
        h: 'التقييمات والبلاغات',
        p: [
          'التقييم متاح بس للي تواصل مع المكتب عن طريق أجّرها، وبعد 24 ساعة، وبيتراجع قبل النشر.',
          'لو شفت إعلان مشكوك فيه بلّغ عنه من صفحته.',
        ],
      },
      {
        h: 'المسؤولية',
        p: [
          'أجّرها مش مسؤول عن أي خلاف أو ضرر ناتج عن عقد الإيجار بينك وبين المكتب، في حدود ما يسمح به القانون المصري.',
        ],
      },
      { h: 'القانون', p: ['الشروط دي بتخضع للقانون المصري، والمحاكم المصرية هي المختصة.'] },
    ],
    en: [
      {
        h: 'Who we are',
        p: [
          'Agarha is a listings platform showing rental cars from licensed rental companies in Egypt.',
          'Agarha is not a party to any rental agreement, does not rent cars and never takes payments from customers.',
        ],
      },
      {
        h: 'Using Agarha',
        p: [
          'You can browse and contact companies without an account. An account is needed to save cars and searches, write reviews and report listings.',
          'Automated collection of data from the platform, or use for any unlawful purpose, is not allowed.',
        ],
      },
      {
        h: 'Listings and prices',
        p: [
          'Companies are responsible for the accuracy of prices, deposits, conditions and availability. We show when the company last confirmed a car is available, and hide listings not confirmed for 14 days.',
          'The final agreement and payment are made directly between you and the company. Never pay a deposit before seeing the car.',
        ],
      },
      {
        h: 'Reviews and reports',
        p: [
          'Only people who contacted a company through Agarha can review it, from 24 hours after contact, and reviews are moderated before publishing.',
          'If a listing looks suspicious, report it from its page.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'To the extent permitted by Egyptian law, Agarha is not liable for disputes or damage arising from a rental agreement between you and a company.',
        ],
      },
      {
        h: 'Governing law',
        p: ['These terms are governed by Egyptian law and the Egyptian courts have jurisdiction.'],
      },
    ],
  },
  privacy: {
    ar: [
      {
        h: 'البيانات اللي بنجمعها',
        p: [
          'رقم الموبايل (للحساب فقط)، الاسم لو كتبته، العربيات والبحث المحفوظ، الاستفسارات اللي بعتها للمكاتب ومعاها كود مرجعي، والتقييمات والبلاغات.',
          'بنحتفظ بعنوان IP في صورة مشفّرة (hash) لمنع الإساءة، ومش بنخزّن أرقام بطاقات رقم قومي كنص.',
        ],
      },
      {
        h: 'ليه بنستخدمها',
        p: [
          'عشان نشغّل الحساب، نمنع الإساءة والاحتيال، نبعت الأكواد والتنبيهات اللي طلبتها، ونحسّن الخدمة بإحصائيات مجمّعة.',
        ],
      },
      {
        h: 'مع مين بنشاركها',
        p: [
          'لما تتواصل مع مكتب، المكتب بيشوف كود الاستفسار والعربية. مش بنبيع بياناتك.',
          'بنستخدم مزودي خدمة (رسائل SMS، واتساب، استضافة، تحليلات) بعقود بتلزمهم بحماية البيانات.',
        ],
      },
      {
        h: 'مدة الاحتفاظ',
        p: [
          'الاستفسارات 24 شهر، سجلات الإرسال 90 يوم، مستندات توثيق المكاتب المرفوضة بتتمسح بعد 90 يوم.',
        ],
      },
      {
        h: 'حقوقك',
        p: [
          'تقدر تنزّل نسخة من بياناتك أو تمسح حسابك من صفحة حسابي في أي وقت، وبننفّذ الطلبات خلال 30 يوم كحد أقصى طبقاً لقانون حماية البيانات الشخصية رقم 151 لسنة 2020.',
          'للتواصل: privacy@agarha.com',
        ],
      },
    ],
    en: [
      {
        h: 'Data we collect',
        p: [
          'Your mobile number (for the account only), your name if you add it, saved cars and searches, enquiries you send to companies with their reference code, and reviews and reports.',
          'We keep IP addresses only as a one-way hash to prevent abuse, and never store national ID numbers as text.',
        ],
      },
      {
        h: 'Why we use it',
        p: [
          'To run your account, prevent abuse and fraud, send the codes and alerts you asked for, and improve the service with aggregate statistics.',
        ],
      },
      {
        h: 'Who we share it with',
        p: [
          'When you contact a company, it sees the enquiry reference and the car. We do not sell your data.',
          'We use service providers (SMS, WhatsApp, hosting, analytics) under contracts that require them to protect data.',
        ],
      },
      {
        h: 'Retention',
        p: [
          'Enquiries are kept for 24 months, delivery logs for 90 days, and rejected company verification documents are deleted after 90 days.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          "You can download a copy of your data or delete your account from your account page at any time. Requests are completed within 30 days, in line with Egypt's Personal Data Protection Law No. 151 of 2020.",
          'Contact: privacy@agarha.com',
        ],
      },
    ],
  },
  'dealer-terms': {
    ar: [
      {
        h: 'مين يقدر يسجّل',
        p: ['شركات تأجير السيارات المرخّصة بس، بسجل تجاري وبطاقة ضريبية سارية. مش متاح للأفراد.'],
      },
      {
        h: 'التوثيق',
        p: [
          'بنراجع السجل التجاري والبطاقة الضريبية وبطاقة صاحب المكتب قبل ما أي إعلان ينزل. المستندات بتتخزّن بشكل خاص ومش بيشوفها غير فريق المراجعة.',
        ],
      },
      {
        h: 'الإعلانات',
        p: [
          'لازم كل إعلان يكون فيه السعر باليوم، التأمين، حد الكيلومترات، المستندات المطلوبة، أقل سن، والسواقة. لازم الصور تكون للعربية نفسها.',
          'لازم تأكّد إن العربيات متاحة بانتظام. الإعلانات اللي متأكدتش من 14 يوم بتختفي تلقائياً.',
        ],
      },
      {
        h: 'السلوك',
        p: [
          'ممنوع طلب أي تحويل أو تأمين قبل ما العميل يشوف العربية. أي بلاغ احتيال بيوقف حساب المكتب فوراً لحد المراجعة.',
        ],
      },
      {
        h: 'الاشتراكات',
        p: [
          'الخدمة مجانية في الإطلاق. الباقات المدفوعة والتمييز شامل ضريبة القيمة المضافة، وبيتم الدفع عن طريق بوابة دفع مرخّصة. العملاء عمرهم ما بيدفعوا عن طريق أجّرها.',
        ],
      },
    ],
    en: [
      {
        h: 'Who can register',
        p: [
          'Licensed car rental companies only, with a valid commercial registration and tax card. Not available to individuals.',
        ],
      },
      {
        h: 'Verification',
        p: [
          'We review the commercial registration, tax card and owner ID before any listing goes live. Documents are stored privately and only our review team can see them.',
        ],
      },
      {
        h: 'Listings',
        p: [
          'Every listing must include the daily price, deposit, mileage limit, required documents, minimum age and driving option. Photos must be of the actual car.',
          'You must confirm availability regularly. Listings not confirmed for 14 days are hidden automatically.',
        ],
      },
      {
        h: 'Conduct',
        p: [
          'Never ask for a transfer or deposit before the customer has seen the car. Any fraud report suspends the company account immediately pending review.',
        ],
      },
      {
        h: 'Subscriptions',
        p: [
          'The service is free at launch. Paid plans and featured listings include VAT and are paid through a licensed payment gateway. Customers never pay through Agarha.',
        ],
      },
    ],
  },
};

export const LEGAL_UPDATED = updated;
export function legalDoc(doc: LegalDoc, locale: Locale): LegalSection[] {
  return docs[doc][locale];
}
export const LEGAL_DOCS: LegalDoc[] = ['terms', 'privacy', 'dealer-terms'];
