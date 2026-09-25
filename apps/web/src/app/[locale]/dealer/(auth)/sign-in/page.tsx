'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { normalizeEgyptMobile } from '@agarha/schemas/phone';
import { Button, InlineAlert, OTPField, PhoneField, TextField } from '@agarha/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { TotpSetup } from '@/components/dealer/totp-setup';
import { OtpSignIn } from '@/components/otp-sign-in';
import { Turnstile } from '@/components/turnstile';
import { Link, useRouter } from '@/i18n/routing';

type Step =
  | { k: 'password' }
  | { k: 'second'; factor: 'totp' | 'otp'; loginToken: string; challengeId?: string }
  | { k: 'setup'; setupToken: string; uri: string; secret: string }
  | { k: 'forgot' }
  | { k: 'reset'; proof: string };

export default function DealerSignIn() {
  const t = useTranslations('dealer.auth');
  const te = useTranslations('errors');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ k: 'password' });
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const onToken = useCallback((tok: string | null) => setCaptcha(tok), []);
  const err = (e: unknown) => {
    const c = (e as ApiRequestError).code;
    return (e as ApiRequestError).status === 401
      ? t('wrongCredentials')
      : te.has(c)
        ? te(c)
        : te('internal_error');
  };
  const done = async () => {
    await qc.invalidateQueries();
    router.replace('/dealer/fleet');
  };

  if (step.k === 'password')
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const e164 = normalizeEgyptMobile(phone);
          if (!e164) return setError(te('invalid_egypt_mobile'));
          const p = { data: e164 };
          setBusy(true);
          setError(undefined);
          try {
            const { data } = await api.POST('/v1/auth/dealer/login', {
              body: { phone: p.data, password, turnstileToken: captcha ?? '', locale },
            });
            const r = data as unknown as {
              next: 'totp' | 'otp' | 'totp_setup';
              loginToken?: string;
              challengeId?: string;
              setupToken?: string;
              totp?: { uri: string; secret: string };
            };
            if (r.next === 'totp_setup')
              setStep({
                k: 'setup',
                setupToken: r.setupToken!,
                uri: r.totp!.uri,
                secret: r.totp!.secret,
              });
            else
              setStep({
                k: 'second',
                factor: r.next,
                loginToken: r.loginToken!,
                ...(r.challengeId ? { challengeId: r.challengeId } : {}),
              });
          } catch (e2) {
            setError(err(e2));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-h1">{t('title')}</h1>
        {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
        <PhoneField
          label={t('phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="username"
        />
        <TextField
          label={t('password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Turnstile onToken={onToken} locale={locale} />
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <Button type="submit" loading={busy} disabled={!captcha} block>
          {t('signIn')}
        </Button>
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            className="min-h-touch text-brand underline"
            onClick={() => setStep({ k: 'forgot' })}
          >
            {t('forgot')}
          </button>
          <Link
            href="/dealer/sign-up"
            className="inline-flex min-h-touch items-center text-brand underline"
          >
            {t('noAccount')}
          </Link>
        </div>
      </form>
    );

  if (step.k === 'second')
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">{step.factor === 'totp' ? t('totpTitle') : t('smsTitle')}</h1>
        <p className="text-fg-secondary">{step.factor === 'totp' ? t('totpBody') : t('smsBody')}</p>
        <OTPField
          label={step.factor === 'totp' ? t('totpTitle') : t('smsTitle')}
          value={code}
          onChange={setCode}
          error={error}
          disabled={busy}
          onComplete={async (c) => {
            setBusy(true);
            setError(undefined);
            try {
              await api.POST('/v1/auth/dealer/login/verify', {
                body: {
                  loginToken: step.loginToken,
                  code: c,
                  client: 'web',
                  ...(step.challengeId ? { challengeId: step.challengeId } : {}),
                },
              });
              await done();
            } catch (e2) {
              setError(err(e2));
              setCode('');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    );

  if (step.k === 'setup')
    return (
      <TotpSetup
        uri={step.uri}
        secret={step.secret}
        busy={busy}
        error={error}
        onCode={async (c) => {
          setBusy(true);
          try {
            await api.POST('/v1/auth/dealer/totp/confirm', {
              body: { setupToken: step.setupToken, code: c, client: 'web' },
            });
            await done();
          } catch (e2) {
            setError(err(e2));
          } finally {
            setBusy(false);
          }
        }}
      />
    );

  if (step.k === 'forgot')
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">{t('reset')}</h1>
        <OtpSignIn
          purpose="dealer_sign_in"
          onDone={({ phoneProof }) => setStep({ k: 'reset', proof: phoneProof! })}
        />
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.POST('/v1/auth/dealer/password/reset', {
            body: { phoneProof: step.proof, password },
          });
          setNotice(t('resetDone'));
          setPassword('');
          setStep({ k: 'password' });
        } catch (e2) {
          setError(err(e2));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-h1">{t('reset')}</h1>
      <TextField
        label={t('newPassword')}
        hint={t('passwordHint')}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={10}
        autoComplete="new-password"
        error={error}
      />
      <Button type="submit" loading={busy} block>
        {t('reset')}
      </Button>
    </form>
  );
}
