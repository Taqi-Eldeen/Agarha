'use client';
import { CAR_BODY_TYPES } from '@agarha/schemas/enums';
import { Button, Select } from '@agarha/ui-web';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/routing';

export function HomeSearch({
  cities,
}: {
  cities: { slug: string; nameAr: string; nameEn: string }[];
}) {
  const t = useTranslations('web.home');
  const tu = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();
  const [city, setCity] = useState(cities[0]?.slug ?? 'cairo');
  const [type, setType] = useState('any');
  return (
    <form
      role="search"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-1 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?city=${city}${type !== 'any' ? `&type=${type}` : ''}`);
      }}
    >
      <Select
        label={t('city')}
        value={city}
        onValueChange={setCity}
        options={cities.map((c) => ({
          value: c.slug,
          label: locale === 'ar' ? c.nameAr : c.nameEn,
        }))}
      />
      <Select
        label={t('type')}
        value={type}
        onValueChange={setType}
        options={[
          { value: 'any', label: t('anyType') },
          ...CAR_BODY_TYPES.map((b) => ({ value: b, label: tu(`bodyTypes.${b}`) })),
        ]}
      />
      <Button type="submit" size="lg">
        {t('cta')}
      </Button>
    </form>
  );
}
