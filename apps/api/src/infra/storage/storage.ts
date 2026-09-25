import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Global, Module } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { ENV, type Env } from '../../config/env';
import { hmac, safeEqualHex } from '../../common/crypto';

export type Bucket = 'public' | 'private';

export interface PresignedPut {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/** Storage port. S3/R2/MinIO in real environments; a signed local-disk driver for local dev and tests. */
export interface Storage {
  presignPut(bucket: Bucket, key: string, contentType: string, contentLength: number, ttlSeconds?: number): Promise<PresignedPut>;
  presignGet(bucket: Bucket, key: string, ttlSeconds: number): Promise<string>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
  put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void>;
  delete(bucket: Bucket, key: string): Promise<void>;
  publicUrl(key: string): string;
}
export const STORAGE = Symbol('STORAGE');

export class S3Storage implements Storage {
  private readonly s3: S3Client;
  constructor(private readonly env: Env) {
    this.s3 = new S3Client({
      region: env.STORAGE_REGION,
      ...(env.STORAGE_ENDPOINT ? { endpoint: env.STORAGE_ENDPOINT } : {}),
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.STORAGE_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY },
    });
  }
  private bucket(b: Bucket) {
    return b === 'public' ? this.env.STORAGE_PUBLIC_BUCKET : this.env.STORAGE_PRIVATE_BUCKET;
  }
  async presignPut(bucket: Bucket, key: string, contentType: string, contentLength: number, ttl = 600): Promise<PresignedPut> {
    // ContentType and ContentLength are part of the signature: the client can't change type or size.
    const cmd = new PutObjectCommand({ Bucket: this.bucket(bucket), Key: key, ContentType: contentType, ContentLength: contentLength });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: ttl, signableHeaders: new Set(['content-type', 'content-length']) });
    return { url, method: 'PUT', headers: { 'content-type': contentType }, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() };
  }
  presignGet(bucket: Bucket, key: string, ttl: number): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket(bucket), Key: key }), { expiresIn: ttl });
  }
  async get(bucket: Bucket, key: string): Promise<Buffer> {
    const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
    return Buffer.from(await out.Body!.transformToByteArray());
  }
  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket(bucket), Key: key, Body: body, ContentType: contentType, CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store' }));
  }
  async delete(bucket: Bucket, key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
  }
  publicUrl(key: string): string {
    return `${this.env.MEDIA_PUBLIC_BASE_URL}/${key}`;
  }
}

/**
 * Local driver: files under LOCAL_STORAGE_DIR, uploads go to PUT /v1/dev-storage/... with an
 * HMAC signature binding bucket, key, type, size and expiry (same guarantees as S3 presign).
 */
export class LocalStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly apiBase: string,
    private readonly secret: string,
  ) {}
  private path(bucket: Bucket, key: string) {
    const p = normalize(join(this.root, bucket, key));
    if (!p.startsWith(normalize(join(this.root, bucket)))) throw new Error('path traversal');
    return p;
  }
  sign(parts: string[]): string {
    return hmac(this.secret, parts.join('\n'));
  }
  verify(parts: string[], sig: string): boolean {
    return safeEqualHex(this.sign(parts), sig);
  }
  async presignPut(bucket: Bucket, key: string, contentType: string, contentLength: number, ttl = 600): Promise<PresignedPut> {
    const exp = String(Math.floor(Date.now() / 1000) + ttl);
    const sig = this.sign(['PUT', bucket, key, contentType, String(contentLength), exp]);
    const qs = new URLSearchParams({ type: contentType, size: String(contentLength), exp, sig });
    return { url: `${this.apiBase}/v1/dev-storage/${bucket}/${key}?${qs}`, method: 'PUT', headers: { 'content-type': contentType }, expiresAt: new Date(Number(exp) * 1000).toISOString() };
  }
  async presignGet(bucket: Bucket, key: string, ttl: number): Promise<string> {
    const exp = String(Math.floor(Date.now() / 1000) + ttl);
    const sig = this.sign(['GET', bucket, key, exp]);
    return `${this.apiBase}/v1/dev-storage/${bucket}/${key}?${new URLSearchParams({ exp, sig })}`;
  }
  async get(bucket: Bucket, key: string): Promise<Buffer> {
    return readFile(this.path(bucket, key));
  }
  async put(bucket: Bucket, key: string, body: Buffer): Promise<void> {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  async delete(bucket: Bucket, key: string): Promise<void> {
    await rm(this.path(bucket, key), { force: true });
  }
  publicUrl(key: string): string {
    return `${this.apiBase}/v1/dev-storage/public/${key}`;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env): Storage =>
        env.STORAGE_DRIVER === 'local'
          ? new LocalStorage(env.LOCAL_STORAGE_DIR, env.API_PUBLIC_URL, env.HASH_PEPPER)
          : new S3Storage(env),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}

