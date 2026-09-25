import { decode } from 'blurhash';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';

/** Image with a blurhash placeholder painted into a canvas until the real image loads (no CLS: parent sizes it). */
export function BlurImage({ src, srcSet, sizes, blurhash, alt, priority, className }: { src: string; srcSet?: string; sizes?: string; blurhash?: string | null; alt: string; priority?: boolean | undefined; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!blurhash || !canvas.current) return;
    try {
      const pixels = decode(blurhash, 32, 24);
      const ctx = canvas.current.getContext('2d');
      if (!ctx) return;
      const img = ctx.createImageData(32, 24);
      img.data.set(pixels);
      ctx.putImageData(img, 0, 0);
    } catch {
      /* invalid hash: keep the flat background */
    }
  }, [blurhash]);
  return (
    <>
      {blurhash && !loaded ? <canvas ref={canvas} width={32} height={24} aria-hidden className="absolute inset-0 size-full" /> : null}
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn('absolute inset-0 size-full object-cover transition-opacity duration-base', loaded ? 'opacity-100' : 'opacity-0', className)}
      />
    </>
  );
}
