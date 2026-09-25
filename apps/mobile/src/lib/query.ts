import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: 24 * 3_600_000 } } });

/** Results, listings and favourites survive restarts and show offline; private/volatile keys don't. */
const PERSISTED = new Set(['search', 'listing', 'dealer', 'cities', 'favorites', 'saved-searches']);
export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'agarha.query-cache', throttleTime: 2_000 }),
  maxAge: 24 * 3_600_000,
  buster: '1',
  dehydrateOptions: { shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])) },
};
