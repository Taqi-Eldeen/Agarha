# ADR-0013: Media on Cloudflare R2

- Status: Accepted · Date: 2026-09

## Decision

Two buckets: `public-media` (processed listing photos, served through `media.agarha.com` on the
Cloudflare CDN) and `private-docs` (dealer verification documents, never public; admins get
5-minute presigned GETs). Uploads go straight from the client to a presigned PUT locked to content
type and size; the worker validates, strips EXIF (including GPS), and writes AVIF/WebP/JPEG at
320/640/1280 px. The storage port is S3-compatible (`STORAGE_DRIVER=s3`), so AWS S3 or MinIO work
unchanged.

## Consequences

- R2 has no egress fees, which dominates cost for an image-heavy marketplace.
- Documents are personal data: R2 bucket location should follow ADR-0010.
