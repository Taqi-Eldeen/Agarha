import { useApi } from '@agarha/api-client';
import { Button, Text } from '@agarha/ui-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useLocale } from '@/lib/i18n';

WebBrowser.maybeCompleteAuthSession();

type Tokens = { accessToken: string; refreshToken: string };
type SocialResult =
  | { status: 'signed_in'; user: { id: string }; tokens: Tokens }
  | { status: 'phone_required'; linkToken: string };

const GOOGLE = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};
const googleConfigured = Platform.OS === 'ios' ? !!GOOGLE.iosClientId : !!GOOGLE.androidClientId;

/**
 * Optional Google / Apple sign-in. Sign in with Apple is always offered on iOS next to Google
 * (App Store guideline 4.8). The first social sign-in confirms the phone by OTP (linkToken).
 */
export function SocialButtons({
  onSignedIn,
  onPhoneRequired,
  onError,
}: {
  onSignedIn: (t: Tokens, userId: string) => Promise<void>;
  onPhoneRequired: (linkToken: string) => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations();
  const api = useApi();
  const { locale } = useLocale();
  const [apple, setApple] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setApple);
  }, []);

  const exchange = async (provider: 'google' | 'apple', idToken: string) => {
    try {
      const { data } = await api.POST('/v1/auth/social', {
        body: { provider, idToken, client: 'mobile' },
      });
      const r = data as unknown as SocialResult;
      if (r.status === 'signed_in') await onSignedIn(r.tokens, r.user.id);
      else onPhoneRequired(r.linkToken);
    } catch {
      onError(t('errors.internal_error'));
    }
  };

  if (!apple && !googleConfigured) return null;
  return (
    <View className="gap-3">
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={{ height: 48 }}
          onPress={async () => {
            try {
              const cred = await AppleAuthentication.signInAsync({
                requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
              });
              if (cred.identityToken) await exchange('apple', cred.identityToken);
            } catch (e) {
              if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED')
                onError(t('errors.internal_error'));
            }
          }}
        />
      ) : null}
      {googleConfigured ? (
        <GoogleButton
          label={t('app.auth.google')}
          locale={locale}
          onIdToken={(tok) => void exchange('google', tok)}
        />
      ) : null}
      <Text variant="caption" tone="secondary" className="text-center">
        {t('app.auth.or')}
      </Text>
    </View>
  );
}

function GoogleButton({
  label,
  locale,
  onIdToken,
}: {
  label: string;
  locale: string;
  onIdToken: (token: string) => void;
}) {
  const [request, response, prompt] = Google.useIdTokenAuthRequest({ ...GOOGLE, language: locale });
  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token)
      onIdToken(response.params.id_token);
  }, [response, onIdToken]);
  return (
    <Button variant="secondary" disabled={!request} onPress={() => void prompt()}>
      {label}
    </Button>
  );
}
