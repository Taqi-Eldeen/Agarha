// Thin wrappers over node:crypto primitives. No custom algorithms: HMAC-SHA256, SHA-256,
// CSPRNG integers/bytes and constant-time comparison only.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const hmac = (key: string, value: string): string =>
  createHmac('sha256', key).update(value).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Uniform numeric code, e.g. 6 digits "004281". */
export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(0, 10));
  return out;
}

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Crockford-style alphabet without ambiguous characters (no 0/O, 1/I/L). */
const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function randomRef(length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) out += REF_ALPHABET[randomInt(0, REF_ALPHABET.length)];
  return out;
}
