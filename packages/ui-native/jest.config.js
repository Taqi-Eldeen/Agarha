/** Component tests run under jest-expo (React Native renderer, no device). */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Jest 29 doesn't transform .mjs; use lucide's CommonJS build in tests.
  moduleNameMapper: { '^lucide-react-native$': require.resolve('lucide-react-native') },
  transformIgnorePatterns: ['node_modules/(?!(?:.pnpm/)?((jest-)?react-native|(?:@react-native(-community)?|@expo(nent)?|@expo-google-fonts|@formatjs|@schummar|@tanstack|@agarha)[+/].*|expo(nent)?|expo-.*|nativewind|react-native-css-interop|lucide-react-native|use-intl|intl-messageformat|icu-minify))'],
};
