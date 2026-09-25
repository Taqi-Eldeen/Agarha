import { randomBytes } from 'node:crypto';
import { currentTotp, decryptSecret, encryptSecret, newTotpSecret, verifyTotp } from './totp';

describe('totp', () => {
  const key = randomBytes(32).toString('base64');
  it('round-trips encryption', () => {
    const s = newTotpSecret();
    const enc = encryptSecret(s, key);
    expect(enc).not.toContain(s);
    expect(decryptSecret(enc, key)).toBe(s);
  });
  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('secret', key).split(':');
    enc[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(enc.join(':'), key)).toThrow();
  });
  it('accepts a current code once (no replay)', () => {
    const s = newTotpSecret();
    const code = currentTotp(s);
    const step = verifyTotp(s, code, null);
    expect(step).not.toBeNull();
    expect(verifyTotp(s, code, step)).toBeNull();
  });
  it('rejects a wrong code', () => {
    expect(verifyTotp(newTotpSecret(), '000000', null)).toBeNull();
  });
});
