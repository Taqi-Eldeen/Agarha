import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const production = process.env.NEXT_PUBLIC_APP_ENV === 'production';
  return {
    // Preview and staging are never indexed.
    rules: production
      ? [
          {
            userAgent: '*',
            allow: '/',
            disallow: ['/*/search', '/*/account', '/*/saved', '/*/dealer/'],
          },
        ]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
