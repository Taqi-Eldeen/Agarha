// Quiet hours 22:00–09:00 Africa/Cairo. Non-transactional sends are delayed until 09:00.
const TZ = 'Africa/Cairo';
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 9;

function cairoParts(d: Date): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get('hour'), minute: get('minute'), second: get('second') };
}

export function isQuietHours(d: Date = new Date()): boolean {
  const { hour } = cairoParts(d);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/** Milliseconds until quiet hours end (0 if not in quiet hours). DST-safe: works from Cairo wall-clock. */
export function msUntilQuietEnds(d: Date = new Date()): number {
  if (!isQuietHours(d)) return 0;
  const { hour, minute, second } = cairoParts(d);
  const secondsIntoDay = hour * 3600 + minute * 60 + second;
  const target = QUIET_END_HOUR * 3600;
  const wait = secondsIntoDay < target ? target - secondsIntoDay : 86_400 - secondsIntoDay + target;
  return wait * 1000 - d.getMilliseconds();
}
