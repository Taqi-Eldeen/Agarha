'use client';
import type { RequiredDoc } from '@agarha/schemas';
import { CalendarClock, FileText, Gauge, Plane, ShieldCheck } from 'lucide-react';
import { useUi } from '../lib/ui-context';

export interface RequirementListProps {
  deposit: number;
  minAge: number;
  requiredDocs: RequiredDoc[];
  kmLimitPerDay: number | null;
  airportPickup: boolean;
}

/** "Facts before contact": deposit, age, documents and mileage in one scannable list. */
export function RequirementList({ deposit, minAge, requiredDocs, kmLimitPerDay, airportPickup }: RequirementListProps) {
  const { t, f, egp } = useUi();
  const rows = [
    { icon: ShieldCheck, text: deposit > 0 ? `${t.deposit}: ${egp(deposit)}` : t.noDeposit },
    { icon: CalendarClock, text: f('minAge', { age: minAge }) },
    { icon: FileText, text: requiredDocs.map((d) => t.docs[d]).join('، ') },
    { icon: Gauge, text: kmLimitPerDay === null ? t.unlimitedKm : f('kmPerDay', { km: kmLimitPerDay }) },
    ...(airportPickup ? [{ icon: Plane, text: t.airportPickup }] : []),
  ];
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.75} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
