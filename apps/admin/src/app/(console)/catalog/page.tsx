'use client';
import { CAR_BODY_TYPES } from '@agarha/schemas/enums';
import { Button, Select, TextField, useToast } from '@agarha/ui-web';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminFetch, useAdminQuery, useInvalidate } from '@/lib/api';
import { useT } from '@/lib/i18n';

type City = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  lat: number | null;
  lng: number | null;
};
type Make = { id: string; slug: string; nameAr: string; nameEn: string };
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Cities (P6 rollout = flip "active"), areas, makes, models, trims. Every write is audited. */
export default function Catalog() {
  const { t } = useT();
  const toast = useToast();
  const invalidate = useInvalidate();
  const cities = useAdminQuery<{ items: City[] }>(['cities'], '/admin/catalog/cities');
  const makes = useQuery({
    queryKey: ['makes'],
    queryFn: async () =>
      ((await (await fetch(`${API}/v1/catalog/makes`)).json()) as { items: Make[] }).items,
  });
  const [city, setCity] = useState({ slug: '', nameAr: '', nameEn: '' });
  const [area, setArea] = useState({ cityId: '', slug: '', nameAr: '', nameEn: '' });
  const [model, setModel] = useState({
    makeId: '',
    slug: '',
    nameAr: '',
    nameEn: '',
    bodyType: 'sedan',
  });
  const save = async (path: string, body: unknown, method = 'POST') => {
    try {
      await adminFetch(path, { method, json: body });
      toast({ tone: 'success', text: t('common.saved') });
      await invalidate(['cities']);
    } catch (e) {
      toast({ tone: 'danger', text: (e as Error).message });
    }
  };
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1">{t('nav.catalog')}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-h2">{t('catalog.cities')}</h2>
        <ul className="flex flex-col gap-2">
          {cities.data?.items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <span>
                {c.nameEn} · {c.nameAr}{' '}
                <span dir="ltr" className="text-caption text-fg-secondary">
                  /{c.slug}
                </span>
              </span>
              <label className="flex min-h-touch items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={c.isActive}
                  onChange={(e) =>
                    void save(
                      `/admin/catalog/cities/${c.id}`,
                      {
                        slug: c.slug,
                        nameAr: c.nameAr,
                        nameEn: c.nameEn,
                        isActive: e.target.checked,
                        sortOrder: 0,
                        lat: c.lat,
                        lng: c.lng,
                      },
                      'PUT',
                    )
                  }
                />
                {t('catalog.active')}
              </label>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save('/admin/catalog/cities', { ...city, isActive: false, sortOrder: 99 });
          }}
        >
          <TextField
            label={t('catalog.slug')}
            value={city.slug}
            onChange={(e) => setCity({ ...city, slug: e.target.value })}
            dir="ltr"
          />
          <TextField
            label={t('catalog.nameAr')}
            value={city.nameAr}
            onChange={(e) => setCity({ ...city, nameAr: e.target.value })}
          />
          <TextField
            label={t('catalog.nameEn')}
            value={city.nameEn}
            onChange={(e) => setCity({ ...city, nameEn: e.target.value })}
            dir="ltr"
          />
          <Button type="submit" className="self-end">
            {t('catalog.add')}
          </Button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h2">{t('catalog.areas')}</h2>
        <form
          className="grid gap-2 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save('/admin/catalog/areas', area);
          }}
        >
          <Select
            label={t('catalog.cities')}
            value={area.cityId}
            onValueChange={(v) => setArea({ ...area, cityId: v })}
            options={(cities.data?.items ?? []).map((c) => ({ value: c.id, label: c.nameEn }))}
          />
          <TextField
            label={t('catalog.slug')}
            value={area.slug}
            onChange={(e) => setArea({ ...area, slug: e.target.value })}
            dir="ltr"
          />
          <TextField
            label={t('catalog.nameAr')}
            value={area.nameAr}
            onChange={(e) => setArea({ ...area, nameAr: e.target.value })}
          />
          <TextField
            label={t('catalog.nameEn')}
            value={area.nameEn}
            onChange={(e) => setArea({ ...area, nameEn: e.target.value })}
            dir="ltr"
          />
          <Button type="submit" className="self-end">
            {t('catalog.add')}
          </Button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h2">{t('catalog.models')}</h2>
        <form
          className="grid gap-2 md:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save('/admin/catalog/models', model);
          }}
        >
          <Select
            label={t('catalog.makes')}
            value={model.makeId}
            onValueChange={(v) => setModel({ ...model, makeId: v })}
            options={(makes.data ?? []).map((m) => ({ value: m.id, label: m.nameEn }))}
          />
          <TextField
            label={t('catalog.slug')}
            value={model.slug}
            onChange={(e) => setModel({ ...model, slug: e.target.value })}
            dir="ltr"
          />
          <TextField
            label={t('catalog.nameAr')}
            value={model.nameAr}
            onChange={(e) => setModel({ ...model, nameAr: e.target.value })}
          />
          <TextField
            label={t('catalog.nameEn')}
            value={model.nameEn}
            onChange={(e) => setModel({ ...model, nameEn: e.target.value })}
            dir="ltr"
          />
          <Select
            label={t('catalog.bodyType')}
            value={model.bodyType}
            onValueChange={(v) => setModel({ ...model, bodyType: v })}
            options={CAR_BODY_TYPES.map((b) => ({ value: b, label: b }))}
          />
          <Button type="submit" className="self-end">
            {t('catalog.add')}
          </Button>
        </form>
      </section>
    </div>
  );
}
