// Expo's default config already handles pnpm monorepos (watchFolders, node_modules resolution).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css', inlineRem: 16 });

// `pnpm storybook` turns this on; otherwise Storybook is removed from the bundle.
module.exports = withStorybook(config, { enabled: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true', configPath: './.rnstorybook' });
