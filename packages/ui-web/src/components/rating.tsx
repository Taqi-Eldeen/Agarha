import { Star } from 'lucide-react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export function RatingStars({ value, size = 'md', onChange }: { value: number; size?: 'sm' | 'md'; onChange?: (v: number) => void }) {
  const { f } = useUi();
  const cls = size === 'sm' ? 'size-4' : 'size-7';
  if (onChange)
    return (
      <div role="radiogroup" aria-label={f('rating', { rating: value })} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={f('rating', { rating: n })} onClick={() => onChange(n)} className="inline-flex size-12 items-center justify-center">
            <Star aria-hidden className={cn(cls, n <= value ? 'fill-featured text-featured' : 'text-border')} strokeWidth={1.75} />
          </button>
        ))}
      </div>
    );
  return (
    <span role="img" aria-label={f('rating', { rating: value })} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={cn(cls, n <= Math.round(value) ? 'fill-featured text-featured' : 'text-border')} strokeWidth={1.75} />
      ))}
    </span>
  );
}

export function ReviewItem({ rating, body, date, reply }: { rating: number; body: string | null; date: string; reply: string | null }) {
  const { t, ago } = useUi();
  return (
    <article className="flex flex-col gap-2 border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between">
        <RatingStars value={rating} size="sm" />
        <time dateTime={date} className="text-caption text-fg-secondary">
          {ago(date)}
        </time>
      </div>
      {body ? <p>{body}</p> : null}
      {reply ? (
        <div className="rounded-md bg-brand-subtle p-3 text-caption">
          <p className="mb-1 font-semibold">{t.dealerReply}</p>
          <p>{reply}</p>
        </div>
      ) : null}
    </article>
  );
}
