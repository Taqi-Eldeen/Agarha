import { interpolate, messages } from '@agarha/i18n';
import type { Locale } from '@agarha/schemas';

type N = (typeof messages)['ar']['notifications'];

/** Template ids -> catalog keys (title/body). Copy lives in packages/i18n, never here. */
export const TEMPLATES = {
  lead_alert: { title: 'leadAlertTitle', body: 'leadAlertBody', whatsapp: 'lead' },
  availability_nudge: {
    title: 'availabilityNudgeTitle',
    body: 'availabilityNudgeBody',
    whatsapp: 'nudge',
  },
  review_prompt: { title: 'reviewPromptTitle', body: 'reviewPromptBody' },
  saved_search_alert: { title: 'savedSearchTitle', body: 'savedSearchBody' },
  dealer_verified: { title: 'dealerVerifiedTitle', body: 'dealerVerifiedBody' },
  dealer_rejected: { title: 'dealerRejectedTitle', body: 'dealerRejectedBody' },
  availability_request: { title: 'availabilityRequestTitle', body: 'availabilityRequestBody' },
  availability_answer_yes: { title: 'availabilityAnswerYesTitle', body: 'availabilityAnswerBody' },
  availability_answer_no: { title: 'availabilityAnswerNoTitle', body: 'availabilityAnswerBody' },
  listing_hidden: { title: 'listingHiddenTitle', body: 'listingHiddenBody' },
  invoice_paid: { title: 'invoicePaidTitle', body: 'invoicePaidBody' },
} as const satisfies Record<string, { title: keyof N; body: keyof N; whatsapp?: 'lead' | 'nudge' }>;

export type TemplateId = keyof typeof TEMPLATES;

/** Topic used for user preferences. Transactional templates ignore quiet hours and opt-outs. */
export const TEMPLATE_TOPIC: Record<TemplateId, { topic: string; transactional: boolean }> = {
  lead_alert: { topic: 'leads', transactional: true },
  availability_nudge: { topic: 'nudges', transactional: false },
  review_prompt: { topic: 'reviews', transactional: false },
  saved_search_alert: { topic: 'saved_searches', transactional: false },
  dealer_verified: { topic: 'account', transactional: true },
  dealer_rejected: { topic: 'account', transactional: true },
  availability_request: { topic: 'leads', transactional: true },
  availability_answer_yes: { topic: 'availability', transactional: true },
  availability_answer_no: { topic: 'availability', transactional: true },
  listing_hidden: { topic: 'nudges', transactional: false },
  invoice_paid: { topic: 'billing', transactional: true },
};

export function render(
  id: TemplateId,
  locale: Locale,
  vars: Record<string, string | number>,
): { title: string; body: string } {
  const t = TEMPLATES[id];
  const cat = messages[locale].notifications;
  return { title: interpolate(cat[t.title], vars), body: interpolate(cat[t.body], vars) };
}
