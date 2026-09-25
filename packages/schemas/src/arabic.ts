// Arabic search normalisation. Mirrors the SQL function ag_normalize_ar() in migration 0000;
// an integration test asserts both give the same output.
//   - strips tashkeel (harakat) and tatweel
//   - alef forms (أ إ آ ٱ) -> ا
//   - alef maqsura ى -> ي
//   - taa marbuta ة -> ه
//   - Arabic-Indic digits -> 0-9
//   - lowercases Latin
const TASHKEEL = /[ً-ْٰـ]/g;
const MAP: Record<string, string> = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه' };

export function normalizeArabic(input: string): string {
  return input
    .replace(TASHKEEL, '')
    .replace(/[أإآٱىة]/g, (c) => MAP[c] ?? c)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
