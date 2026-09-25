'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { Button, TextField } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TotpSetup } from '@/components/dealer/totp-setup';
import { OtpSignIn } from '@/components/otp-sign-in';
import { Link, useRouter } from '@/i18n/routing';
import { track } from '@/lib/analytics';

type Step =
  | { k: 'phone' }
  | { k: 'details'; proof: string }
  | { k: 'totp'; setupToken: string; uri: string; secret: string };

export default function DealerSignUp() {
  const t = useTranslations('dealer.auth');
  const te = useTranslations('errors');
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ k: 'phone' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (step.k === 'phone')
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">{t('signUpTitle')}</h1>
        <OtpSignIn
          purpose="dealer_sign_up"
          onDone={({ phoneProof }) => {
            track('dealer_signup_started', {});
            setStep({ k: 'details', proof: phoneProof! });
          }}
        />
        <Link href="/dealer/sign-in" className="text-brand underline">
          {t('haveAccount')}
        </Link>
      </div>
    );

  if (step.k === 'details')
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const { data } = await api.POST('/v1/auth/dealer/register', {
              body: { phoneProof: step.proof, password, displayName: name },
            });
            const r = data as unknown as {
              setupToken: string;
              totp: { uri: string; secret: string };
            };
            setStep({
              k: 'totp',
              setupToken: r.setupToken,
              uri: r.totp.uri,
              secret: r.totp.secret,
            });
          } catch (err) {
            const e2 = err as ApiRequestError;
            setError(e2.message || te('internal_error'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-h1">{t('signUpTitle')}</h1>
        <TextField
          label={t('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
        />
        <TextField
          label={t('password')}
          hint={t('passwordHint')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
          autoComplete="new-password"
          error={error}
        />
        <Button type="submit" loading={busy} block>
          {t('signUp')}
        </Button>
      </form>
    );

  return (
    <TotpSetup
      uri={step.uri}
      secret={step.secret}
      busy={busy}
      error={error}
      onCode={async (code) => {
        setBusy(true);
        setError(undefined);
        try {
          await api.POST('/v1/auth/dealer/totp/confirm', {
            body: { setupToken: step.setupToken, code, client: 'web' },
          });
          router.replace('/dealer/onboarding');
        } catch {
          setError(te('otp_invalid'));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
