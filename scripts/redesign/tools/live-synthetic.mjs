// redesign W0-9d (T0-39)
// --synthetic-writes for the live session: a write to the project's API (POST, PUT, PATCH, DELETE
// under the prefix) never reaches the network. It is answered with a plausible synthetic response
// in the API's own shape and recorded in `observed.synthetic`, so a reviewer can use a real
// create/edit/delete flow against real data without touching it.
//
// What is never simulated (and stays blocked by live-guard.mjs): the login, third parties, the
// GETs with side effects, and the writes in NEVER_SIMULATE below. Their success would be a lie
// about money moving, a message going out, or a third party being called.
import { decide, ruleHolds } from './live-guard.mjs'
import { messageRecord } from './fake-socket.mjs' // redesign B1c (W1-QB1-07): one message shape for the socket and for the POST

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

// Each pattern runs on the API pathname with the version/language/project prefix removed (leading
// slash kept). The first match names the rule. Removing a rule from the list turns its test red.
export const NEVER_SIMULATE = [
  { name: 'auth', pattern: /^\/auth(?:\/|$)/i, reason: 'login, SMS and social sign-in are real sessions, not project data' },
  { name: 'refunds', pattern: /(?:^|\/)refunds?(?:\/|$)/i, reason: 'a fake refund would look like money returned to a customer' },
  { name: 'payments', pattern: /(?:^|\/)(?:payments?|business_payment_[a-z_]+)(?:\/|$)/i, reason: 'a fake charge or payment account would look like money moved' },
  { name: 'billing', pattern: /(?:^|\/)billing(?:\/|$)/i, reason: 'subscriptions and invoices are the tenant\'s real billing' },
  { name: 'paymethods', pattern: /(?:^|\/)paymethods?(?:\/|$)/i, reason: 'payment methods and cards are payment data' },
  { name: 'wallet-events', pattern: /(?:^|\/)wallets\/[^/]+\/events(?:\/|$)/i, reason: 'wallet events credit or debit a customer balance' },
  { name: 'campaign-send', pattern: /(?:^|\/)(?:marketing_)?campaigns\/[^/]+\/send(?:\/|$)/i, reason: 'a campaign send reaches real customers' },
  { name: 'notifications', pattern: /(?:^|\/)notifications?(?:\/|$)/i, reason: 'notifications are delivered to real people' },
  { name: 'send', pattern: /(?:^|\/)send(?:_[a-z_]+)?(?:\/|$)/i, reason: 'a send (email, SMS, push) reaches real people' },
  { name: 'sync', pattern: /(?:^|\/)sync(?:_[a-z_]+)?(?:\/|$)/i, reason: 'a sync calls a third party (Google Calendar, a menu or store integration, billing)' },
  { name: 'third-party-integrations', pattern: /(?:^|\/)(?:third_party_integrations|integrations|google)(?:\/|$)/i, reason: 'integrations act on third-party accounts' },
  { name: 'languages', pattern: /(?:^|\/)languages(?:\/|$)/i, reason: 'M-02: languages feed the app\'s own translations; a fake success hides that' }
]

const SECRET_KEY = /pass(?:word)?|token|secret|key|card|cvv|cvc|pin|authorization/i
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

// The API-relative path ("/orders/1"), query removed; null when the URL is not under the prefix.
export function apiPathOf (url, { apiOrigin, apiPrefix }) {
  const parsed = new URL(url)
  if (parsed.origin !== apiOrigin || !parsed.pathname.startsWith(apiPrefix)) return null
  return `/${parsed.pathname.slice(apiPrefix.length)}`
}

// → { synthesize, reason, rule?, path? }. request: { method, url }. ctx: { localOrigin, apiOrigin, apiPrefix }.
// reason: synthetic | not-a-write | login | local | third-party | side-effect | never-simulate.
export function shouldSynthesize (request, ctx) {
  const method = String(request.method).toUpperCase()
  const verdict = decide({ method, url: request.url, ...ctx })
  const path = apiPathOf(request.url, ctx)
  if (path === null) return { synthesize: false, reason: verdict.reason === 'local' || verdict.reason === 'write' ? 'local' : 'third-party' }
  if (verdict.reason === 'side-effect') return { synthesize: false, reason: 'side-effect', rule: verdict.pattern, path }
  if (verdict.reason === 'login') return { synthesize: false, reason: 'login', rule: 'login', path }
  if (!WRITE_METHODS.includes(method)) return { synthesize: false, reason: 'not-a-write', path }
  // fila 45: `//auth` and `/%61uth` are /auth for the server (note 6); `path` stays as sent
  const hit = NEVER_SIMULATE.find(({ pattern }) => ruleHolds(pattern, path))
  if (hit) return { synthesize: false, reason: 'never-simulate', rule: hit.name, path }
  return { synthesize: true, reason: 'synthetic', rule: 'api-write', path }
}

// JSON, urlencoded or multipart body → plain object (files become a 1x1 image or a marker).
export function parseBody (raw, contentType = '') {
  if (raw == null || raw === '') return {}
  const text = String(raw)
  if (/multipart\/form-data/i.test(contentType) || /^--[^\r\n]+\r?\n/.test(text)) {
    const out = {}
    for (const part of text.split(/\r?\n--[^\r\n]+/)) {
      const head = part.match(/name="([^"]+)"(?:; filename="([^"]*)")?/)
      if (!head) continue
      if (head[2] !== undefined) out[head[1]] = /image\//i.test(part.slice(0, 400)) ? PIXEL : 'synthetic-file'
      else out[head[1]] = part.split(/\r?\n\r?\n/).slice(1).join('\n\n').replace(/\r?\n$/, '')
    }
    return out
  }
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : { value }
  } catch (_) {
    if (/application\/x-www-form-urlencoded/i.test(contentType)) return Object.fromEntries(new URLSearchParams(text))
    return {}
  }
}

// The body as the registry keeps it: keys with short values, secrets and files redacted.
export function summarizeBody (body) {
  if (!body || typeof body !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(body)) {
    if (SECRET_KEY.test(key)) out[key] = '[redacted]'
    else if (typeof value === 'string') out[key] = value.startsWith('data:') ? '[file]' : value.length > 80 ? `${value.slice(0, 80)}…` : value
    else if (value && typeof value === 'object') out[key] = Array.isArray(value) ? `[array ${value.length}]` : '[object]'
    else out[key] = value
  }
  return out
}

// redesign B1c (W1-QB1-07): who the session is, for the `author` of what it sends. It is learnt from the login answer
// (GET/POST /auth, only id, name, lastname and level are kept; the token is never read). The fallback is only for a session
// that never saw a login, and it is plainly synthetic.
export const FALLBACK_USER = { id: 990000, name: 'Synthetic', lastname: 'Operator', level: 0 }

// → { id, name, lastname, level } from a /auth answer, or null when it is not a user.
export function sessionUserFrom (json) {
  const result = json && !json.error ? json.result : null
  if (!result || typeof result !== 'object' || !Number.isInteger(result.id)) return null
  return { id: result.id, name: result.name ?? '', lastname: result.lastname ?? '', level: Number.isInteger(result.level) ? result.level : 0 }
}

const MESSAGES_PATH = /^\/orders\/(\d+)\/messages\/?$/
// lists bring many records at once (was 200 when only GET /x/:id gave a base). Each base is a whole record
// (an order can weigh tens of KB), so the cap stays small; the least recently seen goes first.
export const MAX_BASES = 500

const lastSegment = path => path.replace(/\/+$/, '').split('/').pop()
const asId = segment => (/^\d+$/.test(segment) ? Number(segment) : segment)
// (T-1): a path that ends in a numeric id names one record. The API updates it with POST as well as PUT
// (the SDK's save() with an id, and every POST /<resource>/:id of the dashboard); POST /<collection> creates.
const isRecordPath = path => /^\d+$/.test(lastSegment(path))
const keyOf = path => path.replace(/\/+$/, '') // one base per record, with or without a trailing slash
const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

// (T-2): the dashboard sends lists and objects as JSON text (`administrators: JSON.stringify([ids])`, or
// null when it empties the list); the API answers them with their own type. A field takes the type it has in the
// record: JSON text of the same kind is parsed, a list of ids over a list of records becomes those records (the ones
// the record or `known` already has, else just `{ id }`), and null over a list is an empty list. Without a base, or
// when the text is not of the record's kind, the field stays as it was sent: no type and no field is invented.
// `known`: the items of the same field in other records of the collection. They tell whether an empty list holds
// records (seen live: checking a group nobody managed yet answered `administrators: [72]`, and the box unchecked itself).
const isRecord = item => isPlainObject(item) && item.id != null

// (review): a form (multipart, urlencoded) sends every field as text; over a boolean or a number of the
// record it takes that type ("false" is truthy: a switch would turn itself back on), and a list of ids may also come as
// a JSON array rather than as text.
const FORM_BOOL = /^(?:true|false|1|0)$/

// fila 46 (T-4 residual of ): the fields the dashboard reads as lists of records, by collection. When
// neither the record nor its collection has an item in the field yet (no group has managers), nothing says what the list
// holds; these say it from the reader: K/DriverGroupSetting does `group.administrators.find(admin => admin.id …)` and the
// same on `drivers` (DriverGroupSetting/index.js:195-196). Items seen in the data still win over this table.
export const RECORD_LISTS = { drivergroups: ['administrators', 'drivers'] }
const recordListsOf = path => {
  const segments = keyOf(path).split('/')
  return RECORD_LISTS[segments[segments.length - 2]] || []
}

function typedValue (value, current, known = [], readAsRecords = false) {
  if (typeof value === 'string' && typeof current === 'boolean' && FORM_BOOL.test(value)) return value === 'true' || value === '1'
  if (typeof value === 'string' && typeof current === 'number' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  if (!current || typeof current !== 'object') return value
  if (value === null) return Array.isArray(current) ? [] : value
  let parsed
  if (Array.isArray(value) && Array.isArray(current)) parsed = value
  else if (typeof value !== 'string') return value
  else {
    try { parsed = JSON.parse(value) } catch (_) { return value }
  }
  if (Array.isArray(current) !== Array.isArray(parsed) || !parsed || typeof parsed !== 'object') return value
  const pool = Array.isArray(current) ? [...current, ...known].filter(isRecord) : []
  if (!Array.isArray(parsed)) return parsed
  const nothingKnown = Array.isArray(current) && !current.length && !known.length
  if (!pool.length && !(readAsRecords && nothingKnown)) return parsed
  return parsed.map(item => isPlainObject(item) ? item : pool.find(record => String(record.id) === String(item)) || { id: item })
}

function typedFields (fields, base, siblings, recordLists = []) {
  const out = {}
  for (const [key, value] of Object.entries(fields)) {
    const known = siblings.flatMap(record => Array.isArray(record?.[key]) ? record[key] : [])
    out[key] = Object.hasOwn(base, key) ? typedValue(value, base[key], known, recordLists.includes(key)) : value
  }
  return out
}

// → the JSON the API would answer. `body` is the parsed request body; `opts.id` is the id a POST
// gets; `opts.base` is the last real GET of that resource, so a PUT returns the whole resource
// with the changed fields instead of only the changes. redesign B1c (W1-QB1-07): a POST to
// `/orders/:id/messages` answers with a whole message (author, created_at in UTC, can_see...) because the
// chat draws those fields of what it just sent; `opts.user` is the author, `opts.now` the clock.
// a POST to a record (`/users/:id`) is an update and answers like a PUT; only a POST to a collection
// creates with `opts.id`. `opts.siblings`: other known records of the same collection (see typedValue).
export function syntheticResponse (method, path, body = {}, { id = 990001, base = null, siblings = [], user = FALLBACK_USER, now } = {}) {
  const verb = String(method).toUpperCase()
  const fields = body && typeof body === 'object' ? body : {}
  if (verb === 'DELETE') return { error: false, result: {} }
  if (verb === 'POST') {
    const sent = MESSAGES_PATH.exec(path)
    if (sent) {
      const type = Number(fields.type) || 2
      const file = typeof fields.file === 'string' && fields.file ? fields.file : null // the upload: the API answers with its url in `source`
      return {
        error: false,
        result: messageRecord({
          id,
          orderId: Number(sent[1]),
          type,
          comment: fields.comment ?? null,
          canSee: fields.can_see ?? '3,0,2',
          author: user,
          source: type === 3 ? (file && file.startsWith('data:') ? file : PIXEL) : null,
          read: true, // the user's own message: the author has read it
          createdAt: now
        })
      }
    }
    if (!isRecordPath(path)) return { error: false, result: { ...fields, id } }
  }
  if (verb === 'POST' || verb === 'PUT' || verb === 'PATCH') {
    const current = isPlainObject(base) ? base : {}
    const result = { ...current, ...typedFields(fields, current, siblings, recordListsOf(path)) }
    if (isRecordPath(path)) result.id = asId(lastSegment(path))
    return { error: false, result }
  }
  throw new Error(`syntheticResponse: ${verb} is not a write`)
}

// fila 46: the API answers a wallet put on or taken off a cart (`POST /carts/:uuid/wallets`,
// `DELETE /carts/:uuid/wallets/:id`) with the cart, and K/PaymentOptionWallet stores that answer as the cart of its
// business. The session answers with the cart as it last read it (the order options or `GET /carts/:uuid`): the balance
// is not applied (the server computes it). With no cart read, a local failure says so instead of a shape the page would
// store under `businessId:undefined`. The other cart writes (add_product, PUT /carts/:uuid…) are not modelled here.
const CART_PATH = /^\/carts\/([^/]+)\/?$/
const CART_WALLETS_PATH = /^\/carts\/([^/]+)\/wallets(?:\/[^/]+)?\/?$/
const isCart = value => isPlainObject(value) && typeof value.uuid === 'string' && !!value.uuid

// → the carts a GET answer brings: the cart of `GET /carts/:uuid`, or the `carts` of the order options.
export function cartsIn (path, result) {
  if (CART_PATH.test(path) && isCart(result)) return [result]
  if (isPlainObject(result) && Array.isArray(result.carts)) return result.carts.filter(isCart)
  return []
}

export const cartWalletUuid = path => CART_WALLETS_PATH.exec(path)?.[1] ?? null

// what the session wrote stays in memory (never on disk) and the GETs that follow read it back, as the API
// would answer them had the write reached it. Only records (`/x/:id`): the GET of the record and the lists of its
// collection (`/x?…`) get the written fields over the real answer; a deleted record leaves the lists and its GET
// answers as the API does for an id that does not exist; a created record answers its own GET.
// What it does not cover (redesign/pages/live-synthetic-persistence/tracker.md › Límites), left as the real API answers:
// - a created record is not added to any list: where it sits and whether the list's filters take it is the server's;
// - filters: only a simple condition (equality or a list of values, AND or no conector) on a field the session wrote
//   takes the record out of a list it no longer meets; OR, operators and nested conditions are not evaluated, and a
//   record that now meets a filter is not added (Olivia turned off does not appear in the Inactive list);
// - a record embedded in another resource (the managers inside a group), and a field the real answer does not bring;
// - writes to a path without a numeric id (`/business/5/schedule`). With --locale the writes arrive here already under the
//   English prefix (live-routes.mjs).
export const MISSING_ID = 999999999
const collectionOf = key => key.slice(0, key.lastIndexOf('/'))

// → { update, create, remove, of, inCollection, size }: one entry per record key, { fields } | { created } | { deleted }
export function createWriteMemory () {
  const records = new Map()
  return {
    update (path, fields) {
      const key = keyOf(path)
      const previous = records.get(key)
      if (previous?.deleted) return
      if (previous?.created) records.set(key, { created: { ...previous.created, ...fields } })
      else records.set(key, { fields: { ...previous?.fields, ...fields } })
    },
    create (path, record) { records.set(keyOf(path), { created: record }) },
    remove (path) { records.set(keyOf(path), { deleted: true }) },
    of: path => records.get(keyOf(path)) || null,
    // what can change a list of the collection: written fields and deletions (a created record is never in a real list)
    inCollection (path) {
      const collection = keyOf(path)
      return new Map([...records].filter(([key, entry]) => collectionOf(key) === collection && !entry.created))
    },
    size: () => records.size
  }
}

// The written fields over a real record: only the fields it brings (never a password or a write-only field), each with
// the type it has there.
function overlay (record, fields, known = () => []) {
  const out = { ...record }
  for (const [key, value] of Object.entries(fields)) {
    if (Object.hasOwn(record, key)) out[key] = typedValue(value, record[key], known(key))
  }
  return out
}

const asBool = value => value === true || value === 1 || value === '1' || value === 'true'
const sameValue = (a, b) => typeof a === 'boolean' || typeof b === 'boolean' ? asBool(a) === asBool(b) : String(a) === String(b)
const isScalar = value => value === null || ['string', 'number', 'boolean'].includes(typeof value)

// The simple conditions of a `where` (equality or a list of values, AND or no conector), or null when it is anything else.
function simpleConditions (where) {
  if (!where) return null
  let parsed
  try { parsed = JSON.parse(where) } catch (_) { return null }
  const conditions = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed) && Array.isArray(parsed.conditions) && String(parsed.conector ?? 'AND').toUpperCase() === 'AND' ? parsed.conditions : null
  if (!conditions) return null
  const simple = condition => isPlainObject(condition) && typeof condition.attribute === 'string' && !('conditions' in condition) &&
    (isScalar(condition.value) || (Array.isArray(condition.value) && condition.value.every(isScalar)))
  return conditions.every(simple) ? conditions : null
}

// Whether a record the session wrote no longer meets a condition on one of the fields it wrote.
function leavesFilter (conditions, fields, record) {
  return !!conditions && conditions.some(({ attribute, value }) => Object.hasOwn(fields, attribute) && Object.hasOwn(record, attribute) &&
    !(Array.isArray(value) ? value : [value]).some(option => sameValue(record[attribute], option)))
}

// → the JSON of a GET of the record with what the session wrote over it; untouched when it is an error or not a record.
export function readRecord (json, entry, known) {
  if (!entry?.fields || !json || json.error || !isPlainObject(json.result)) return json
  return { ...json, result: overlay(json.result, entry.fields, known) }
}

// → the JSON of a list of `collection` with what the session wrote over its records. `entries`: createWriteMemory().inCollection().
export function readList (json, entries, { collection, where = null, known = () => [] } = {}) {
  if (!json || json.error || !Array.isArray(json.result) || !entries.size) return json
  const conditions = simpleConditions(where)
  const siblingsKnown = key => [...json.result.flatMap(record => Array.isArray(record?.[key]) ? record[key] : []), ...known(key)]
  let removed = 0
  const result = []
  for (const record of json.result) {
    const entry = isPlainObject(record) && record.id != null ? entries.get(`${keyOf(collection)}/${record.id}`) : null
    if (!entry) { result.push(record); continue }
    if (entry.deleted) { removed += 1; continue }
    const next = overlay(record, entry.fields, siblingsKnown)
    if (leavesFilter(conditions, entry.fields, next)) { removed += 1; continue }
    result.push(next)
  }
  const out = { ...json, result }
  // what this page lost; the real API would also refill the page from the next one (not emulated)
  if (removed && isPlainObject(json.pagination) && Number.isFinite(json.pagination.total)) out.pagination = { ...json.pagination, total: Math.max(0, json.pagination.total - removed) }
  return out
}

// The GET that asks the API how it answers a record of the same collection that does not exist, or null when the guard
// would block it (some GETs create things: site 397 of ) or the URL is not a record.
export function missingProbeUrl (url, ctx) {
  const path = apiPathOf(url, ctx)
  if (path === null || !isRecordPath(path)) return null
  const probe = new URL(url)
  probe.pathname = probe.pathname.replace(/\d+(\/*)$/, `${MISSING_ID}$1`)
  const verdict = decide({ method: 'GET', url: probe.href, ...ctx })
  return verdict.allow && verdict.reason === 'api-read' ? probe.href : null
}
export const missingResponse = () => ({ error: true, result: ['Synthetic: this record was deleted in this live session (--synthetic-writes)'] })

// redesign stores 1.0: --synthetic-fail <METHOD> <path pattern> answers the writes it names as the API
// does when it fails, so a "the save fails" criterion can be checked live. A pattern is an API path without the
// prefix: `:name` is one segment, `*` is the rest of the path. It only ever answers a failure, locally: it can also
// target a write of NEVER_SIMULATE (a failure does not pretend money moved), but never the login or /auth.
export const DEFAULT_FAIL_MESSAGE = 'Synthetic failure (--synthetic-fail)'
const FAIL_METHODS = [...WRITE_METHODS, '*']

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// → { method, pattern, test(path) }. method: a write verb or '*'.
export function compileFailRule ({ method, pattern }) {
  const verb = String(method).toUpperCase()
  if (!FAIL_METHODS.includes(verb)) throw new Error(`--synthetic-fail: method must be one of ${FAIL_METHODS.join(', ')}, got ${method}`)
  if (typeof pattern !== 'string' || !pattern || pattern.startsWith('--')) throw new Error(`--synthetic-fail ${verb}: missing the path pattern`)
  const segments = pattern.replace(/^\/+|\/+$/g, '').split('/')
  if (segments.some((segment, i) => segment.includes('*') && (segment !== '*' || i < segments.length - 1))) {
    throw new Error(`--synthetic-fail ${verb} ${pattern}: \`*\` is only the last whole segment (the rest of the path); use :name for one segment`)
  }
  const source = segments.map(segment => segment === '*' ? '.*' : segment.startsWith(':') ? '[^/]+' : escapeRegExp(segment)).join('/')
  const regex = new RegExp(`^/${source}/?$`, 'i')
  return { method: verb, pattern, test: path => regex.test(path) }
}

export function matchFailRule (rules, method, path) {
  const verb = String(method).toUpperCase()
  return rules.find(rule => (rule.method === '*' || rule.method === verb) && rule.test(path)) || null
}

export const failureResponse = message => ({ error: true, result: [message] })

// → { rules, message, status } from the live session's argv. Each `--synthetic-fail` takes a method and a pattern.
export function failFromArgv (argv) {
  const rules = []
  argv.forEach((token, i) => {
    if (token === '--synthetic-fail') rules.push(compileFailRule({ method: argv[i + 1], pattern: argv[i + 2] }))
  })
  if (rules.length && !argv.includes('--synthetic-writes')) throw new Error('--synthetic-fail needs --synthetic-writes')
  const messageAt = argv.indexOf('--synthetic-fail-message')
  const statusAt = argv.indexOf('--synthetic-fail-status')
  if ((messageAt > -1 || statusAt > -1) && !rules.length) throw new Error('--synthetic-fail-message and --synthetic-fail-status need a --synthetic-fail rule')
  const message = messageAt > -1 ? argv[messageAt + 1] : DEFAULT_FAIL_MESSAGE
  if (typeof message !== 'string' || !message || message.startsWith('--')) throw new Error('--synthetic-fail-message needs a text')
  // a failure the app can read: a 2xx/3xx would pass as success or drop the body
  const status = statusAt > -1 ? Number(argv[statusAt + 1]) : 400
  if (!Number.isInteger(status) || status < 400 || status > 599) throw new Error(`--synthetic-fail-status must be a 4xx or 5xx, got ${argv[statusAt + 1]}`)
  return { rules, message, status }
}

// The rule a write is forced to fail by, or null. Never the login or /auth, never a read or a GET with side effects.
function failRuleFor (rules, method, url, ctx) {
  if (!rules.length) return null
  const verdict = shouldSynthesize({ method, url }, ctx)
  const failable = verdict.synthesize || (verdict.reason === 'never-simulate' && verdict.rule !== 'auth')
  return failable ? matchFailRule(rules, method, verdict.path) : null
}

// Installs the handler on a Playwright context. Register it AFTER the guard's own route: Playwright
// runs the last registered route first, so a synthesized write is answered here and never reaches
// the guard; everything else goes on to the guard with route.fallback(). Returns { log, count, failed }.
// `fail` (redesign stores 1.0): { rules (compileFailRule), message, status } from --synthetic-fail.
export async function installSyntheticWrites (context, { localOrigin, apiOrigin, apiPrefix, firstId = 990001, maxLog = 1000, user: givenUser = null, fail = null } = {}) {
  if (!apiOrigin || !apiPrefix) throw new Error('installSyntheticWrites needs apiOrigin and apiPrefix')
  const ctx = { localOrigin, apiOrigin, apiPrefix }
  const failRules = fail?.rules || []
  const registry = []
  const seen = new Map() // last real GET result per path, to answer PUT with the whole resource
  // a GET of the record replaces its base; a list only adds what it read (often a `params=` subset)
  const remember = (path, record, { merge = false } = {}) => {
    const key = keyOf(path)
    const previous = merge ? seen.get(key) : null
    seen.delete(key) // re-inserted last: the oldest base is the first to go
    seen.set(key, previous ? { ...previous, ...record } : record)
    while (seen.size > MAX_BASES) seen.delete(seen.keys().next().value)
  }
  // the other known records of the collection of `path` (/drivergroups/199 → /drivergroups/3, /drivergroups/7…)
  const siblingsOf = path => {
    const key = keyOf(path)
    return [...seen].filter(([other]) => collectionOf(other) === collectionOf(key)).map(([, record]) => record)
  }
  let nextId = firstId
  let count = 0
  let failed = 0
  let sessionUser = givenUser
  // what the session wrote, read back by the GETs that follow (see createWriteMemory)
  const memory = createWriteMemory()
  const readById = new Set() // collections whose GET by id answered a record for real: a plain read, safe to probe
  const probes = new Map() // collection → { status, body } of the API for an id that does not exist (one probe each)
  const knownOf = (path, key) => siblingsOf(path).flatMap(record => Array.isArray(record?.[key]) ? record[key] : [])
  const carts = new Map() // fila 46: uuid → the cart as last read, for the wallet writes

  context.on('response', async response => {
    try {
      const request = response.request()
      if (response.status() !== 200) return
      // with --locale the request carries the English URL the rewrite gave it (route.fallback({ url }))
      const path = apiPathOf(response.url(), ctx) ?? apiPathOf(request.url(), ctx)
      // redesign B1c (W1-QB1-07): the login answer tells who the session is
      if (path !== null && /^\/auth\/?$/.test(path) && ['GET', 'POST'].includes(request.method())) {
        sessionUser = sessionUserFrom(await response.json()) || sessionUser
        return
      }
      if (request.method() !== 'GET' || path === null) return
      const json = await response.json()
      if (!json || json.error) return
      for (const cart of cartsIn(path, json.result)) {
        carts.delete(cart.uuid)
        carts.set(cart.uuid, cart)
        if (carts.size > MAX_BASES) carts.delete(carts.keys().next().value)
      }
      if (isRecordPath(path)) {
        if (isPlainObject(json.result)) {
          remember(path, json.result)
          if (!memory.of(path)?.created) readById.add(collectionOf(keyOf(path))) // a created record is answered here, not by the API
        }
      } else if (Array.isArray(json.result)) {
        // a list (GET /users?…, GET /drivergroups?params=…) is where most records are read
        const collection = path.replace(/\/+$/, '')
        for (const record of json.result) {
          if (isPlainObject(record) && /^\d+$/.test(String(record.id))) remember(`${collection}/${record.id}`, record, { merge: true })
        }
      }
    } catch (_) { /* a body that is gone or not JSON just means no base */ }
  })

  await context.route(url => apiPathOf(url.href, ctx) !== null, async route => {
    const request = route.request()
    const method = request.method()
    const reply = (status, body) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': request.headers().origin || localOrigin || '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      },
      body
    })
    const answer = (status, response) => reply(status, JSON.stringify(response))
    // redesign stores 1.0: a targeted write fails here, before anything else, and goes nowhere
    const failRule = failRuleFor(failRules, method, request.url(), ctx)
    if (failRule) {
      const message = fail.message ?? DEFAULT_FAIL_MESSAGE
      failed += 1
      if (registry.length < maxLog) registry.push({ method: method.toUpperCase(), path: apiPathOf(request.url(), ctx), body: summarizeBody(parseBody(request.postData(), request.headers()['content-type'])), outcome: 'synthetic-fail', rule: `${failRule.method} ${failRule.pattern}`, message, at: new Date().toISOString() })
      return answer(fail.status ?? 400, failureResponse(message))
    }
    // a GET of a record or a list the session wrote to is read back with what it wrote
    if (method.toUpperCase() === 'GET' && memory.size()) {
      try {
        if (await readBack(route, request.url(), { answer, reply })) return
      } catch (_) {
        return route.abort('failed').catch(() => {}) // the real GET failed or the page is gone: as a network failure
      }
    }
    const verdict = shouldSynthesize({ method, url: request.url() }, ctx)
    if (!verdict.synthesize) return route.fallback()
    const body = parseBody(request.postData(), request.headers()['content-type'])
    const walletCart = cartWalletUuid(verdict.path)
    if (walletCart !== null) {
      const cart = carts.get(walletCart)
      if (registry.length < maxLog) registry.push({ method: method.toUpperCase(), path: verdict.path, body: summarizeBody(body), outcome: cart ? 'synthetic-cart' : 'synthetic-cart-unknown', at: new Date().toISOString() })
      if (!cart) return answer(400, failureResponse(`Synthetic: cart ${walletCart} was not read in this live session, so its wallet cannot be answered (--synthetic-writes)`))
      count += 1
      return answer(200, { error: false, result: cart })
    }
    const record = isRecordPath(verdict.path)
    const id = method.toUpperCase() === 'POST' && !record ? nextId++ : undefined // an update keeps its id
    const response = syntheticResponse(method, verdict.path, body, { id, base: seen.get(keyOf(verdict.path)), siblings: record ? siblingsOf(verdict.path) : [], user: sessionUser || FALLBACK_USER })
    if (method.toUpperCase() === 'DELETE') {
      seen.delete(keyOf(verdict.path))
      if (record) memory.remove(verdict.path)
    } else if (record) {
      remember(verdict.path, response.result)
      // the fields it sent, with the type the answer gave them
      memory.update(verdict.path, Object.fromEntries(Object.keys(body).filter(key => Object.hasOwn(response.result, key)).map(key => [key, response.result[key]])))
    } else if (method.toUpperCase() === 'POST' && response.result?.id != null) {
      const created = `${keyOf(verdict.path)}/${response.result.id}`
      memory.create(created, response.result)
      remember(created, response.result)
    }
    count += 1
    if (registry.length < maxLog) registry.push({ method: method.toUpperCase(), path: verdict.path, body: summarizeBody(body), at: new Date().toISOString() })
    return answer(200, response)
  })

  // → true when the GET was answered here. Only reads the guard lets through, and only with a write behind them.
  async function readBack (route, url, { answer, reply }) {
    const verdict = decide({ method: 'GET', url, ...ctx })
    if (!verdict.allow || verdict.reason !== 'api-read') return false
    const path = apiPathOf(url, ctx)
    const fulfillWith = async patch => {
      const response = await route.fetch()
      let json
      try { json = await response.json() } catch (_) { await route.fulfill({ response }); return true }
      await route.fulfill({ response, json: patch(json) })
      return true
    }
    if (isRecordPath(path)) {
      const entry = memory.of(path)
      if (!entry) return false
      if (entry.created) { await answer(200, { error: false, result: entry.created }); return true }
      if (entry.deleted) { await answerMissing(route, url, { answer, reply }); return true }
      return fulfillWith(json => readRecord(json, entry, key => knownOf(path, key)))
    }
    const entries = memory.inCollection(path)
    if (!entries.size) return false
    const where = new URL(url).searchParams.get('where')
    return fulfillWith(json => readList(json, entries, { collection: path, where, known: key => knownOf(`${keyOf(path)}/0`, key) }))
  }

  // A deleted record answers as the API does for an id of its collection that does not exist: one real probe per
  // collection, only for collections the session already read by id for real, and only when the guard lets it through;
  // otherwise a generic 400, without asking anything.
  async function answerMissing (route, url, { answer, reply }) {
    const collection = collectionOf(keyOf(apiPathOf(url, ctx)))
    if (!probes.has(collection)) {
      const probe = readById.has(collection) ? missingProbeUrl(url, ctx) : null
      if (!probe) return answer(400, missingResponse())
      const response = await route.fetch({ url: probe })
      probes.set(collection, { status: response.status(), body: await response.text() })
    }
    const { status, body } = probes.get(collection)
    return reply(status, body)
  }

  return { log: () => registry.slice(), count: () => count, failed: () => failed, user: () => sessionUser || FALLBACK_USER }
}
