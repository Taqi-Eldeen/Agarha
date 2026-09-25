import sharp from 'sharp';
import { RejectedMedia, processListingPhoto, sanitiseDocument } from './image-pipeline';
import { sniff } from './magic';

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 15, g: 110, b: 104 } } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: 'TestCam' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '30/1 2/1 0/1' } } })
    .toBuffer();
}

describe('image pipeline', () => {
  it('sniffs magic bytes', async () => {
    expect(sniff(await jpegWithGps())).toBe('image/jpeg');
    expect(sniff(Buffer.from('%PDF-1.7 hello world'))).toBe('application/pdf');
    expect(sniff(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });

  it('strips EXIF/GPS and builds 6 variants + blurhash', async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processListingPhoto(input);
    expect((await sharp(out.original).metadata()).exif).toBeUndefined();
    expect(out.variants).toHaveLength(6);
    for (const v of out.variants) expect((await sharp(v.body).metadata()).exif).toBeUndefined();
    expect(out.variants.find((v) => v.format === 'webp' && v.width === 320)).toBeDefined();
    expect(out.blurhash.length).toBeGreaterThan(6);
    expect(out.width).toBe(1600);
  });

  it('rejects non-images disguised as images', async () => {
    await expect(processListingPhoto(Buffer.from('GIF89a not really an image at all'))).rejects.toBeInstanceOf(RejectedMedia);
  });

  it('accepts PDFs and re-encodes JPEG documents', async () => {
    expect((await sanitiseDocument(Buffer.from('%PDF-1.4 minimal'))).type).toBe('application/pdf');
    const doc = await sanitiseDocument(await jpegWithGps());
    expect((await sharp(doc.body).metadata()).exif).toBeUndefined();
  });
});
