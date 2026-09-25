// Fixed clock so freshness chips and relative times are deterministic.
jest.useFakeTimers({
  now: new Date('2026-09-20T10:00:00Z'),
  doNotFake: ['nextTick', 'setImmediate'],
});

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
