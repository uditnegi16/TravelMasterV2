/**
 * The site's one public address. The old Amplify default domain still
 * serves the app, but since API Gateway CORS was locked to this origin,
 * pages opened on the old address can't call the API -- most visibly,
 * share links (which used to be generated with the old address) failed
 * to load. Sending those visitors to the real domain fixes both new and
 * already-sent links.
 */
export const CANONICAL_ORIGIN = "https://travel.uditnegi.com";

/** Only the production Amplify branch host -- not other preview branches. */
const LEGACY_HOSTS = new Set(["main.d2dqny356lcrsz.amplifyapp.com"]);

/**
 * Returns the URL to redirect to when the page was opened on a legacy
 * host (same path, query and hash), or null when no redirect is needed.
 */
export function canonicalRedirectUrl(loc: Pick<Location, "hostname" | "pathname" | "search" | "hash">): string | null {
  if (!LEGACY_HOSTS.has(loc.hostname)) return null;
  return `${CANONICAL_ORIGIN}${loc.pathname}${loc.search}${loc.hash}`;
}
