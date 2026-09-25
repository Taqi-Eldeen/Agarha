// Reference data: Greater Cairo live at launch (Q2); Alexandria, North Coast, Red Sea seeded inactive for P6.
type Area = [slug: string, ar: string, en: string, lat: number, lng: number];
type City = {
  slug: string;
  ar: string;
  en: string;
  active: boolean;
  sort: number;
  lat: number;
  lng: number;
  areas: Area[];
};

export const CITIES: City[] = [
  {
    slug: 'cairo',
    ar: 'القاهرة',
    en: 'Cairo',
    active: true,
    sort: 1,
    lat: 30.0444,
    lng: 31.2357,
    areas: [
      ['nasr-city', 'مدينة نصر', 'Nasr City', 30.0561, 31.3301],
      ['heliopolis', 'مصر الجديدة', 'Heliopolis', 30.0911, 31.3225],
      ['new-cairo', 'القاهرة الجديدة', 'New Cairo', 30.0074, 31.4913],
      ['maadi', 'المعادي', 'Maadi', 29.9602, 31.2569],
      ['zamalek', 'الزمالك', 'Zamalek', 30.0609, 31.2197],
      ['downtown', 'وسط البلد', 'Downtown', 30.0478, 31.2336],
      ['sheraton', 'شيراتون', 'Sheraton', 30.1041, 31.3736],
      ['mokattam', 'المقطم', 'Mokattam', 30.0167, 31.3],
      ['shorouk', 'الشروق', 'El Shorouk', 30.1218, 31.6071],
      ['madinaty', 'مدينتي', 'Madinaty', 30.1072, 31.6386],
      ['obour', 'العبور', 'El Obour', 30.2271, 31.4757],
    ],
  },
  {
    slug: 'giza',
    ar: 'الجيزة',
    en: 'Giza',
    active: true,
    sort: 2,
    lat: 30.0131,
    lng: 31.2089,
    areas: [
      ['dokki', 'الدقي', 'Dokki', 30.0385, 31.2123],
      ['mohandessin', 'المهندسين', 'Mohandessin', 30.0561, 31.2001],
      ['agouza', 'العجوزة', 'Agouza', 30.0527, 31.2126],
      ['haram', 'الهرم', 'Haram', 29.9926, 31.1495],
      ['sheikh-zayed', 'الشيخ زايد', 'Sheikh Zayed', 30.0444, 30.9878],
      ['6th-of-october', 'السادس من أكتوبر', '6th of October', 29.9285, 30.9188],
    ],
  },
  {
    slug: 'alexandria',
    ar: 'الإسكندرية',
    en: 'Alexandria',
    active: false,
    sort: 3,
    lat: 31.2001,
    lng: 29.9187,
    areas: [
      ['smouha', 'سموحة', 'Smouha', 31.2156, 29.9453],
      ['sidi-gaber', 'سيدي جابر', 'Sidi Gaber', 31.2186, 29.9422],
      ['miami', 'ميامي', 'Miami', 31.2682, 30.0028],
      ['gleem', 'جليم', 'Gleem', 31.2413, 29.9669],
    ],
  },
  {
    slug: 'north-coast',
    ar: 'الساحل الشمالي',
    en: 'North Coast',
    active: false,
    sort: 4,
    lat: 30.8418,
    lng: 28.9555,
    areas: [
      ['marina', 'مارينا', 'Marina', 30.8269, 28.9537],
      ['alamein', 'العلمين', 'El Alamein', 30.8307, 28.9555],
      ['sidi-abdel-rahman', 'سيدي عبد الرحمن', 'Sidi Abdel Rahman', 30.9589, 28.7419],
    ],
  },
  {
    slug: 'red-sea',
    ar: 'البحر الأحمر',
    en: 'Red Sea',
    active: false,
    sort: 5,
    lat: 27.2579,
    lng: 33.8116,
    areas: [
      ['hurghada', 'الغردقة', 'Hurghada', 27.2579, 33.8116],
      ['el-gouna', 'الجونة', 'El Gouna', 27.3944, 33.6782],
      ['sahl-hasheesh', 'سهل حشيش', 'Sahl Hasheesh', 27.0503, 33.8834],
    ],
  },
];

type Model = [
  slug: string,
  ar: string,
  en: string,
  body:
    | 'sedan'
    | 'hatchback'
    | 'suv'
    | 'crossover'
    | 'minivan'
    | 'van'
    | 'pickup'
    | 'coupe'
    | 'convertible'
    | 'luxury',
];
export const MAKES: { slug: string; ar: string; en: string; models: Model[] }[] = [
  {
    slug: 'toyota',
    ar: 'تويوتا',
    en: 'Toyota',
    models: [
      ['corolla', 'كورولا', 'Corolla', 'sedan'],
      ['yaris', 'ياريس', 'Yaris', 'sedan'],
      ['camry', 'كامري', 'Camry', 'sedan'],
      ['fortuner', 'فورتشنر', 'Fortuner', 'suv'],
      ['land-cruiser', 'لاند كروزر', 'Land Cruiser', 'luxury'],
      ['hiace', 'هاي إس', 'HiAce', 'van'],
      ['rush', 'راش', 'Rush', 'suv'],
    ],
  },
  {
    slug: 'hyundai',
    ar: 'هيونداي',
    en: 'Hyundai',
    models: [
      ['elantra', 'إلنترا', 'Elantra', 'sedan'],
      ['accent', 'أكسنت', 'Accent', 'sedan'],
      ['tucson', 'توسان', 'Tucson', 'suv'],
      ['i10', 'آي 10', 'i10', 'hatchback'],
      ['h1', 'إتش 1', 'H-1', 'van'],
    ],
  },
  {
    slug: 'kia',
    ar: 'كيا',
    en: 'Kia',
    models: [
      ['cerato', 'سيراتو', 'Cerato', 'sedan'],
      ['sportage', 'سبورتاج', 'Sportage', 'suv'],
      ['picanto', 'بيكانتو', 'Picanto', 'hatchback'],
      ['pegas', 'بيجاس', 'Pegas', 'sedan'],
      ['carnival', 'كرنفال', 'Carnival', 'minivan'],
    ],
  },
  {
    slug: 'nissan',
    ar: 'نيسان',
    en: 'Nissan',
    models: [
      ['sunny', 'صني', 'Sunny', 'sedan'],
      ['sentra', 'سنترا', 'Sentra', 'sedan'],
      ['qashqai', 'قشقاي', 'Qashqai', 'crossover'],
    ],
  },
  {
    slug: 'chevrolet',
    ar: 'شيفروليه',
    en: 'Chevrolet',
    models: [
      ['optra', 'أوبترا', 'Optra', 'sedan'],
      ['aveo', 'أفيو', 'Aveo', 'sedan'],
      ['captiva', 'كابتيفا', 'Captiva', 'suv'],
    ],
  },
  {
    slug: 'renault',
    ar: 'رينو',
    en: 'Renault',
    models: [
      ['logan', 'لوجان', 'Logan', 'sedan'],
      ['duster', 'داستر', 'Duster', 'suv'],
      ['megane', 'ميجان', 'Megane', 'sedan'],
    ],
  },
  {
    slug: 'mg',
    ar: 'إم جي',
    en: 'MG',
    models: [
      ['mg5', 'إم جي 5', 'MG5', 'sedan'],
      ['zs', 'زد إس', 'ZS', 'crossover'],
      ['rx5', 'آر إكس 5', 'RX5', 'suv'],
    ],
  },
  {
    slug: 'mercedes-benz',
    ar: 'مرسيدس بنز',
    en: 'Mercedes-Benz',
    models: [
      ['c-class', 'سي كلاس', 'C-Class', 'luxury'],
      ['e-class', 'إي كلاس', 'E-Class', 'luxury'],
      ['v-class', 'في كلاس', 'V-Class', 'minivan'],
      ['gle', 'جي إل إي', 'GLE', 'luxury'],
    ],
  },
  {
    slug: 'bmw',
    ar: 'بي إم دبليو',
    en: 'BMW',
    models: [
      ['3-series', 'الفئة الثالثة', '3 Series', 'luxury'],
      ['5-series', 'الفئة الخامسة', '5 Series', 'luxury'],
      ['x5', 'إكس 5', 'X5', 'luxury'],
    ],
  },
  {
    slug: 'peugeot',
    ar: 'بيجو',
    en: 'Peugeot',
    models: [
      ['301', '301', '301', 'sedan'],
      ['3008', '3008', '3008', 'suv'],
      ['5008', '5008', '5008', 'suv'],
    ],
  },
  {
    slug: 'skoda',
    ar: 'سكودا',
    en: 'Skoda',
    models: [
      ['octavia', 'أوكتافيا', 'Octavia', 'sedan'],
      ['kodiaq', 'كودياك', 'Kodiaq', 'suv'],
    ],
  },
  {
    slug: 'chery',
    ar: 'شيري',
    en: 'Chery',
    models: [
      ['tiggo-7', 'تيجو 7', 'Tiggo 7', 'suv'],
      ['arrizo-5', 'أريزو 5', 'Arrizo 5', 'sedan'],
    ],
  },
  {
    slug: 'mitsubishi',
    ar: 'ميتسوبيشي',
    en: 'Mitsubishi',
    models: [
      ['lancer', 'لانسر', 'Lancer', 'sedan'],
      ['xpander', 'إكسباندر', 'Xpander', 'minivan'],
      ['pajero', 'باجيرو', 'Pajero', 'suv'],
    ],
  },
  {
    slug: 'suzuki',
    ar: 'سوزوكي',
    en: 'Suzuki',
    models: [
      ['swift', 'سويفت', 'Swift', 'hatchback'],
      ['dzire', 'ديزاير', 'Dzire', 'sedan'],
      ['ertiga', 'إرتيجا', 'Ertiga', 'minivan'],
    ],
  },
  {
    slug: 'jeep',
    ar: 'جيب',
    en: 'Jeep',
    models: [
      ['grand-cherokee', 'جراند شيروكي', 'Grand Cherokee', 'suv'],
      ['wrangler', 'رانجلر', 'Wrangler', 'suv'],
    ],
  },
  { slug: 'fiat', ar: 'فيات', en: 'Fiat', models: [['tipo', 'تيبو', 'Tipo', 'sedan']] },
];

export const PLANS = [
  {
    code: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    priceMonthlyEgp: 0,
    maxLiveListings: null,
    maxTeamMembers: 3,
    featuredCreditsPerMonth: 0,
    isActive: true,
    sortOrder: 0,
  },
  {
    code: 'pro',
    nameAr: 'احترافي',
    nameEn: 'Pro',
    priceMonthlyEgp: 1499,
    maxLiveListings: 60,
    maxTeamMembers: 8,
    featuredCreditsPerMonth: 4,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'fleet',
    nameAr: 'أسطول',
    nameEn: 'Fleet',
    priceMonthlyEgp: 3999,
    maxLiveListings: null,
    maxTeamMembers: 25,
    featuredCreditsPerMonth: 12,
    isActive: true,
    sortOrder: 2,
  },
];
