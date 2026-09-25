// Opaque cursors: base64url(JSON). Keyset pagination only, never OFFSET.
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
