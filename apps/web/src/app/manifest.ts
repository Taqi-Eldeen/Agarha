import type { MetadataRoute } from 'next';

/** Installable PWA for the dealer portal (Q8: no native dealer app). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'أجّرها للمكاتب · Agarha for dealers',
    short_name: 'أجّرها',
    description: 'Manage your rental fleet on Agarha',
    start_url: '/ar/dealer',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F7F6',
    theme_color: '#0F6E68',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
