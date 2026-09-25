import type { RequiredDoc } from '@agarha/schemas';
import { CalendarClock, FileText, Gauge, Plane, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { useUi } from '../lib/ui-context';
import { Text } from './text';

export interface RequirementListProps {
  deposit: number;
  minAge: number;
  requiredDocs: RequiredDoc[];
  kmLimitPerDay: number | null;
  airportPickup: boolean;
}

/** "Facts before contact": deposit, age, documents and mileage in one scannable list. */
export function RequirementList({
  deposit,
  minAge,
  requiredDocs,
  kmLimitPerDay,
  airportPickup,
}: RequirementListProps) {
  const { t, f, egp, colors } = useUi();
  const rows = [
    { Icon: ShieldCheck, text: deposit > 0 ? `${t.deposit}: ${egp(deposit)}` : t.noDeposit },
    { Icon: CalendarClock, text: f('minAge', { age: minAge }) },
    { Icon: FileText, text: requiredDocs.map((d) => t.docs[d]).join('، ') },
    {
      Icon: Gauge,
      text: kmLimitPerDay === null ? t.unlimitedKm : f('kmPerDay', { km: kmLimitPerDay }),
    },
    ...(airportPickup ? [{ Icon: Plane, text: t.airportPickup }] : []),
  ];
  return (
    <View accessibilityRole="list" className="gap-3">
      {rows.map(({ Icon, text }) => (
        <View key={text} className="flex-row items-start gap-3">
          <Icon size={20} color={colors.brandPrimary} strokeWidth={1.75} />
          <Text className="flex-1">{text}</Text>
        </View>
      ))}
    </View>
  );
}
