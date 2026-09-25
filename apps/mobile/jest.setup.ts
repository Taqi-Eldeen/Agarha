// Native modules without a JS fallback in the Jest environment.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// react-native-maps is native-only; render its components as plain views in tests.
// jest.mock factories can't reference imports, so types come from import() here.
/* eslint-disable @typescript-eslint/consistent-type-imports */
jest.mock('react-native-maps', () => {
  const { forwardRef, createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const MapView = forwardRef((props: object, ref) =>
    createElement(View, { ...props, ref } as object),
  );
  const Marker = (props: object) => createElement(View, props);
  return { __esModule: true, default: MapView, Marker };
});
/* eslint-enable @typescript-eslint/consistent-type-imports */
