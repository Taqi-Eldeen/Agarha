'use client';
import { Button, InlineAlert, OTPField, TextField } from '@agarha/ui-web';
import { useRouter } from 'next/navigation';
import TotpEnroll from './qr';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Step =
  | { k: 'sso' }
  | { k: 'totp'; loginToken: string }
  | { k: 'setup'; setupToken: string; secret: string; uri: string };
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_ADMIN_GOOGLE_CLIENT_ID;
const DEV = process.env.NEXT_PUBLIC_ADMIN_DEV_LOGIN === 'true';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** Google Workspace SSO (hd-restricted) → TOTP. The API also enforces an IP allowlist. */
export default function SignIn() {
  const { t, locale } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ k: 'sso' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const afterSso = (r: {
    next: 'totp' | 'totp_setup';
    loginToken?: string;
    setupToken?: string;
    totp?: { secret: string; uri: string };
  }) =>
    setStep(
      r.next === 'totp'
        ? { k: 'totp', loginToken: r.loginToken! }
        : { k: 'setup', setupToken: r.setupToken!, secret: r.totp!.secret, uri: r.totp!.uri },
    );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step.k !== 'sso') return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        hd: 'agarha.com',
        callback: async ({ credential }: { credential: string }) => {
          try {
            afterSso(
              await adminFetch('/auth/admin/google', {
                method: 'POST',
                json: { idToken: credential },
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        },
      });
      const el = document.getElementById('g-signin');
      if (el)
        window.google?.accounts.id.renderButton(el, { theme: 'outline', size: 'large', locale });
    };
    document.head.appendChild(s);
  }, [step.k, locale]);

  const submitCode = async (c: string) => {
    setBusy(true);
    setError(undefined);
    try {
      if (step.k === 'totp')
        await adminFetch('/auth/admin/totp', {
          method: 'POST',
          json: { loginToken: step.loginToken, code: c },
        });
      if (step.k === 'setup')
        await adminFetch('/auth/admin/totp/setup', {
          method: 'POST',
          json: { setupToken: step.setupToken, code: c },
        });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-h1">{t('auth.title')}</h1>
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
      {step.k === 'sso' ? (
        <>
          {GOOGLE_CLIENT_ID ? <div id="g-signin" aria-label={t('auth.google')} /> : null}
          {DEV ? (
            <form
              className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  afterSso(
                    await adminFetch('/auth/admin/dev-login', { method: 'POST', json: { email } }),
                  );
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <p className="text-caption text-fg-secondary">{t('auth.dev')}</p>
              <TextField
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
              <Button type="submit">{t('common.next')}</Button>
            </form>
          ) : null}
        </>
      ) : null}
      {step.k === 'setup' ? (
        <TotpEnroll uri={step.uri} secret={step.secret} title={t('auth.setup')} />
      ) : null}
      {step.k !== 'sso' ? (
        <OTPField
          label={t('auth.totp')}
          value={code}
          onChange={setCode}
          onComplete={(c) => void submitCode(c)}
          disabled={busy}
        />
      ) : null}
    </main>
  );
}
