'use client';
import { useApi } from '@agarha/api-client';
import { InlineAlert } from '@agarha/ui-web';
import { BarChart3, Building2, CalendarClock, Car, CreditCard, FileUp, MessageSquare, Star, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { Logo } from '../logo';
import { LanguageSwitch } from '../language-switch';
import { isSignedOut, useDealerMe } from './use-dealer';

const TABS = [
  { href: '/dealer/fleet', key: 'fleet', icon: Car, mobile: true },
  { href: '/dealer/leads', key: 'leads', icon: MessageSquare, mobile: true },
  { href: '/dealer/stats', key: 'stats', icon: BarChart3, mobile: true },
  { href: '/dealer/profile', key: 'profile', icon: Building2, mobile: true },
  { href: '/dealer/reviews', key: 'reviews', icon: Star, mobile: false },
  { href: '/dealer/requests', key: 'requests', icon: CalendarClock, mobile: false },
  { href: '/dealer/team', key: 'team', icon: Users, mobile: false, owner: true },
  { href: '/dealer/billing', key: 'billing', icon: CreditCard, mobile: false, owner: true },
  { href: '/dealer/import', key: 'import', icon: FileUp, mobile: false, owner: true },
] as const;

/** Bottom tabs on phones (Fleet · Leads · Stats · Profile), left sidebar on desktop. */
export function DealerShell({ children }: { children: ReactNode }) {
  const t = useTranslations('dealer.nav');
  const tw = useTranslations('web.nav');
  const to = useTranslations('dealer.onboarding');
  const pathname = usePathname();
  const router = useRouter();
  const me = useDealerMe();
  useApi();

  useEffect(() => {
    if (isSignedOut(me.error)) router.replace('/dealer/sign-in');
    else if (me.isSuccess && me.data === null && !pathname.startsWith('/dealer/onboarding')) router.replace('/dealer/onboarding');
  }, [me.error, me.isSuccess, me.data, pathname, router]);

  const role = me.data?.role;
  const tabs = TABS.filter((tab) => !('owner' in tab) || role === 'dealer_owner');
  const active = (href: string) => pathname.startsWith(href);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-e border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-4">
          <Logo />
        </div>
        <nav aria-label={tw('menu')} className="flex flex-col gap-1 p-2">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={active(tab.href) ? 'page' : undefined} className="flex min-h-touch items-center gap-3 rounded-md px-3 hover:bg-brand-subtle aria-[current=page]:bg-brand-subtle aria-[current=page]:font-semibold aria-[current=page]:text-brand">
              <tab.icon aria-hidden className="size-5" strokeWidth={1.75} />
              {t(tab.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-2">
          <LanguageSwitch label={tw('switchTo')} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-header flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Logo />
          <LanguageSwitch label={tw('switchTo')} />
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 p-4 lg:p-6">
          {me.data?.dealer.suspendedAt ? <InlineAlert tone="danger">{to('suspended')}</InlineAlert> : null}
          {children}
        </main>
      </div>
      <nav aria-label={tw('menu')} className="fixed inset-x-0 bottom-0 z-sticky grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.filter((tab) => tab.mobile).map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={active(tab.href) ? 'page' : undefined} className="flex min-h-16 flex-col items-center justify-center gap-1 text-label text-fg-secondary aria-[current=page]:text-brand">
            <tab.icon aria-hidden className="size-6" strokeWidth={1.75} />
            {t(tab.key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
