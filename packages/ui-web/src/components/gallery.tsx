'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useUi } from '../lib/ui-context';
import { BlurImage } from './blur-image';
import { IconButton } from './button';

export interface GalleryPhoto {
  id: string;
  src: string;
  srcSet?: string;
  blurhash?: string | null;
}

/** Manual gallery (no autoplay). Arrow keys follow reading direction. */
export function Gallery({ photos, alt }: { photos: GalleryPhoto[]; alt: string }) {
  const { t, f, dir } = useUi();
  const [i, setI] = useState(0);
  if (!photos.length) return <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-brand-subtle text-fg-secondary">{t.noPhotos}</div>;
  const go = (d: number) => setI((x) => (x + d + photos.length) % photos.length);
  const p = photos[i]!;
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-lg bg-brand-subtle"
      role="region"
      aria-roledescription="carousel"
      aria-label={alt}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(dir === 'rtl' ? -1 : 1);
        if (e.key === 'ArrowLeft') go(dir === 'rtl' ? 1 : -1);
      }}
    >
      <BlurImage key={p.id} src={p.src} srcSet={p.srcSet} sizes="(min-width: 1024px) 60vw, 100vw" blurhash={p.blurhash} alt={`${alt} — ${f('photoOf', { index: i + 1, total: photos.length })}`} priority={i === 0} />
      {photos.length > 1 ? (
        <>
          <IconButton label={t.previousPhoto} onClick={() => go(-1)} variant="secondary" shape="round" className="absolute start-2 top-1/2 -translate-y-1/2" icon={<ChevronLeft aria-hidden className="ag-mirror size-5" strokeWidth={1.75} />} />
          <IconButton label={t.nextPhoto} onClick={() => go(1)} variant="secondary" shape="round" className="absolute end-2 top-1/2 -translate-y-1/2" icon={<ChevronRight aria-hidden className="ag-mirror size-5" strokeWidth={1.75} />} />
          <p aria-live="polite" dir="ltr" className="ag-tabular absolute bottom-2 end-2 rounded-full bg-fg/70 px-2 text-caption text-white">{`${i + 1} / ${photos.length}`}</p>
        </>
      ) : null}
    </div>
  );
}
