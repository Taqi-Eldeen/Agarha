'use client';
import { BarChart3, BookOpen, Building2, CreditCard, Flag, Languages, ListChecks, LogOut, ScrollText, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { adminFetch, useAdminQuery } from '@/lib/api';
import { useT } from '@/lib/i18n';

const NAV = [
  { href: '/', key: 'dashboard', icon: BarChart3 },
  { href: '/dealers', key: 'dealers', icon: Building2 },
  { href: '/listings', key: 'listings', icon: ListChecks },
  { href: '/reports', key: 'reports', icon: Flag },
  { href: '/reviews', key: 'reviews', icon: Star },
  { href: '/catalog', key: 'catalog', icon: BookOpen },
  { href: '/users', key: 'users', icon: Users },
  { href: '/plans', key: 'plans', icon: CreditCard },
  { href: '/audit', key: 'audit', icon: ScrollText },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useT();
  const pathname = usePathname();
  const router = useRouter();
  // Any admin endpoint doubles as the session check.
  const session = useAdminQuery(['session'], '/admin/metrics');
  useEffect(() => {
    if (session.error && (session.error as { status?: number }).status === 401) router.replace('/sign-in');
  }, [session.error, router]);
  return (
    <div className="grid min-h-dvh md:grid-cols-[15rem_1fr]">
      <aside className="border-e border-border bg-card">
        <p className="p-4 font-display text-h2 text-brand">{t('title')}</p>
        <nav aria-label={t('title')} className="flex flex-row flex-wrap gap-1 p-2 md:flex-col">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className="flex min-h-touch items-center gap-3 rounded-md px-3 hover:bg-brand-subtle aria-[current=page]:bg-brand-subtle aria-[current=page]:font-semibold">
                <n.icon aria-hidden className="size-5" strokeWidth={1.75} />
                {t(`nav.${n.key}`)}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 p-2">
          <button type="button" className="flex min-h-touch items-center gap-3 rounded-md px-3 hover:bg-brand-subtle" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
            <Languages aria-hidden className="size-5" strokeWidth={1.75} />
            {locale === 'ar' ? 'English' : 'العربية'}
          </button>
          <button
            type="button"
            className="flex min-h-touch items-center gap-3 rounded-md px-3 hover:bg-brand-subtle"
            onClick={async () => {
              await adminFetch('/auth/admin/sign-out', { method: 'POST' });
              router.replace('/sign-in');
            }}
          >
            <LogOut aria-hidden className="ag-mirror size-5" strokeWidth={1.75} />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>
      <main id="main" className="min-w-0 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
