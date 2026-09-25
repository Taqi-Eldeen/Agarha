'use client';
import { useApi, useMe } from '@agarha/api-client';
import { formatPhone } from '@agarha/i18n';
import { Button, InlineAlert, Select, TextField, useToast } from '@agarha/ui-web';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { OtpSignIn } from './otp-sign-in';
import { ReviewPrompts } from './review-prompts';

export function AccountView() {
  const t = useTranslations('web.account');
  const tn = useTranslations('web.nav');
  const tl = useTranslations('web.legal');
  const me = useMe();
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState<string | undefined>();
  const [lang, setLang] = useState<string | undefined>();

  if (me.isLoading) return <p aria-busy="true">{tn('account')}…</p>;

  if (!me.data)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="text-h1">{t('signInTitle')}</h1>
        <p className="text-fg-secondary">{t('signInBody')}</p>
        <OtpSignIn
          onDone={() => {
            // Only same-site relative paths are allowed as a return target.
            if (next && next.startsWith('/') && !next.startsWith('//')) window.location.href = next;
            else router.replace('/account');
          }}
        />
        <p className="text-caption text-fg-secondary">
          {t('consent')}{' '}
          <Link href="/legal/terms" className="underline">{tl('terms')}</Link>
          {' · '}
          <Link href="/legal/privacy" className="underline">{tl('privacy')}</Link>
        </p>
      </div>
    );

  const user = me.data as { phone: string; displayName: string | null; locale: 'ar' | 'en' };
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-fg-secondary">{t('signedInAs', { phone: formatPhone(user.phone) })}</p>
      </header>
      <ReviewPrompts />
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-h2">{t('profile')}</h2>
        <TextField label={t('displayName')} defaultValue={user.displayName ?? ''} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Select label={t('language')} value={lang ?? user.locale} onValueChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        <Button
          className="self-start"
          onClick={async () => {
            await api.PATCH('/v1/me', { body: { ...(name !== undefined ? { displayName: name || null } : {}), ...(lang ? { locale: lang as 'ar' | 'en' } : {}) } });
            await qc.invalidateQueries({ queryKey: ['me'] });
            toast({ tone: 'success', text: t('saved') });
          }}
        >
          {t('saved')}
        </Button>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-h2">{t('exportTitle')}</h2>
        <p className="text-fg-secondary">{t('exportBody')}</p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={async () => {
            const { data } = await api.GET('/v1/me/export');
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'agarha-my-data.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t('exportButton')}
        </Button>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-card p-4">
        <h2 className="text-h2">{t('deleteTitle')}</h2>
        <p className="text-fg-secondary">{t('deleteBody')}</p>
        {confirmDelete ? <InlineAlert tone="danger">{t('deleteConfirm')}</InlineAlert> : null}
        <Button
          variant="danger"
          className="self-start"
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await api.DELETE('/v1/me');
            await qc.invalidateQueries();
            toast({ tone: 'success', text: t('deleted') });
            router.replace('/');
          }}
        >
          {t('deleteButton')}
        </Button>
      </section>
      <Button
        variant="ghost"
        className="self-start"
        onClick={async () => {
          await api.POST('/v1/auth/sign-out', { body: { client: 'web' } });
          await qc.invalidateQueries();
          router.replace('/');
        }}
      >
        {tn('signOut')}
      </Button>
    </div>
  );
}
