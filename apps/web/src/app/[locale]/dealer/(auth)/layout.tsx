import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { Link } from '@/i18n/routing';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 pt-10">
      <Link href="/for-dealers">
        <Logo />
      </Link>
      {children}
    </main>
  );
}
