import { ApiRequestError, useApi } from '@agarha/api-client';
import { normalizeEgyptMobile } from '@agarha/schemas/phone';
import { Button, InlineAlert, OTPField, PhoneField, Text } from '@agarha/ui-native';
import { useRouter } from 'expo-router';
import { SocialButtons } from '@/components/social-buttons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Screen } from '@/components/screen';
import { Turnstile } from '@/components/turnstile';
import { track } from '@/lib/analytics';
import { useLocale } from '@/lib/i18n';
import { registerPush } from '@/lib/push';
import { useSession } from '@/lib/session';

type Step = { k: 'phone' } | { k: 'code'; challengeId: string; e164: string; channel: 'sms' | 'whatsapp'; resendAt: number };

/** Customer sign-in: phone → Turnstile → OTP (SMS, WhatsApp fallback) → tokens in SecureStore. */
export default function SignIn() {
  const t = useTranslations();
  const api = useApi();
  const router = useRouter();
  const { locale } = useLocale();
  const { completeSignIn } = useSession();
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ k: 'phone' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  /** Set when Google/Apple sign-in needs the phone confirmed once (first use). */
  const [linkToken, setLinkToken] = useState<string | null>(null);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const message = (e: unknown) => {
    const c = e instanceof ApiRequestError ? e.code : 'internal_error';
    return t.has(`errors.${c}`) ? t(`errors.${c}` as never) : t('errors.internal_error');
  };

  const send = async (channel: 'sms' | 'whatsapp') => {
    const e164 = normalizeEgyptMobile(phone);
    if (!e164) return setError(t('errors.invalid_egypt_mobile'));
    if (!token) return;
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.POST('/v1/auth/otp/request', { body: { phone: e164, purpose: 'customer_sign_in', channel, locale, turnstileToken: token } });
      setStep({ k: 'code', challengeId: data!.challengeId, e164, channel: data!.channel, resendAt: Date.now() + data!.resendAfterSeconds * 1000 });
      setCode('');
      track('otp_requested', { channel });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (c: string) => {
    if (step.k !== 'code') return;
    setBusy(true);
    setError(undefined);
    try {
      const verifyBody = { challengeId: step.challengeId, phone: step.e164, code: c, client: 'mobile' as const };
      const { data } = linkToken ? await api.POST('/v1/auth/social/link', { body: { ...verifyBody, linkToken } }) : await api.POST('/v1/auth/otp/verify', { body: verifyBody });
      const body = data as unknown as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } };
      await completeSignIn(body.tokens, body.user.id);
      track('signed_in', { method: linkToken ? 'social_link' : 'otp' });
      void registerPush(locale).catch(() => undefined);
      router.back();
    } catch (e) {
      setError(message(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View className="gap-2">
        <Text variant="h2" accessibilityRole="header">{t('web.account.signInTitle')}</Text>
        <Text tone="secondary">{t('web.account.signInBody')}</Text>
      </View>
      {step.k === 'phone' && !linkToken ? (
        <SocialButtons
          onSignedIn={async (tokens, userId) => {
            await completeSignIn(tokens, userId);
            void registerPush(locale).catch(() => undefined);
            router.back();
          }}
          onPhoneRequired={setLinkToken}
          onError={(m) => setError(m)}
        />
      ) : null}
      {linkToken && step.k === 'phone' ? <InlineAlert tone="info">{t('app.auth.linkPhone')}</InlineAlert> : null}
      {step.k === 'phone' ? (
        <View className="gap-4">
          <PhoneField label={t('auth.phoneLabel')} hint={t('auth.phoneHint')} value={phone} onChangeText={setPhone} error={error} testID="phone-input" />
          <Turnstile locale={locale} onToken={setToken} />
          <Button block loading={busy} disabled={!token || phone.length < 10} onPress={() => void send('sms')}>
            {token ? t('auth.sendCode') : t('web.account.captcha')}
          </Button>
          <Text variant="caption" tone="secondary">{t('web.account.consent')}</Text>
        </View>
      ) : (
        <View className="gap-4">
          <InlineAlert tone="info">{t(step.channel === 'sms' ? 'auth.codeSentSms' : 'auth.codeSentWhatsapp', { phone: step.e164 })}</InlineAlert>
          <OTPField label={t('auth.codeLabel')} value={code} onChange={setCode} onComplete={(c) => void verify(c)} error={error} disabled={busy} />
          <Button block loading={busy} disabled={code.length !== 6} onPress={() => void verify(code)}>
            {t('auth.verify')}
          </Button>
          {now < step.resendAt ? (
            <Text variant="caption" tone="secondary" className="text-center">{t('auth.resendIn', { seconds: Math.ceil((step.resendAt - now) / 1000) })}</Text>
          ) : (
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button size="sm" variant="ghost" onPress={() => void send('sms')}>
                {t('auth.resend')}
              </Button>
              <Button size="sm" variant="ghost" onPress={() => void send('whatsapp')}>
                {t('auth.useWhatsapp')}
              </Button>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
