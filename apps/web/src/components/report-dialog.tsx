'use client';
import { useApi } from '@agarha/api-client';
import type { ReportReason } from '@agarha/schemas';
import { REPORT_REASONS } from '@agarha/schemas/enums';
import { Button, Drawer, Select, TextField, useToast } from '@agarha/ui-web';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { track } from '@/lib/analytics';

export function ReportDrawer({ listingId, open, setOpen }: { listingId: string; open: boolean; setOpen: (o: boolean) => void }) {
  const t = useTranslations('web.report');
  const api = useApi();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | undefined>();
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  return (
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        footer={
          <Button
            block
            disabled={!reason}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.POST('/v1/reports', { body: { listingId, reason: reason!, ...(details ? { details } : {}) } });
                track('report_submitted', { reason: reason! });
                toast({ tone: 'success', text: t('thanks') });
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('submit')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Select label={t('reason')} value={reason} onValueChange={(v) => setReason(v as ReportReason)} options={REPORT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))} />
          <TextField label={t('details')} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        </div>
      </Drawer>
  );
}
