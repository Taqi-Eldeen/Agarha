import { webPathToAppPath } from '@/lib/links';

/**
 * Universal / App Links arrive with website paths (/ar/cars/<id>-<slug>). Rewrite them to app routes
 * before the router resolves them; unknown pages land on Explore.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('agarha://')) return path.replace('agarha://', '/');
  return webPathToAppPath(path) ?? '/';
}
