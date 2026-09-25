import { useLocale } from 'next-intl';

/** Wordmark. A logo: never mirrored. */
export function Logo() {
  const locale = useLocale();
  return (
    <span
      className="flex items-center gap-2 font-display text-h2 font-semibold text-brand"
      dir="ltr"
    >
      <svg aria-hidden viewBox="0 0 32 32" className="size-8">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M8 21l2.5-7a3 3 0 0 1 2.8-2h5.4a3 3 0 0 1 2.8 2L24 21v2.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V22h-9v1.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V21z"
          fill="#fff"
        />
        <circle cx="11.5" cy="18.5" r="1.3" fill="#0F6E68" />
        <circle cx="20.5" cy="18.5" r="1.3" fill="#0F6E68" />
      </svg>
      <span>{locale === 'ar' ? 'أجّرها' : 'Agarha'}</span>
    </span>
  );
}
