'use client';

/** TOTP enrollment without a QR library: the otpauth link (opens authenticator apps on phones) + the key. */
export default function TotpEnroll({
  uri,
  secret,
  title,
}: {
  uri: string;
  secret: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-h2">{title}</h2>
      <a href={uri} className="text-brand underline" dir="ltr">
        {uri.split('?')[0]}
      </a>
      <code dir="ltr" className="break-all rounded bg-brand-subtle p-2">
        {secret}
      </code>
    </section>
  );
}
