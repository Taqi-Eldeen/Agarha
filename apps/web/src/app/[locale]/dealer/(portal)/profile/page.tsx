'use client';
import { useApi } from '@agarha/api-client';
import { Button, PhoneField, TextField, useToast } from '@agarha/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { profileSchema } from '@agarha/schemas';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDealerMe } from '@/components/dealer/use-dealer';
import { Link, useRouter } from '@/i18n/routing';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';

type ProfileForm = { displayNameAr: string; displayNameEn: string; descriptionAr: string; descriptionEn: string; phone: string; whatsapp: string };

export default function Profile() {
  const t = useTranslations('dealer.profile');
  const to = useTranslations('dealer.onboarding');
  const me = useDealerMe();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const { text, known } = useFieldError();
  const form = useForm<ProfileForm>({ defaultValues: { displayNameAr: '', displayNameEn: '', descriptionAr: '', descriptionEn: '', phone: '', whatsapp: '' }, resolver: schemaResolver(profileSchema, (v) => v, known) });
  useEffect(() => {
    const d = me.data?.dealer;
    if (d) form.reset({ displayNameAr: d.displayNameAr, displayNameEn: d.displayNameEn, descriptionAr: d.descriptionAr ?? '', descriptionEn: d.descriptionEn ?? '', phone: d.phoneE164.replace('+20', '0'), whatsapp: d.whatsappE164.replace('+20', '0') });
  }, [me.data, form]);
  const err = (k: keyof ProfileForm) => text(form.formState.errors[k]?.message);
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
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          try {
            await api.PATCH('/v1/dealer/profile', { body: v as never });
            await qc.invalidateQueries({ queryKey: ['dealer-me'] });
            toast({ tone: 'success', text: t('saved') });
          } catch (e) {
            applyServerErrors(form, e);
          }
        })}
      >
        <fieldset disabled={!owner} className="flex flex-col gap-4">
          <TextField label={to('displayNameAr')} {...form.register('displayNameAr')} error={err('displayNameAr')} />
          <TextField label={to('displayNameEn')} {...form.register('displayNameEn')} error={err('displayNameEn')} dir="ltr" />
          <TextField label={to('description')} {...form.register('descriptionAr')} error={err('descriptionAr')} />
          <PhoneField label={to('businessPhone')} {...form.register('phone')} error={err('phone')} />
          <PhoneField label={to('whatsapp')} {...form.register('whatsapp')} error={err('whatsapp')} />
        </fieldset>
        {owner ? <Button type="submit" className="self-start" loading={form.formState.isSubmitting}>{t('saved')}</Button> : null}
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
