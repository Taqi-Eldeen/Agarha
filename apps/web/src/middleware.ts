import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Public pages that stay reachable while the public site is hidden (P2 pilot). */
const ALWAYS_OPEN = /^\/(ar|en)\/(dealer|for-dealers|legal|help)(\/|$)/;

export default function middleware(req: NextRequest) {
  const res = intl(req);
  const path = req.nextUrl.pathname;
  if (process.env.NEXT_PUBLIC_PUBLIC_SITE !== 'on' && /^\/(ar|en)(\/|$)/.test(path) && !ALWAYS_OPEN.test(path)) {
    const locale = path.split('/')[1] ?? 'ar';
    return NextResponse.redirect(new URL(`/${locale}/for-dealers`, req.url));
  }
  return res;
}

export const config = { matcher: ['/((?!api|_next|_vercel|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|icons|.*\\..*).*)'] };
