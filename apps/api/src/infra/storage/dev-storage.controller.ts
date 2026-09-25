import { Controller, Get, Inject, Param, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Errors } from '../../common/errors';
import { LocalStorage, STORAGE, type Bucket, type Storage } from './storage';

const MAX = 10 * 1024 * 1024;

/** Only mounted with STORAGE_DRIVER=local. Enforces the same type/size/expiry as an S3 presigned PUT. */
@ApiExcludeController()
@Controller('dev-storage')
export class DevStorageController {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  private local(): LocalStorage {
    if (!(this.storage instanceof LocalStorage)) throw Errors.notFound('Route');
    return this.storage;
  }

  @Put(':bucket/*key')
  async put(
    @Param('bucket') bucket: Bucket,
    @Param('key') keyParts: string[] | string,
    @Query() q: Record<string, string>,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    const s = this.local();
    const key = Array.isArray(keyParts) ? keyParts.join('/') : keyParts;
    if (!q.exp || Number(q.exp) < Date.now() / 1000) throw Errors.forbidden('URL expired');
    if (!s.verify(['PUT', bucket, key, q.type ?? '', q.size ?? '', q.exp], q.sig ?? ''))
      throw Errors.forbidden('Bad signature');
    if (req.headers['content-type'] !== q.type)
      throw Errors.forbidden('Content-Type does not match the signed type');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > MAX || size > Number(q.size))
        throw Errors.forbidden('Body larger than the signed size');
      chunks.push(chunk);
    }
    if (size !== Number(q.size)) throw Errors.forbidden('Body size does not match the signed size');
    await s.put(bucket, key, Buffer.concat(chunks));
    return { ok: true };
  }

  @Get(':bucket/*key')
  async get(
    @Param('bucket') bucket: Bucket,
    @Param('key') keyParts: string[] | string,
    @Query() q: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const s = this.local();
    const key = Array.isArray(keyParts) ? keyParts.join('/') : keyParts;
    if (bucket === 'private') {
      if (
        !q.exp ||
        Number(q.exp) < Date.now() / 1000 ||
        !s.verify(['GET', bucket, key, q.exp], q.sig ?? '')
      )
        throw Errors.forbidden('Bad or expired signature');
      res.setHeader('Cache-Control', 'private, no-store');
    } else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    try {
      const body = await s.get(bucket, key);
      const ext = key.split('.').pop();
      res.type(
        ext === 'webp'
          ? 'image/webp'
          : ext === 'avif'
            ? 'image/avif'
            : ext === 'pdf'
              ? 'application/pdf'
              : ext === 'png'
                ? 'image/png'
                : 'image/jpeg',
      );
      res.send(body);
    } catch {
      throw Errors.notFound('Object');
    }
  }
}
