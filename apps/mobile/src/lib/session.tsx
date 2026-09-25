import { keys } from '@agarha/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { identify } from './analytics';
import { api } from './api';
import { tokenStore } from './tokens';

interface Session {
  /** null while SecureStore is read at startup. */
  signedIn: boolean | null;
  completeSignIn: (tokens: { accessToken: string; refreshToken: string }, userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    void tokenStore.get().then((t) => setSignedIn(!!t));
    return tokenStore.subscribe((v) => {
      setSignedIn(v);
      if (!v) qc.removeQueries({ queryKey: keys.me });
    });
  }, [qc]);
  const completeSignIn = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }, userId: string) => {
      await tokenStore.set(tokens);
      identify(userId);
      await qc.invalidateQueries();
    },
    [qc],
  );
  const signOut = useCallback(async () => {
    const t = await tokenStore.get();
    await api.POST('/v1/auth/sign-out', { body: { refreshToken: t?.refreshToken, client: 'mobile' } }).catch(() => undefined);
    await tokenStore.set(null);
    identify(null);
    qc.clear();
  }, [qc]);
  const value = useMemo(() => ({ signedIn, completeSignIn, signOut }), [signedIn, completeSignIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used inside <SessionProvider>');
  return c;
}
