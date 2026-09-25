'use client';
import { useApi } from '@agarha/api-client';
import { Button, PhoneField, TextField, useToast } from '@agarha/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useDealerMe } from '@/components/dealer/use-dealer';
import { Link, useRouter } from '@/i18n/routing';

export default function Profile() {
  const t = useTranslations('dealer.profile');
  const to = useTranslations('dealer.onboarding');
  const me = useDealerMe();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ displayNameAr: '', displayNameEn: '', descriptionAr: '', descriptionEn: '', phone: '', whatsapp: '' });
  useEffect(() => {
    const d = me.data?.dealer;
    if (d) setF({ displayNameAr: d.displayNameAr, displayNameEn: d.displayNameEn, descriptionAr: d.descriptionAr ?? '', descriptionEn: d.descriptionEn ?? '', phone: d.phoneE164.replace('+20', '0'), whatsapp: d.whatsappE164.replace('+20', '0') });
  }, [me.data]);
  const owner = me.data?.role === 'dealer_owner';
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      {me.data ? (
        <Link href={`/dealers/${me.data.dealer.slug}`} className="inline-flex items-center gap-1 text-brand underline">
          {t('publicPage')}
          <ExternalLink aria-hidden className="ag-mirror size-4" />
        </Link>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api.PATCH('/v1/dealer/profile', { body: f as never });
          await qc.invalidateQueries({ queryKey: ['dealer-me'] });
          toast({ tone: 'success', text: t('saved') });
        }}
      >
        <fieldset disabled={!owner} className="flex flex-col gap-4">
          <TextField label={to('displayNameAr')} value={f.displayNameAr} onChange={(e) => setF({ ...f, displayNameAr: e.target.value })} />
          <TextField label={to('displayNameEn')} value={f.displayNameEn} onChange={(e) => setF({ ...f, displayNameEn: e.target.value })} dir="ltr" />
          <TextField label={to('description')} value={f.descriptionAr} onChange={(e) => setF({ ...f, descriptionAr: e.target.value })} />
          <PhoneField label={to('businessPhone')} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <PhoneField label={to('whatsapp')} value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        </fieldset>
        {owner ? <Button type="submit" className="self-start">{t('saved')}</Button> : null}
      </form>
      <Button
        variant="ghost"
        className="self-start"
        onClick={async () => {
          await api.POST('/v1/auth/dealer/sign-out');
          await qc.clear();
          router.replace('/dealer/sign-in');
        }}
      >
        {t('signOut')}
      </Button>
    </div>
  );
}
