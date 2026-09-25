'use client';
import { ArrowDown, ArrowUp, Camera, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { IconButton } from './button';

export interface UploadItem {
  id: string;
  previewUrl: string;
  status: 'queued' | 'uploading' | 'processing' | 'ready' | 'failed';
  progress?: number;
}

export interface PhotoUploaderProps {
  items: UploadItem[];
  max?: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onReorder: (ids: string[]) => void;
}

/**
 * Camera-friendly uploader: add (camera or gallery), progress, retry, reorder with buttons
 * (keyboard and screen-reader accessible, no drag-only interaction). First photo is the cover.
 */
export function PhotoUploader({ items, max = 12, onAdd, onRemove, onRetry, onReorder }: PhotoUploaderProps) {
  const { t, f } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const move = (i: number, d: number) => {
    const ids = items.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    onReorder(ids);
  };
  return (
    <div className="flex flex-col gap-3">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" multiple hidden onChange={(e) => {
        const files = Array.from(e.target.files ?? []).slice(0, max - items.length);
        if (files.length) onAdd(files);
        e.target.value = '';
      }} />
      <button type="button" disabled={items.length >= max} onClick={() => input.current?.click()} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-card p-4 text-brand disabled:opacity-50">
        <Camera aria-hidden className="size-7" strokeWidth={1.75} />
        <span className="font-medium">{t.uploadPhotos}</span>
        <span className="text-caption text-fg-secondary">{t.uploadHint}</span>
      </button>
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.id} className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
            <div className="relative aspect-[4/3] bg-brand-subtle">
              <img src={item.previewUrl} alt={f('photoOf', { index: i + 1, total: items.length })} className={cn('size-full object-cover', item.status !== 'ready' && 'opacity-70')} />
              {i === 0 ? (
                <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-featured px-2 text-label text-featured-fg">
                  <Star aria-hidden className="size-3" />
                  {t.makeCover}
                </span>
              ) : null}
              {item.status === 'uploading' || item.status === 'processing' ? (
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((item.progress ?? 0) * 100)} aria-label={f('uploading', { percent: Math.round((item.progress ?? 0) * 100) })} className="absolute inset-x-0 bottom-0 h-1.5 bg-border">
                  <div className="h-full bg-brand transition-[width] duration-fast" style={{ width: `${Math.round((item.progress ?? (item.status === 'processing' ? 1 : 0)) * 100)}%` }} />
                </div>
              ) : null}
              {item.status === 'failed' ? <p role="alert" className="absolute inset-x-0 bottom-0 bg-danger px-2 py-1 text-caption text-white">{t.uploadFailed}</p> : null}
            </div>
            <div className="flex justify-between">
              <IconButton label={t.moveEarlier} icon={<ArrowUp aria-hidden className="size-4" />} onClick={() => move(i, -1)} disabled={i === 0} />
              <IconButton label={t.moveLater} icon={<ArrowDown aria-hidden className="size-4" />} onClick={() => move(i, 1)} disabled={i === items.length - 1} />
              {item.status === 'failed' ? <IconButton label={t.retry} icon={<RotateCcw aria-hidden className="size-4" />} onClick={() => onRetry(item.id)} /> : null}
              <IconButton label={t.remove} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => onRemove(item.id)} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Client-side resize to ≤ 2048px before upload (section 6, media pipeline step 1). */
export async function resizeImage(file: File, maxSide = 2048, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === 'image/jpeg') return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', quality));
}
