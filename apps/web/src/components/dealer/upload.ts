'use client';
import { uploadToPresigned, type ApiClient } from '@agarha/api-client';
import { resizeImage } from '@agarha/ui-web';

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verification document: presigned PUT into private-docs (type + size locked), then confirm. */
export async function uploadDocument(api: ApiClient, type: string, file: File) {
  const mimeType = file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
  const body = mimeType === 'image/jpeg' ? await resizeImage(file, 2400, 0.9) : file;
  const { data } = await api.POST('/v1/dealer/documents/uploads', { body: { type: type as never, mimeType, sizeBytes: body.size, sha256: await sha256Hex(body) } });
  const r = data as unknown as { documentId: string; upload: { url: string } };
  await uploadToPresigned(r.upload.url, body, mimeType);
  await api.POST('/v1/dealer/documents/{id}/complete', { params: { path: { id: r.documentId } } });
}

/** Car photo: client-side resize ≤ 2048px, presigned PUT with progress, then queue processing. */
export async function uploadPhoto(api: ApiClient, listingId: string, file: File, onProgress: (f: number) => void): Promise<string> {
  const body = await resizeImage(file, 2048, 0.85);
  const { data } = await api.POST('/v1/dealer/listings/{id}/photos', { params: { path: { id: listingId } }, body: { mimeType: 'image/jpeg', sizeBytes: body.size } });
  const r = data as unknown as { photoId: string; upload: { url: string } };
  await uploadToPresigned(r.upload.url, body, 'image/jpeg', onProgress);
  await api.POST('/v1/dealer/listings/{id}/photos/{photoId}/complete', { params: { path: { id: listingId, photoId: r.photoId } } });
  return r.photoId;
}
