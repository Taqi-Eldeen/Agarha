'use client';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';
import { Button } from './button';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const { f } = useUi();
  return (
    <nav aria-label={f('step', { current: current + 1, total: steps.length })}>
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? 'step' : undefined}>
            <span className={cn('ag-tabular flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold', i < current ? 'bg-brand text-white dark:text-page' : i === current ? 'border-2 border-brand text-brand' : 'border border-border text-fg-secondary')}>
              {i < current ? <Check aria-hidden className="size-4" strokeWidth={2} /> : i + 1}
            </span>
            <span className={cn('hidden text-caption md:inline', i === current ? 'font-semibold' : 'text-fg-secondary')}>{s}</span>
            {i < steps.length - 1 ? <span aria-hidden className="h-px flex-1 bg-border" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface WizardProps {
  steps: string[];
  current: number;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}

/** Add-car / onboarding wizard frame. The step body gets focus on change for screen readers. */
export function Wizard({ steps, current, onBack, onNext, nextLabel, nextDisabled, busy, children }: WizardProps) {
  const { t } = useUi();
  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} current={current} />
      <section aria-live="polite" className="flex flex-col gap-4">
        <h2 className="text-h2">{steps[current]}</h2>
        {children}
      </section>
      <div className="flex gap-2">
        {onBack && current > 0 ? (
          <Button variant="secondary" onClick={onBack}>
            {t.back}
          </Button>
        ) : null}
        <Button className="flex-1" onClick={onNext} disabled={nextDisabled} loading={busy}>
          {nextLabel ?? t.next}
        </Button>
      </div>
    </div>
  );
}
