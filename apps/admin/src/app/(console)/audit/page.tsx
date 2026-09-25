'use client';
import { DataTable, TextField } from '@agarha/ui-web';
import { useState } from 'react';
import { useAdminQuery } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Entry = {
  id: number;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  dealerId: string | null;
  createdAt: string;
};

export default function Audit() {
  const { t } = useT();
  const [target, setTarget] = useState('');
  const q = useAdminQuery<{ items: Entry[] }>(
    ['audit', target],
    `/admin/audit${target ? `?targetId=${encodeURIComponent(target)}` : ''}`,
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{t('audit.title')}</h1>
      <TextField
        label={t('audit.filter')}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        dir="ltr"
      />
      <DataTable
        caption={t('audit.title')}
        rows={q.data?.items ?? []}
        rowKey={(e) => String(e.id)}
        columns={[
          {
            key: 'time',
            header: t('audit.time'),
            cell: (e) => <span dir="ltr">{e.createdAt.replace('T', ' ').slice(0, 19)}</span>,
            sortValue: (e) => e.createdAt,
          },
          {
            key: 'actor',
            header: t('audit.actor'),
            cell: (e) => (
              <span dir="ltr">{`${e.actorRole ?? '—'} ${e.actorUserId?.slice(0, 8) ?? ''}`}</span>
            ),
          },
          {
            key: 'action',
            header: t('audit.action'),
            cell: (e) => <span dir="ltr">{e.action}</span>,
          },
          {
            key: 'target',
            header: t('audit.target'),
            cell: (e) => (
              <span dir="ltr">{`${e.targetType} ${e.targetId?.slice(0, 8) ?? ''}`}</span>
            ),
          },
        ]}
      />
    </div>
  );
}
