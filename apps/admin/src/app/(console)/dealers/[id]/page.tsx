'use client';
import { Button, InlineAlert, TextField, useToast } from '@agarha/ui-web';
import { ExternalLink } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

type Detail = {
  dealer: {
    id: string;
    displayNameAr: string;
    displayNameEn: string;
    legalName: string;
    commercialRegistrationNo: string;
    taxCardNo: string;
    status: string;
    suspendedAt: string | null;
    suspendedReason: string | null;
    phoneE164: string;
    whatsappE164: string;
  };
  branches: {
    id: string;
    nameAr: string;
    nameEn: string;
    addressAr: string | null;
    lat: number | null;
    lng: number | null;
  }[];
  documents: { items: { type: string; status: string }[] };
  team: { userId: string; role: string; phone: string | null; displayName: string | null }[];
};
type Doc = {
  id: string;
  type: string;
  status: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  rejectionReason: string | null;
};

/** Verification: view each document through a 5-minute signed link (every view is audited), approve, then verify. */
export default function DealerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const toast = useToast();
  const invalidate = useInvalidate();
  const d = useAdminQuery<Detail>(['dealer', id], `/admin/dealers/${id}`);
  const docs = useAdminQuery<{ items: Doc[] }>(['docs', id], `/admin/dealers/${id}/documents`);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(null);
  const act = async (path: string, body?: unknown) => {
    try {
      await adminFetch(path, { method: 'POST', json: body ?? {} });
      toast({ tone: 'success', text: t('common.saved') });
      await invalidate(['dealer', id]);
      await invalidate(['docs', id]);
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };
  const dealer = d.data?.dealer;
  if (!dealer) return null;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">
          {dealer.displayNameEn} · {dealer.displayNameAr}
        </h1>
        <p className="text-fg-secondary">{dealer.legalName}</p>
        <p className="text-caption">
          {`${t('dealers.cr', { value: dealer.commercialRegistrationNo })} · ${t('dealers.tax', { value: dealer.taxCardNo })} · `}
          <span dir="ltr">{dealer.phoneE164}</span>
        </p>
        <p className="text-caption">{`${t('dealers.status')}: ${t(`dealers.statuses.${dealer.status as 'verified'}`)}`}</p>
        {dealer.suspendedAt ? (
          <InlineAlert tone="danger" title={t('dealers.suspendedBadge')}>
            {dealer.suspendedReason}
          </InlineAlert>
        ) : null}
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-h2">{t('dealers.docs')}</h2>
        <ul className="flex flex-col gap-2">
          {docs.data?.items.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
            >
              <span>
                {doc.type} · {doc.status}
                {doc.rejectionReason ? ` · ${doc.rejectionReason}` : ''}
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ExternalLink aria-hidden className="size-4" />}
                  onClick={async () =>
                    setPreview(
                      await adminFetch(`/admin/documents/${doc.id}/view`, { method: 'POST' }),
                    )
                  }
                >
                  {t('dealers.view')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void act(`/admin/documents/${doc.id}/review`, { approve: true })}
                >
                  {t('dealers.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={reason.length < 3}
                  onClick={() =>
                    void act(`/admin/documents/${doc.id}/review`, { approve: false, reason })
                  }
                >
                  {t('dealers.rejectDoc')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {preview ? (
          <div className="rounded-lg border border-border bg-card p-2">
            {preview.mimeType === 'application/pdf' ? (
              <iframe title={t('dealers.docs')} src={preview.url} className="h-[70dvh] w-full" />
            ) : (
              <img src={preview.url} alt={t('dealers.docs')} className="max-h-[70dvh]" />
            )}
          </div>
        ) : null}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-h2">{t('dealers.team')}</h2>
        <ul>
          {d.data?.team.map((m) => (
            <li key={m.userId} dir="ltr">
              {m.role} · {m.phone} · {m.displayName}
            </li>
          ))}
        </ul>
        <ul>
          {d.data?.branches.map((b) => (
            <li key={b.id}>
              {b.nameEn} · {b.addressAr}{' '}
              {b.lat !== null ? `(${b.lat.toFixed(4)}, ${b.lng?.toFixed(4)})` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <TextField
          label={t('dealers.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={dealer.status !== 'pending_review'}
            onClick={() => void act(`/admin/dealers/${id}/verify`)}
          >
            {t('dealers.verify')}
          </Button>
          <Button
            variant="secondary"
            disabled={dealer.status !== 'pending_review' || reason.length < 3}
            onClick={() => void act(`/admin/dealers/${id}/reject`, { reason })}
          >
            {t('dealers.reject')}
          </Button>
          {dealer.suspendedAt ? (
            <Button variant="secondary" onClick={() => void act(`/admin/dealers/${id}/unsuspend`)}>
              {t('dealers.unsuspend')}
            </Button>
          ) : (
            <Button
              variant="danger"
              disabled={reason.length < 3}
              onClick={() => void act(`/admin/dealers/${id}/suspend`, { reason })}
            >
              {t('dealers.suspend')}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
