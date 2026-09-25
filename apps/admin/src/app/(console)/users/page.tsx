'use client';
import { Button, InlineAlert, PhoneField, TextField, useToast } from '@agarha/ui-web';
import { useState } from 'react';
import { adminFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Lookup = {
  user: {
    id: string;
    phone: string | null;
    displayName: string | null;
    status: string;
    roles: string[];
    createdAt: string;
    lastSignInAt: string | null;
  } | null;
  memberships?: { dealerId: string; role: string }[];
};

/** Support: look up a user by phone, block, and handle PDPL export / deletion requests. */
export default function Users() {
  const { t } = useT();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [r, setR] = useState<Lookup | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ tone: 'success', text: t('common.saved') });
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-h1">{t('nav.users')}</h1>
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setR(await adminFetch<Lookup>(`/admin/users?phone=${encodeURIComponent(phone)}`));
        }}
      >
        <div className="flex-1">
          <PhoneField
            label={t('users.lookup')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button type="submit">{t('common.next')}</Button>
      </form>
      {r && !r.user ? <InlineAlert tone="info">{t('users.notFound')}</InlineAlert> : null}
      {r?.user ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <p dir="ltr">
            {r.user.phone} · {r.user.displayName ?? '—'} · {r.user.status}
          </p>
          <p>
            {t('users.roles')}: {r.user.roles.join(', ') || '—'}
          </p>
          <p>
            {t('users.memberships')}: {r.memberships?.map((m) => `${m.role}`).join(', ') || '—'}
          </p>
          <TextField
            label={t('dealers.reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {r.user.status === 'blocked' ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void run(() =>
                    adminFetch(`/admin/users/${r.user!.id}/unblock`, { method: 'POST' }),
                  )
                }
              >
                {t('users.unblock')}
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={reason.length < 3}
                onClick={() =>
                  void run(() =>
                    adminFetch(`/admin/users/${r.user!.id}/block`, {
                      method: 'POST',
                      json: { reason },
                    }),
                  )
                }
              >
                {t('users.block')}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                void run(async () => {
                  const data = await adminFetch(`/admin/users/${r.user!.id}/export`, {
                    method: 'POST',
                  });
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                  );
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `user-${r.user!.id}.json`;
                  a.click();
                })
              }
            >
              {t('users.export')}
            </Button>
            <Button
              variant="danger"
              disabled={reason.length < 3}
              onClick={() =>
                void run(() =>
                  adminFetch(`/admin/users/${r.user!.id}/delete`, {
                    method: 'POST',
                    json: { reason },
                  }),
                )
              }
            >
              {t('users.delete')}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
