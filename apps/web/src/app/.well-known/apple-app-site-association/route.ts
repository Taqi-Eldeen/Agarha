// iOS Universal Links: listing, dealer and search pages open in the app when it is installed.
export const dynamic = 'force-static';

const PATHS = [
  '/ar/cars/*',
  '/en/cars/*',
  '/ar/dealers/*',
  '/en/dealers/*',
  '/ar/search*',
  '/en/search*',
];

export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const bundle = process.env.IOS_BUNDLE_ID ?? 'com.agarha.app';
  const body = team
    ? {
        applinks: {
          details: [{ appIDs: [`${team}.${bundle}`], components: PATHS.map((p) => ({ '/': p })) }],
        },
      }
    : { applinks: { details: [] } };
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=3600' } });
}
