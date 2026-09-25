'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { normalizeEgyptMobile } from '@agarha/schemas/phone';
import { Button, InlineAlert, OTPField, PhoneField } from '@agarha/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { Turnstile } from './turnstile';

type Purpose = 'customer_sign_in' | 'dealer_sign_up' | 'dealer_sign_in';

/**
 * Phone → Turnstile → OTP. For customers it signs in (cookies); for dealer sign-up it returns a
 * phone proof to the caller. Resend is throttled client-side and server-side (3 / 15 min).
 */
export function OtpSignIn({ purpose = 'customer_sign_in', onDone }: { purpose?: Purpose; onDone: (result: { phoneProof?: string; phone: string }) => void }) {
  const t = useTranslations('auth');
  const tErr = useTranslations('errors');
  const tAcc = useTranslations('web.account');
  const locale = useLocale() as 'ar' | 'en';
  const api = useApi();
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ id: string; channel: 'sms' | 'whatsapp'; resendAt: number; phone: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const onToken = useCallback((tok: string | null) => setCaptcha(tok), []);

  useEffect(() => {
    if (!challenge) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [challenge]);

  const errorText = (e: unknown) => {
    const code = (e as ApiRequestError).code;
    return tErr.has(code) ? tErr(code) : tErr('internal_error');
  };

  const send = async (channel: 'sms' | 'whatsapp' = 'sms') => {
    const e164 = normalizeEgyptMobile(phone);
    const parsed = e164 ? { success: true as const, data: e164 } : null;
    if (!parsed) return setPhoneError(tErr('invalid_egypt_mobile'));
    setPhoneError(undefined);
    setError(undefined);
    setBusy(true);
    track('sign_in_started', { purpose });
    try {
      const { data } = await api.POST('/v1/auth/otp/request', { body: { phone: parsed.data, purpose, channel, locale, turnstileToken: captcha ?? '' } });
      setChallenge({ id: data!.challengeId, channel: data!.channel, resendAt: Date.now() + data!.resendAfterSeconds * 1000, phone: parsed.data });
      setCode('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (!challenge) return;
    setBusy(true);
    setError(undefined);
    try {
      if (purpose === 'customer_sign_in') {
        await api.POST('/v1/auth/otp/verify', { body: { challengeId: challenge.id, phone: challenge.phone, code: value, client: 'web' } });
        await qc.invalidateQueries();
        track('sign_in_completed', {});
        onDone({ phone: challenge.phone });
      } else {
        const { data } = await api.POST('/v1/auth/otp/proof', { body: { challengeId: challenge.id, phone: challenge.phone, code: value, client: 'web' } });
        onDone({ phoneProof: (data as unknown as { phoneProof: string }).phoneProof, phone: challenge.phone });
      }
    } catch (e) {
      setError(errorText(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (!challenge)
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <PhoneField label={t('phoneLabel')} hint={t('phoneHint')} value={phone} onChange={(e) => setPhone(e.target.value)} error={phoneError} autoFocus />
        <Turnstile onToken={onToken} locale={locale} />
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <Button type="submit" loading={busy} disabled={!captcha} block>
          {captcha ? t('sendCode') : tAcc('captcha')}
        </Button>
      </form>
    );

  const wait = Math.max(0, Math.ceil((challenge.resendAt - now) / 1000));
  return (
    <div className="flex flex-col gap-4">
      <p>{challenge.channel === 'sms' ? t('codeSentSms', { phone: challenge.phone }) : t('codeSentWhatsapp', { phone: challenge.phone })}</p>
      <OTPField label={t('codeLabel')} value={code} onChange={setCode} onComplete={(v) => void verify(v)} error={error} disabled={busy} />
      <Button onClick={() => void verify(code)} loading={busy} disabled={code.length !== 6} block>
        {t('verify')}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={wait > 0 || busy} onClick={() => void send('sms')}>
          {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
        </Button>
        <Button variant="ghost" size="sm" disabled={wait > 0 || busy} onClick={() => void send('whatsapp')}>
          {t('useWhatsapp')}
        </Button>
      </div>
    </div>
  );
}
