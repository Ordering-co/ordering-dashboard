// Install mock-friendly routes in the order Playwright expects.
//
// Playwright runs the newest route first, and `route.fallback({ url })` hands the request, with that URL, to the routes
// registered before it (each matched against the new URL). So the synthetic writes go BEFORE the locale rewrite: the
// rewrite runs first, turns `/<v>/es/<project>/…` into the English prefix, and falls back to the synthetic layer, which
// answers the write or falls back to the guard. Registered the other way round, the synthetic layer saw only the locale
// URL (not its prefix), let it pass, and the rewrite then handed the English URL straight to the guard, which blocked
// every write (seen in J4, ).
import { installLocale } from './live-locale.mjs'
import { installSyntheticWrites } from './live-synthetic.mjs'

// Registers `--synthetic-writes` and `--locale` on a context whose guard is already routed. Returns
// { locale: the locale counters, synthetic: the synthetic handle or null }.
export async function installApiRoutes (context, { locale, apiOrigin, apiPrefix, localOrigin, version, project, observed, synthetic = false, fail, catalog }) {
  const writes = synthetic ? await installSyntheticWrites(context, { localOrigin, apiOrigin, apiPrefix, fail }) : null
  const localeStats = await installLocale(context, { locale, apiOrigin, version, project, observed, catalog })
  return { locale: localeStats, synthetic: writes }
}
