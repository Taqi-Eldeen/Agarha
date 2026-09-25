/** Cairo calendar date (YYYY-MM-DD) `offset` days from today. */
export function cairoDate(offset: number, now = new Date()): string {
  const d = new Date(now.getTime() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
