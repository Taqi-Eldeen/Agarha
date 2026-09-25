import type { TokenStore } from '@agarha/api-client';
import * as SecureStore from 'expo-secure-store';

type Tokens = { accessToken: string; refreshToken: string };
const KEY = 'agarha.customer.tokens';

let cache: Tokens | null | undefined;
const listeners = new Set<(signedIn: boolean) => void>();

/** Customer tokens live in the Keychain / Keystore (never AsyncStorage). */
export const tokenStore: TokenStore & { subscribe: (fn: (signedIn: boolean) => void) => () => void } = {
  async get() {
    if (cache === undefined) {
      const raw = await SecureStore.getItemAsync(KEY);
      cache = raw ? (JSON.parse(raw) as Tokens) : null;
    }
    return cache;
  },
  async set(tokens) {
    cache = tokens;
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
    listeners.forEach((fn) => fn(!!tokens));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
