// Fixed clock so freshness chips and relative times are deterministic.
jest.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
