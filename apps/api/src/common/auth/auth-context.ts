import type { Role } from '@agarha/schemas';

export type SessionScope = 'customer' | 'dealer' | 'admin';

export interface AuthContext {
  userId: string;
  scope: SessionScope;
  roles: Role[];
  /** Set for dealer-scope sessions. */
  dealerId?: string;
  /** Refresh-token family, used for sign-out. */
  sessionId: string;
}
