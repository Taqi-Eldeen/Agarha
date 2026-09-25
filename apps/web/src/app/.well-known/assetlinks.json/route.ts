// Android App Links verification (autoVerify intent filters in apps/mobile/app.config.ts).
export const dynamic = 'force-static';

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const pkg = process.env.ANDROID_PACKAGE ?? 'com.agarha.app';
  const body = fingerprints.length ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints } }] : [];
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=3600' } });
}
