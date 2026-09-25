'use client';
import { ApiRequestError, useApi } from '@agarha/api-client';
import { formatPhone } from '@agarha/i18n';
import { inviteSchema } from '@agarha/schemas';
import { Button, InlineAlert, PhoneField, useToast } from '@agarha/ui-web';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { applyServerErrors, schemaResolver, useFieldError } from '@/lib/forms';

type Member = {
  userId: string;
  role: 'dealer_owner' | 'dealer_staff';
  phone: string | null;
  displayName: string | null;
};

export default function Team() {
  const t = useTranslations('dealer.team');
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const { text, known } = useFieldError();
  const form = useForm<{ phone: string }>({
    defaultValues: { phone: '' },
    resolver: schemaResolver(inviteSchema, (v) => ({ ...v, role: 'dealer_staff' }), known),
  });
  const q = useQuery({
    queryKey: ['team'],
    queryFn: async () =>
      (await api.GET('/v1/dealer/team')).data as unknown as {
        items: Member[];
        limits: { maxTeamMembers: number };
      },
  });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('title')}</h1>
      <InlineAlert tone="info">{t('staffHint')}</InlineAlert>
      {q.data ? (
        <p className="text-caption text-fg-secondary">
          {t('limit', { count: q.data.limits.maxTeamMembers })}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {q.data?.items.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
            <div>
              <p className="font-medium">
                {m.displayName ?? (m.phone ? formatPhone(m.phone) : '—')}
              </p>
              <p className="text-caption text-fg-secondary">{t(`roles.${m.role}`)}</p>
            </div>
            {m.role === 'dealer_staff' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api.DELETE('/v1/dealer/team/{userId}', {
                    params: { path: { userId: m.userId } },
                  });
                  await qc.invalidateQueries({ queryKey: ['team'] });
                }}
              >
                {t('remove')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
        noValidate
        onSubmit={form.handleSubmit(async ({ phone }) => {
          try {
            await api.POST('/v1/dealer/team', { body: { phone, role: 'dealer_staff' } as never });
            toast({ tone: 'success', text: t('invited') });
            form.reset();
            await qc.invalidateQueries({ queryKey: ['team'] });
          } catch (err) {
            if (!applyServerErrors(form, err))
              form.setError('phone', {
                type: 'server',
                message: err instanceof ApiRequestError ? err.code : 'internal_error',
              });
          }
        })}
      >
        <h2 className="text-h2">{t('invite')}</h2>
        <PhoneField
          label={t('phone')}
          {...form.register('phone')}
          error={text(form.formState.errors.phone?.message)}
        />
        <Button type="submit" className="self-start" loading={form.formState.isSubmitting}>
          {t('invite')}
        </Button>
      </form>
    </div>
  );
}
