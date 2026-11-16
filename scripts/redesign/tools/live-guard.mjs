// redesign W0-9a (T0-36)
// The live session's network guard as a pure function, so a test can pin every rule.
// Lets through: local GET/HEAD, the login POST, and GET/OPTIONS under the project's API prefix.
// Everything else (writes and third parties) is blocked, and so are the GETs that have side effects.

// Each pattern runs on the API pathname with the version/language/project prefix removed
// (leading slash kept). Order matters: specific rules come before the generic ones, and the
// first match names the rule in `decide(...).pattern`.
export const SIDE_EFFECT_PATTERNS = [
  // redesign W0-9a (T0-36)
  { name: 'chat-read-mark', pattern: /\/messages\/.+\/read\/?$/i }, // GET /orders/:id/messages/:mid/read marks messages read
  { name: 'payment-reports-download', pattern: /\/business_payment_reports\/download\/?$/i }, // generates the payments CSV
  { name: 'payment-history', pattern: /\/business_payment_invoices\/payment_history\/?$/i }, // generates a consolidated PDF
  { name: 'school-reports', pattern: /\/backoffice\/schools\/[^/]+\/reports\/.+\.(?:xlsx|pdf)\/?$/i }, // generates reports
  { name: 'school-labels', pattern: /\/backoffice\/schools\/.+\/labels\.pdf\/?$/i }, // generates labels
  { name: 'paymethods-requirements', pattern: /\/billing\/paymethods\/requirements\/?$/i }, // creates a Stripe client_secret
  { name: 'internal-token-current', pattern: /\/integrations\/internal\/tokens\/current\/?$/i }, // issues a billing token
  { name: 'google-permissions-request', pattern: /\/users\/[^/]+\/google\/permissions\/request\/?$/i }, // starts a Google OAuth
  // downloads the artifact; redesign my-products: also the per-platform files (…/downloads/android/release/apk)
  { name: 'builder-app-downloads', pattern: /\/builder\/apps\/[^/]+\/downloads(?:\/.*)?$/i },
  // B2: Builder's «Download» of a build mints a signed link that lasts 15 minutes (getBuilderBuildDownload); named, so it
  // does not rest on generic-download
  { name: 'builder-build-download', pattern: /\/builder\/.+\/builds\/[^/]+\/download\/?$/i },
  // redesign ordering-website: the white label of a brand or a store CREATES its site when it has none (a review
  { name: 'white-label-site-current', pattern: /\/(?:franchises|business)\/[^/]+\/sites\/current\/?$/i },
  { name: 'generic-csv', pattern: /\.csv\/?$/i }, // the CSV export queues a job and emails it
  { name: 'generic-xlsx', pattern: /\.xlsx\/?$/i },
  { name: 'generic-pdf', pattern: /\.pdf\/?$/i },
  { name: 'generic-download', pattern: /\/downloads?\/?$/i },
  { name: 'generic-export', pattern: /\/exports?(?:\/|$)/i }
]

// fila 45: the path as the server may read it: percent escapes decoded (again while a pass still decodes
// something, so `%2561` is `a` too), repeated slashes collapsed and the dot segments that decoding uncovers resolved
// (`x%2F..%2Fauth`). `//auth`, `/%61uth` and `/auth%2Fsms` are /auth and /auth/sms for the API.
export function canonicalPath (path) {
  let out = String(path)
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    if (next === out) break
    out = next
  }
  const segments = []
  for (const segment of out.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment !== '.' && segment !== '') segments.push(segment)
  }
  return `/${segments.join('/')}${/\/$/.test(out) && segments.length ? '/' : ''}`
}

// A rule holds when it matches the path as sent OR as the server may read it. Only one reading is not enough either way:
// decoding a `%2F` inside an id splits it (`franchises/a%2Fb/sites/current` no longer fits `[^/]+`), while `/%61uth`
// only fits once decoded (review r1 #1). Both readings only ever block more.
export const ruleHolds = (pattern, path) => pattern.test(path) || pattern.test(canonicalPath(path))

// → { allow, reason, pattern? }. reason: local | login | api-read | side-effect | write | third-party.
export function decide ({ method, url, localOrigin, apiOrigin, apiPrefix }) {
  const parsed = new URL(url)
  const verb = String(method).toUpperCase()
  const apiPath = parsed.origin === apiOrigin && parsed.pathname.startsWith(apiPrefix)
  if (apiPath) {
    const rest = `/${parsed.pathname.slice(apiPrefix.length)}`
    const hit = SIDE_EFFECT_PATTERNS.find(({ pattern }) => ruleHolds(pattern, rest))
    // GETs with side effects are writes for this guard.
    if (hit) return { allow: false, reason: 'side-effect', pattern: hit.name }
  }
  if (parsed.origin === localOrigin && ['GET', 'HEAD'].includes(verb)) return { allow: true, reason: 'local' }
  if (parsed.origin === apiOrigin && parsed.pathname === `${apiPrefix}auth` && verb === 'POST') return { allow: true, reason: 'login' }
  if (apiPath && ['GET', 'OPTIONS'].includes(verb)) return { allow: true, reason: 'api-read' }
  if (apiPath || parsed.origin === localOrigin) return { allow: false, reason: 'write' }
  return { allow: false, reason: 'third-party' }
}
