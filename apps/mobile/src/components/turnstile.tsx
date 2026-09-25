import type { Locale } from '@agarha/schemas';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { env, webOrigin } from '@/lib/env';

/**
 * Cloudflare Turnstile inside a WebView served from the web origin (the site key is bound to that
 * hostname). Invisible unless Cloudflare needs an interaction. Posts the token back to the app.
 */
export function Turnstile({ onToken, locale }: { onToken: (token: string | null) => void; locale: Locale }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=go&render=explicit" async defer></script></head>
<body style="margin:0;display:flex;justify-content:center;background:transparent"><div id="t"></div><script>
function send(t){window.ReactNativeWebView.postMessage(JSON.stringify({token:t}))}
function go(){turnstile.render('#t',{sitekey:${JSON.stringify(env.turnstileSiteKey)},language:${JSON.stringify(locale)},appearance:'interaction-only',callback:send,'expired-callback':function(){send(null)},'error-callback':function(){send(null)}})}
</script></body></html>`;
  return (
    <View style={{ height: 72 }} importantForAccessibility="no-hide-descendants">
      <WebView
        originWhitelist={['https://*']}
        source={{ html, baseUrl: webOrigin() }}
        onMessage={(e) => {
          try {
            onToken((JSON.parse(e.nativeEvent.data) as { token: string | null }).token);
          } catch {
            onToken(null);
          }
        }}
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
