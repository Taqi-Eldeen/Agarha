'use client';
import { OTPField } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** Shows the otpauth QR + manual key, collects the first code. */
export function TotpSetup({ uri, secret, onCode, error, busy }: { uri: string; secret: string; onCode: (code: string) => void; error?: string | undefined; busy: boolean }) {
  const t = useTranslations('dealer.auth');
  const [qr, setQr] = useState<string>();
  const [code, setCode] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(uri, { margin: 1, width: 220 }).then(setQr);
  }, [uri]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('totpSetupTitle')}</h1>
      <p className="text-fg-secondary">{t('totpSetupBody')}</p>
      {qr ? <img src={qr} alt={t('totpSetupTitle')} width={220} height={220} className="self-center rounded-md bg-white p-2" /> : null}
      <p className="text-caption">
        {t('totpKey')}: <code dir="ltr" className="break-all rounded bg-brand-subtle px-1">{secret}</code>
      </p>
      <OTPField label={t('totpTitle')} value={code} onChange={setCode} onComplete={onCode} error={error} disabled={busy} />
    </div>
  );
}
