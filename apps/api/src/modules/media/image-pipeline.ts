import { encode } from 'blurhash';
import sharp from 'sharp';
import { sniff } from './magic';

export const PHOTO_WIDTHS = [320, 640, 1280] as const;
export const PHOTO_FORMATS = ['webp', 'avif'] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_LISTING = 12;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

export interface ProcessedImage {
  width: number;
  height: number;
  blurhash: string;
  /** EXIF-free re-encoded original (JPEG). */
  original: Buffer;
  variants: { format: (typeof PHOTO_FORMATS)[number]; width: (typeof PHOTO_WIDTHS)[number]; body: Buffer }[];
}

export class RejectedMedia extends Error {}

/**
 * Validates magic bytes, applies EXIF orientation then drops ALL metadata (GPS included:
 * sharp writes no metadata unless asked), and generates WebP/AVIF at 320/640/1280 + a blurhash.
 */
export async function processListingPhoto(input: Buffer): Promise<ProcessedImage> {
  if (input.length > MAX_PHOTO_BYTES) throw new RejectedMedia('too_large');
  const type = sniff(input);
  if (!type || type === 'application/pdf') throw new RejectedMedia('not_an_image');

  const base = sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new RejectedMedia('unreadable');

  const original = await base.clone().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const { data, info } = await base.clone().resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);

  const variants: ProcessedImage['variants'] = [];
  for (const width of PHOTO_WIDTHS) {
    const resized = base.clone().resize({ width, withoutEnlargement: true });
    variants.push({ format: 'webp', width, body: await resized.clone().webp({ quality: 78 }).toBuffer() });
    variants.push({ format: 'avif', width, body: await resized.clone().avif({ quality: 55, effort: 4 }).toBuffer() });
  }
  const oriented = await sharp(original).metadata();
  return { width: oriented.width ?? meta.width, height: oriented.height ?? meta.height, blurhash, original, variants };
}

/** Verification documents: PDF or JPEG only, ≤ 10 MB; images are re-encoded to drop metadata. */
export async function sanitiseDocument(input: Buffer): Promise<{ body: Buffer; type: 'application/pdf' | 'image/jpeg' }> {
  if (input.length > MAX_PHOTO_BYTES) throw new RejectedMedia('too_large');
  const type = sniff(input);
  if (type === 'application/pdf') return { body: input, type };
  if (type === 'image/jpeg' || type === 'image/png') {
    return { body: await sharp(input, { failOn: 'error' }).rotate().jpeg({ quality: 90 }).toBuffer(), type: 'image/jpeg' };
  }
  throw new RejectedMedia('unsupported_type');
}
