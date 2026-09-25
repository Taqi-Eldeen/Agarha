// TOTP via otplib (RFC 6238) + AES-256-GCM at rest via node:crypto. No custom crypto.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { authenticator } from 'otplib';

authenticator.options = { window: 1, step: 30 };

export function newTotpSecret(): string {
  return authenticator.generateSecret(20);
}

export function totpUri(secret: string, account: string): string {
  return authenticator.keyuri(account, 'Agarha', secret);
}

/**
 * Verifies a code and returns the accepted time-step, or null.
 * The caller stores the step and rejects any code at or before it (replay protection).
 */
export function verifyTotp(
  secret: string,
  code: string,
  lastStep: number | null,
  now = Date.now(),
): number | null {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  const step = Math.floor(now / 30_000) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

export function currentTotp(secret: string): string {
  return authenticator.generate(secret);
}

const key = (b64: string) => {
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes base64');
  return k;
};

export function encryptSecret(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(keyB64), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join(':');
}

export function decryptSecret(payload: string, keyB64: string): string {
  const [iv, tag, enc] = payload.split(':').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !enc) throw new Error('bad ciphertext');
  const d = createDecipheriv('aes-256-gcm', key(keyB64), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
