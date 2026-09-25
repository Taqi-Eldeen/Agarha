import type { Decorator, Preview } from '@storybook/react-vite';
import { UiProvider } from '../src/lib/ui-context';
import { ToastProvider } from '../src/components/feedback';
import '../src/styles.css';

const MODES = [
  { locale: 'ar', theme: 'light' },
  { locale: 'ar', theme: 'dark' },
  { locale: 'en', theme: 'light' },
  { locale: 'en', theme: 'dark' },
] as const;

/** Every story renders in ar/en × light/dark (section 9). Toolbar can narrow it to one mode. */
const withModes: Decorator = (Story, ctx) => {
  const pick = ctx.globals.mode as string | undefined;
  const modes = pick && pick !== 'all' ? MODES.filter((m) => `${m.locale}-${m.theme}` === pick) : MODES;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: modes.length > 1 ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr', gap: 16 }}>
      {modes.map((m) => (
        <div key={`${m.locale}-${m.theme}`} data-theme={m.theme} lang={m.locale} dir={m.locale === 'ar' ? 'rtl' : 'ltr'} className="bg-page p-4 text-fg" style={{ fontFamily: m.locale === 'ar' ? 'IBM Plex Sans Arabic, sans-serif' : 'IBM Plex Sans, sans-serif' }}>
          <p className="mb-2 text-label uppercase text-fg-secondary">{`${m.locale} · ${m.theme}`}</p>
          <UiProvider locale={m.locale}>
            <ToastProvider>
              <Story />
            </ToastProvider>
          </UiProvider>
        </div>
      ))}
    </div>
  );
};

const preview: Preview = {
  decorators: [withModes],
  globalTypes: {
    mode: {
      description: 'Language × theme',
      toolbar: { title: 'Mode', icon: 'globe', items: ['all', 'ar-light', 'ar-dark', 'en-light', 'en-dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { mode: 'all' },
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
};
export default preview;
