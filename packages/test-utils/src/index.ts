// Deterministic factories for tests and seeds. Never produce real-looking national IDs.
let seq = 0;
export const nextSeq = () => ++seq;

/** Egyptian mobile in the 010 range reserved for tests (0100000xxxx). */
export function fakeMobile(n = nextSeq()): string {
  return `+2010000${String(n % 10000).padStart(4, '0')}`;
}

export function fakeMobileNational(n = nextSeq()): string {
  return fakeMobile(n).replace('+20', '0');
}
