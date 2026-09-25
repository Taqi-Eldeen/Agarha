import argon2 from 'argon2';
import { z } from 'zod';

/** argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1). */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);
export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain).catch(() => false);

/** ASVS 2.1: min 8 chars (we ask 10), no composition rules, max 128, block the most common ones. */
const COMMON = new Set([
  '1234567890',
  '0123456789',
  'password12',
  'qwertyuiop',
  '1111111111',
  'agarha1234',
  '12345678910',
]);
export const passwordSchema = z
  .string()
  .min(10, 'password_too_short')
  .max(128)
  .refine((p) => !COMMON.has(p.toLowerCase()), 'password_too_common');

/** A real hash computed once, so unknown phones cost the same time as known ones. */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword('agarha-timing-equaliser'));
