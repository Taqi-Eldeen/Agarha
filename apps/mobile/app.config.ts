import type { ConfigContext, ExpoConfig } from 'expo/config';

// One config for three variants (development, preview, production) so they install side by side.
const APP_ENV = (process.env.APP_ENV ?? 'development') as 'development' | 'preview' | 'production';
const PROD = APP_ENV === 'production';
const ID = PROD ? 'com.agarha.app' : `com.agarha.app.${APP_ENV}`;
const WEB_HOST = process.env.EXPO_PUBLIC_WEB_HOST ?? 'agarha.com';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

// Deep links: listing, dealer, search and landing pages open in the app (Android App Links + iOS Universal Links).
const LINK_PREFIXES = ['/ar/cars', '/en/cars', '/ar/dealers', '/en/dealers', '/ar/search', '/en/search'];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: PROD ? 'Agarha' : `Agarha (${APP_ENV})`,
  slug: 'agarha',
  owner: process.env.EXPO_OWNER,
  scheme: 'agarha',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#F4F7F6',
  primaryColor: '#0F6E68',
  // App name per device language (store listing copy lives in store/).
  locales: { ar: './store/locales/ar.json', en: './store/locales/en.json' },
  ios: {
    bundleIdentifier: ID,
    buildNumber: '1',
    supportsTablet: false,
    associatedDomains: [`applinks:${WEB_HOST}`],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ['ar', 'en'],
      CFBundleDevelopmentRegion: 'ar',
      LSApplicationQueriesSchemes: ['whatsapp', 'tel'],
    },
    // Required-reason APIs (App Store privacy manifest). No tracking, no tracking domains.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
    },
  },
  android: {
    package: ID,
    versionCode: 1,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', monochromeImage: './assets/adaptive-icon-mono.png', backgroundColor: '#0F6E68' },
    // Coarse location only: "near me" needs the area, not the exact spot.
    permissions: ['ACCESS_COARSE_LOCATION'],
    blockedPermissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.RECORD_AUDIO', 'android.permission.READ_CONTACTS'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: LINK_PREFIXES.map((pathPrefix) => ({ scheme: 'https', host: WEB_HOST, pathPrefix })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '' } },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#F4F7F6', dark: { image: './assets/splash-icon.png', backgroundColor: '#0F1519' } }],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#0F6E68', defaultChannel: 'default' }],
    ['expo-location', { locationWhenInUsePermission: 'Agarha uses your location only to show rental cars near you. / أجّرها بيستخدم موقعك بس عشان يوريك العربيات القريبة منك.' }],
    ['expo-build-properties', { android: { minSdkVersion: 26 }, ios: { deploymentTarget: '16.4' } }],
  ],
  experiments: { typedRoutes: true },
  runtimeVersion: { policy: 'appVersion' },
  ...(EAS_PROJECT_ID ? { updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } } : {}),
  extra: { appEnv: APP_ENV, webHost: WEB_HOST, ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}) },
});
