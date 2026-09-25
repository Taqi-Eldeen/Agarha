import type { Role } from '@agarha/schemas';

/** Implemented by the dealers module; lets identity build dealer sessions without reading dealer tables. */
export interface MembershipResolver {
  /** Memberships for a user, owner first. */
  memberships(userId: string): Promise<{ dealerId: string; role: Extract<Role, 'dealer_owner' | 'dealer_staff'>; dealerActive: boolean }[]>;
}
export const MEMBERSHIP_RESOLVER = Symbol('MEMBERSHIP_RESOLVER');

export interface VerifiedIdToken {
  subject: string;
  email?: string;
  emailVerified: boolean;
  hostedDomain?: string;
}
export type IdTokenProvider = 'google' | 'apple' | 'google_workspace';
export interface IdTokenVerifier {
  verify(provider: IdTokenProvider, idToken: string): Promise<VerifiedIdToken>;
}
export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');
