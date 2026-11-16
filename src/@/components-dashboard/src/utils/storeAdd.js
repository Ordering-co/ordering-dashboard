// redesign (/stores/add): the pure part of the store add. What the form needs to be valid, the bodies of the requests
// (the same as main: C/BusinessAdd before the redesign) and the plan of the writes that follow the store. Nothing here talks to
// the API or reads React state.
import { stringToSlug } from './index'

// The same gateways main created in sandbox (C/BusinessAdd `sandboxRequiredGateways`).
export const SANDBOX_REQUIRED_GATEWAYS = ['paypal', 'paypal_express', 'stripe_connect', 'carlos_payment', 'ivr']
// The gateways main never offered in the add (C/BusinessAdd `paymethodsNotAllowed`).
export const PAYMETHODS_NOT_ALLOWED = ['paypal_express', 'authorize', 'stripe_direct', 'stripe_redirect']
// Zone types main offered in the add: circle, polygon, everywhere, distance based.
export const ZONE_TYPES = [1, 2, 4, 5]

const ALL_DAY = { open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }
// The schedule a new store starts with (Shared/Schedule's default in main) and the one main gave every zone it created.
export const allDaySchedule = () => Array.from({ length: 7 }, () => ({ enabled: true, lapses: [{ open: { ...ALL_DAY.open }, close: { ...ALL_DAY.close } }] }))

const text = value => (value == null ? '' : String(value))
const filled = value => text(value).trim() !== ''

/**
 * main's slug rules for the add, kept (the editor's stricter letters-and-numbers rule is a proposal for the owner, G1-13): the
 * slug a name gives is `stringToSlug` (with `_`), and a typed slug cannot hold spaces (main's side form blocked the space bar).
 */
export const cleanSlug = value => text(value).replace(/\s+/g, '')
export const isValidSlug = value => text(value) !== '' && !/\s/.test(text(value))
export const slugFromName = name => stringToSlug(text(name))

export const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value).trim())

/**
 * Main's rule for «register stores» on the list's button: an owner (level 2) registers stores unless the project turned
 * `allow_business_owner_register_business` off; no setting means yes.
 * bugs E: the one rule of the list, ⌘K, the /stores/add route (RegisterStoresGate), the catalog's store selector and
 * the editor's Duplicate. The setting is on as '1', 1 or true (⌘K read it that way; the list only knew '1').
 */
export const canRegisterStores = (user, configs) => {
  const setting = configs?.allow_business_owner_register_business
  return !setting || user?.level !== 2 || [true, 1, '1'].includes(setting?.value)
}

/** The cities of the enabled countries, and the one main picked: the first. */
export const citiesOf = (countries = []) => (countries || [])
  .filter(country => country?.enabled)
  .flatMap(country => country?.cities || [])

/** Payment methods the add offers (main's list minus the ones it never offered). */
export const offeredPaymethods = (paymethods = []) => (paymethods || []).filter(paymethod => !PAYMETHODS_NOT_ALLOWED.includes(paymethod?.gateway))

const finite = value => value !== '' && value != null && Number.isFinite(Number(value))
const amount = value => finite(value) && Number(value) >= 0
const validPoint = point => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))

/**
 * Problems of a delivery zone being added, by field. A zone that is not being added has none. «0» is a valid minimum and fee
 * (main dropped such a zone in silence, SA-03).
 */
export const zoneProblems = zone => {
  if (!zone) return {}
  const problems = {}
  if (!filled(zone.name)) problems.zoneName = 'required'
  if (!amount(zone.minimum)) problems.zoneMinimum = filled(zone.minimum) ? 'invalid' : 'required'
  if (!amount(zone.price)) problems.zonePrice = filled(zone.price) ? 'invalid' : 'required'
  const type = Number(zone.type)
  if (!ZONE_TYPES.includes(type)) problems.zoneType = 'required'
  if (type === 1 && !(validPoint(zone.data?.center) && Number(zone.data?.radio) > 0)) problems.zoneGeometry = 'required'
  if (type === 2 && !(Array.isArray(zone.data) && zone.data.filter(validPoint).length >= 3)) problems.zoneGeometry = 'required'
  if (type === 5) {
    const distance = Number(zone.data?.distance)
    if (!(Number.isInteger(distance) && distance >= 1 && distance <= 99)) problems.zoneDistance = filled(zone.data?.distance) ? 'invalid' : 'required'
  }
  return problems
}

/**
 * Problems of the whole form, by field: what main marks as required (name, the email for orders, the slug, a payment method)
 * plus a zone being added. The address stays optional, as in main.
 */
export const addProblems = ({ form = {}, paymethodIds = [], zone = null } = {}) => {
  const problems = {}
  if (!filled(form.name)) problems.name = 'required'
  if (!filled(form.slug)) problems.slug = 'required'
  else if (!isValidSlug(form.slug)) problems.slug = 'invalid'
  if (!filled(form.email)) problems.email = 'required'
  else if (!isValidEmail(form.email)) problems.email = 'invalid'
  if (!paymethodIds?.length) problems.payments = 'required'
  return { ...problems, ...zoneProblems(zone) }
}

/** The order the fields are checked and focused in: the order they are drawn in. */
export const PROBLEM_ORDER = ['name', 'slug', 'email', 'payments', 'zoneName', 'zoneType', 'zoneMinimum', 'zonePrice', 'zoneDistance', 'zoneGeometry']

/**
 * The body of `POST /business`: main's defaults on top of what the form holds, the schedule and the city. A price level emptied
 * (Google filled one, then another business had none) is left out, as when it was never set.
 */
export const businessBody = ({ form = {}, schedule, ownerId, cityId }) => {
  const { slugEdited, price_level: priceLevel, ...changes } = form
  return {
    ...changes,
    ...(priceLevel != null && priceLevel !== '' && { price_level: priceLevel }),
    minimum: 0,
    delivery_price: 0,
    tax: 0,
    tax_type: 1,
    service_fee: 0,
    enabled: true,
    owner_id: ownerId,
    schedule,
    ...(cityId && { city_id: cityId })
  }
}

export const paymethodBody = (paymethod, sandboxGateways = SANDBOX_REQUIRED_GATEWAYS) => ({
  enabled: true,
  paymethod_id: paymethod.id,
  sandbox: sandboxGateways.includes(paymethod.gateway)
})

export const galleryBody = (businessId, photo) => ({ business_id: businessId, file: photo.file, type: 1 })

/** Main's zone body: what the form holds, the geometry as JSON, enabled and open all day. */
export const zoneBody = zone => {
  const { data, type, ...rest } = zone
  return {
    ...rest,
    data: JSON.stringify(data),
    type: type || 2,
    enabled: true,
    schedule: JSON.stringify(allDaySchedule())
  }
}

/**
 * The writes that follow the store, in main's order (payment methods, photos, zone). Each has a key so a retry repeats only
 * the ones that failed, against the store already created.
 */
export const followUpJobs = ({ paymethodIds = [], gallery = [], zone = null }) => [
  ...paymethodIds.map(id => ({ key: `paymethod:${id}`, kind: 'paymethod', id })),
  ...gallery.map((photo, index) => ({ key: `photo:${photo.temp_id ?? index}`, kind: 'photo', photo })),
  ...(zone ? [{ key: 'zone', kind: 'zone' }] : [])
]
