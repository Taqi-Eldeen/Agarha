/** /cars/{id}-{slug}: id first so the slug can change without breaking links. */
export const listingPath = (card: { id: string; slug: string }) => `/cars/${card.id}-${card.slug}`;
export const parseListingParam = (param: string) => param.slice(0, 36);
