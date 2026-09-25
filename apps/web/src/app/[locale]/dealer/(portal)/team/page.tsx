'use client';
import { useApi, type ApiRequestError } from '@agarha/api-client';
import { formatPhone } from '@agarha/i18n';
import { Button, InlineAlert, PhoneField, useToast } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Member = { userId: string; role: 'dealer_owner' | 'dealer_staff'; phone: string | null; displayName: string | null };

export default function Team() {
  const t = useTranslations('dealer.team');
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const q = useQuery({ queryKey: ['team'], queryFn: async () => (await api.GET('/v1/dealer/team')).data as unknown as { items: Member[]; limits: { maxTeamMembers: number } } });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      <InlineAlert tone="info">{t('staffHint')}</InlineAlert>
      {q.data ? <p className="text-caption text-fg-secondary">{t('limit', { count: q.data.limits.maxTeamMembers })}</p> : null}
      <ul className="flex flex-col gap-2">
        {q.data?.items.map((m) => (
          <li key={m.userId} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div>
              <p className="font-medium">{m.displayName ?? (m.phone ? formatPhone(m.phone) : '—')}</p>
              <p className="text-caption text-fg-secondary">{t(`roles.${m.role}`)}</p>
            </div>
            {m.role === 'dealer_staff' ? (
              <Button size="sm" variant="ghost" onClick={async () => { await api.DELETE('/v1/dealer/team/{userId}', { params: { path: { userId: m.userId } } }); await qc.invalidateQueries({ queryKey: ['team'] }); }}>
                {t('remove')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(undefined);
          try {
            await api.POST('/v1/dealer/team', { body: { phone, role: 'dealer_staff' } as never });
            toast({ tone: 'success', text: t('invited') });
            setPhone('');
            await qc.invalidateQueries({ queryKey: ['team'] });
          } catch (err) {
            setError((err as ApiRequestError).message);
          }
        }}
      >
        <h2 className="text-h2">{t('invite')}</h2>
        <PhoneField label={t('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} error={error} />
        <Button type="submit" className="self-start">
          {t('invite')}
        </Button>
      </form>
    </div>
  );
}
