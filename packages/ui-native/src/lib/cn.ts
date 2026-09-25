/** Joins class names, skipping falsy parts (no tailwind-merge: NativeWind resolves the last class). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
