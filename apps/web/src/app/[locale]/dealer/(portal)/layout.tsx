import type { ReactNode } from 'react';
import { DealerShell } from '@/components/dealer/dealer-shell';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <DealerShell>{children}</DealerShell>;
}
