module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^lucide-react-native$': require.resolve('lucide-react-native') },
  transformIgnorePatterns: ['node_modules/(?!(?:.pnpm/)?((jest-)?react-native|(?:@react-native(-community)?|@expo(nent)?|@expo-google-fonts|@formatjs|@schummar|@tanstack|@agarha)[+/].*|expo(nent)?|expo-.*|nativewind|react-native-css-interop|lucide-react-native|use-intl|intl-messageformat|icu-minify|supercluster|kdbush))'],
};
