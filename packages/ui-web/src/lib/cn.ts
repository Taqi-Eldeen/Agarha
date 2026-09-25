import { type ClassValue, clsx } from 'clsx';

/**
 * Class joiner. Deliberately no tailwind-merge (~7 KB gzipped on every page): components never
 * pass conflicting utilities (e.g. IconButton has its own size/shape classes instead of overriding
 * Button's), so plain concatenation is enough.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
