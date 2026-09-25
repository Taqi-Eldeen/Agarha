// Arabic catalog: the source of truth for keys. Written natively, not translated.

export const ar = {
  common: {
    appName: 'أجّرها',
    tagline: 'أجّر عربيتك وأنت عارف كل التفاصيل من الأول',
    languageSwitch: 'English',
    forDealers: 'لمكاتب التأجير',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    retry: 'حاول تاني',
    loading: 'جاري التحميل…',
    comingSoon: 'بنجهّز أول مكاتب تأجير موثّقة. ارجع لنا قريب.',
  },
  price: {
    perDay: '{price} / اليوم',
    perWeek: '{price} / الأسبوع',
    perMonth: '{price} / الشهر',
    deposit: 'تأمين {amount}',
  },
  freshness: {
    fresh: 'متأكَّد منها {ago}',
    aging: 'متأكَّد منها {ago}',
    stale: 'آخر تأكيد {ago}',
  },
  safety: {
    neverPayDeposit: 'متدفعش أي تأمين قبل ما تشوف العربية بنفسك.',
    notAParty: 'أجّرها مش طرف في أي عقد إيجار.',
  },
  auth: {
    phoneLabel: 'رقم الموبايل',
    phoneHint: 'رقم موبايل مصري، مثلاً 010 1234 5678',
    sendCode: 'ابعت الكود',
    codeLabel: 'كود التأكيد',
    codeSentSms: 'بعتنا كود من 6 أرقام في رسالة لـ {phone}.',
    codeSentWhatsapp: 'بعتنا كود من 6 أرقام على واتساب لـ {phone}.',
    verify: 'تأكيد',
    resendIn: 'تقدر تطلب كود جديد بعد {seconds} ثانية',
    resend: 'ابعت كود جديد',
    useWhatsapp: 'ابعته على واتساب بدل الرسالة',
  },
  otpMessage: {
    body: 'كود أجّرها بتاعك هو {code}. صالح لمدة {minutes} دقايق. متقولوش لحد.',
  },
  errors: {
    validation_failed: 'راجع الخانات المعلَّمة.',
    invalid_egypt_mobile: 'اكتب رقم موبايل مصري، مثلاً 010 1234 5678.',
    rate_limited: 'محاولات كتير. استنى كام دقيقة وجرّب تاني.',
    captcha_failed: 'معرفناش نتأكد إنك مش روبوت. جرّب تاني.',
    otp_invalid: 'الكود ده مش صح. راجع الرسالة وجرّب تاني.',
    otp_expired: 'الكود ده خلص وقته. اطلب كود جديد.',
    otp_too_many_attempts: 'دخلت كود غلط كذا مرة. اطلب كود جديد.',
    otp_delivery_failed: 'معرفناش نبعت الكود. جرّب واتساب أو حاول بعد شوية.',
    unauthorized: 'سجّل دخولك الأول.',
    forbidden: 'مش مسموح لك تفتح الصفحة دي.',
    not_found: 'مش لاقيين اللي بتدور عليه.',
    internal_error: 'حصلت مشكلة عندنا. جرّب تاني.',
  },
};

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Messages = DeepString<typeof ar>;
