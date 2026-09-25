import AsyncStorage from '@react-native-async-storage/async-storage';

/** Non-sensitive preferences only (locale, recent searches, onboarding flag). Failures are ignored. */
export const prefs = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(`agarha.${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(`agarha.${key}`, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: preferences are best-effort */
    }
  },
};

export interface RecentSearch {
  city: string;
  label: string;
  type?: string;
}

export async function addRecent(r: RecentSearch) {
  const list = await prefs.get<RecentSearch[]>('recent', []);
  const next = [r, ...list.filter((x) => x.city !== r.city || x.type !== r.type)].slice(0, 5);
  await prefs.set('recent', next);
  return next;
}
