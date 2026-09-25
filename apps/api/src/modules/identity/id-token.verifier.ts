import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ENV, type Env } from '../../config/env';
import { Errors } from '../../common/errors';
import type { IdTokenProvider, IdTokenVerifier, VerifiedIdToken } from './ports';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/** Verifies Google / Apple ID tokens against the providers' published keys (jose). */
@Injectable()
export class JoseIdTokenVerifier implements IdTokenVerifier {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async verify(provider: IdTokenProvider, idToken: string): Promise<VerifiedIdToken> {
    try {
      if (provider === 'apple') {
        if (!this.env.APPLE_CLIENT_IDS.length) throw new Error('apple sign-in not configured');
        const { payload } = await jwtVerify(idToken, APPLE_JWKS, { issuer: 'https://appleid.apple.com', audience: this.env.APPLE_CLIENT_IDS });
        return {
          subject: String(payload.sub),
          ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
          emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        };
      }
      const audience = provider === 'google_workspace' ? this.env.ADMIN_GOOGLE_CLIENT_ID : this.env.GOOGLE_CLIENT_IDS;
      if (!audience || (Array.isArray(audience) && !audience.length)) throw new Error('google sign-in not configured');
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience });
      return {
        subject: String(payload.sub),
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
        emailVerified: payload.email_verified === true,
        ...(typeof payload.hd === 'string' ? { hostedDomain: payload.hd } : {}),
      };
    } catch {
      throw Errors.unauthorized('Invalid identity token');
    }
  }
}
