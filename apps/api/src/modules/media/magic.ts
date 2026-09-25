// File type sniffing from magic bytes. The declared Content-Type is never trusted.
export type Sniffed = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'application/pdf' | null;

export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)$/.test(buf.toString('ascii', 8, 12))) return 'image/heic';
  if (buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}
