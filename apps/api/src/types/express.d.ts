import type { AuthContext } from '../common/auth/auth-context';

declare global {
  namespace Express {
    interface Request {
      id?: string | number;
      auth?: AuthContext;
    }
  }
}
export {};
