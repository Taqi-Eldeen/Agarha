'use client';
import { useEffect, useRef } from 'react';
import { env } from '@/lib/env';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

/** Cloudflare Turnstile (risk #6): a token is required before any OTP is sent. */
export function Turnstile({
  onToken,
  locale,
}: {
  onToken: (token: string | null) => void;
  locale: 'ar' | 'en';
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    const render = () => {
      if (!el.current || !window.turnstile) return;
      id = window.turnstile.render(el.current, {
        sitekey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        language: locale,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
        appearance: 'interaction-only',
      });
    };
    if (window.turnstile) render();
    else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      if (id) window.turnstile?.remove(id);
    };
  }, [locale, onToken]);
  return <div ref={el} />;
}
