import { onboardingWebsiteCandidates, onboardingWebsiteUrl } from './storeOnboardingWebsite'
import { validWebsiteColor, validWebsiteTarget } from './storeOnboardingAppearance'
import { stringToSlug } from './index'

export const draftKey = (root, userId) => `ordering:store-onboarding:v1:${encodeURIComponent(String(root).replace(/\/(v\d+)\/[^/]+\/([^/]+)\/?$/, '/$1/$2'))}:${userId}`
export const newKey = () => globalThis.crypto.randomUUID()
export const isOnboardingEligible = ({ development, hostname, auth, level, root, userId }) =>
  development === true && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname) && auth && level === 0 && Boolean(root && userId)

export const createDraft = (email, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) => ({
  version: 1,
  defaultsPending: true,
  nonce: newKey(),
  step: 0,
  form: {
    name: '',
    phone: '',
    email,
    address: '',
    addressNotes: '',
    location: null,
    logo: '',
    websiteColor: '',
    timezone,
    hours: Array.from({ length: 7 }, (_, i) => ({ enabled: i !== 6, open: '09:00', close: '22:00' })),
    orderTypes: [1],
    zone: { type: 4, name: 'Delivery', minimum: '0', price: '0', data: null },
    payments: ['cash'],
    menuMode: '',
    categories: []
  },
  journal: { categories: {}, products: {}, payments: {}, published: false }
})

const validMenuIdentities = categories => {
  const categoryKeys = new Set()
  const productKeys = new Set()
  const add = (set, key) => {
    if (typeof key !== 'string' || !/^[a-z0-9-]+$/i.test(key) || set.has(key.slice(0, 8))) return false
    set.add(key.slice(0, 8))
    return true
  }
  return Array.isArray(categories) && categories.every(category => category && add(categoryKeys, category.key) && Array.isArray(category.products) && category.products.every(product => product && add(productKeys, product.key)))
}

export const menuItemFields = {
  category: ['name', 'description', 'image', 'header'],
  product: ['name', 'price', 'description', 'images']
}
const validImage = value => value === undefined || value === '' || (typeof value === 'string' && (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) || /^https:\/\//.test(value) || /^ordering-media:[a-f0-9-]{36}$/i.test(value)))
const validMenuMedia = item => item && (item.description === undefined || typeof item.description === 'string') && ['image', 'header', 'images'].every(key => validImage(item[key]))
export const menuMediaPayload = (item, kind) => Object.fromEntries(menuItemFields[kind].filter(key => !['name', 'price'].includes(key) && typeof item[key] === 'string').map(key => [key, item[key]]))

export const applyMenuChange = (form, change) => {
  if (change.mode !== form.menuMode || !['category', 'product'].includes(change.kind)) throw new Error('menu_changed')
  const category = form.categories.find(c => c.key === change.categoryKey)
  const item = change.kind === 'category' ? category : category?.products.find(p => p.key === change.productKey)
  if ((!change.isNew && !item) || (change.isNew && item) || (change.kind === 'product' && !category)) throw new Error('menu_changed')
  if (change.kind === 'product' && !change.remove && !text(category.name)) throw new Error('invalid_menu')
  if (change.remove) {
    return change.kind === 'category'
      ? form.categories.filter(c => c.key !== change.categoryKey)
      : form.categories.map(c => c.key === change.categoryKey ? { ...c, products: c.products.filter(p => p.key !== change.productKey) } : c)
  }
  const patch = Object.fromEntries(menuItemFields[change.kind].filter(key => Object.prototype.hasOwnProperty.call(change.patch || {}, key)).map(key => [key, change.patch[key]]))
  const next = { ...(item || (change.kind === 'category' ? { key: change.categoryKey, products: [] } : { key: change.productKey })), ...patch }
  if (!validMenuMedia(next) || !text(next.name) || (change.kind === 'product' && !amount(next.price))) throw new Error('invalid_menu')
  const categories = change.kind === 'category'
    ? change.isNew ? [...form.categories, next] : form.categories.map(c => c.key === change.categoryKey ? next : c)
    : form.categories.map(c => c.key === change.categoryKey ? { ...c, products: change.isNew ? [...c.products, next] : c.products.map(p => p.key === change.productKey ? next : p) } : c)
  if (!validMenuIdentities(categories)) throw new Error('invalid_menu')
  return categories
}

export const withoutMenuPlaceholders = categories => {
  const untouched = (item, ignored) => Object.entries(item).every(([key, value]) => ignored.includes(key) || value == null || (typeof value === 'string' && !value.trim()))
  return categories.map(category => ({ ...category, products: category.products.filter(product => !untouched(product, ['key'])) }))
    .filter(category => category.products.length || !untouched(category, ['key', 'products']))
}

export const readDraft = (storage, key) => {
  try {
    const d = JSON.parse(storage.getItem(key))
    const object = value => value && typeof value === 'object' && !Array.isArray(value)
    const id = value => Number.isInteger(Number(value)) && Number(value) > 0
    const categories = value => validMenuIdentities(value) && value.every(c => object(c) && typeof c.key === 'string' && typeof c.name === 'string' && validMenuMedia(c) && Array.isArray(c.products) && c.products.every(p => object(p) && typeof p.key === 'string' && typeof p.name === 'string' && validMenuMedia(p) && ['string', 'number'].includes(typeof p.price)))
    if (!d || d.version !== 1 || typeof d.nonce !== 'string' || !/^[a-z0-9-]{8,}$/i.test(d.nonce) || !Number.isInteger(d.step) || d.step < 0 || d.step > 6 ||
      !object(d.form) || !object(d.journal) || !Array.isArray(d.form.hours) || d.form.hours.length !== 7 ||
      d.form.hours.some(h => !object(h) || typeof h.enabled !== 'boolean' || typeof h.open !== 'string' || typeof h.close !== 'string') ||
      !categories(d.form.categories) ||
      !Array.isArray(d.form.orderTypes) || !Array.isArray(d.form.payments) || !object(d.form.zone) ||
      typeof d.form.zone.name !== 'string' || ![1, 2, 4].includes(d.form.zone.type) ||
      ['minimum', 'price'].some(key => !['string', 'number'].includes(typeof d.form.zone[key])) ||
      ['name', 'phone', 'email', 'address', 'addressNotes', 'logo', 'timezone', 'menuMode'].some(key => typeof d.form[key] !== 'string') ||
      ['categories', 'products', 'payments'].some(key => !object(d.journal[key]) || Object.values(d.journal[key]).some(value => !id(value))) ||
      typeof d.journal.published !== 'boolean' || (d.journal.businessId && !id(d.journal.businessId)) ||
      (d.step === 6 && !d.journal.published) || (d.journal.published && (!id(d.journal.businessId) || !d.journal.resourcesComplete || typeof d.journal.slug !== 'string'))) return null
    if (d.form.websiteColor !== undefined && typeof d.form.websiteColor !== 'string') return null
    if (d.form.websiteAppearanceTarget !== undefined && !validWebsiteTarget(d.form.websiteAppearanceTarget)) return null
    if (['defaultsPending', 'timezoneEdited'].some(key => d[key] !== undefined && typeof d[key] !== 'boolean')) return null
    if (d.form.menuDrafts !== undefined && (!object(d.form.menuDrafts) || Object.values(d.form.menuDrafts).some(value => !categories(value)))) return null
    if (d.form.schedule !== undefined && (!Array.isArray(d.form.schedule) || d.form.schedule.length !== 7 || d.form.schedule.some(day => !object(day) || typeof day.enabled !== 'boolean' || !Array.isArray(day.lapses) || day.lapses.some(lapse => !object(lapse) || !object(lapse.open) || !object(lapse.close))))) return null
    if (!d.journal.started && !d.journal.published) {
      d.form.categories = withoutMenuPlaceholders(d.form.categories)
      if (d.form.menuDrafts) d.form.menuDrafts = Object.fromEntries(Object.entries(d.form.menuDrafts).map(([mode, categories]) => [mode, withoutMenuPlaceholders(categories)]))
    }
    if (d.journal.started && validateForm(d.form).length) return null

    if (d.step === 4) d.step = 3
    return d
  } catch { return null }
}

const text = value => typeof value === 'string' && Boolean(value.trim())
const amount = value => (typeof value === 'number' || text(value)) && Number.isFinite(Number(value)) && Number(value) >= 0
const time = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
export const validLocation = point => point && typeof point.lat === 'number' && typeof point.lng === 'number' &&
  Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
export const validSchedule = schedule => {
  const minutes = t => t.hour * 60 + t.minute
  const validTime = t => t && Number.isInteger(t.hour) && Number.isInteger(t.minute) && t.hour >= 0 && t.hour <= 23 && t.minute >= 0 && t.minute <= 59
  return Array.isArray(schedule) && schedule.length === 7 && schedule.some(d => d?.enabled === true) && schedule.every(d => {
    if (!d || typeof d.enabled !== 'boolean' || !Array.isArray(d.lapses)) return false
    if (!d.enabled) return true
    if (!d.lapses.length) return false
    let previous = -1
    return d.lapses.every(l => {
      if (!l || !validTime(l.open) || !validTime(l.close) || minutes(l.open) >= minutes(l.close) || minutes(l.open) <= previous) return false
      previous = minutes(l.close)
      return true
    })
  })
}
const polygonValid = points => Array.isArray(points) && points.length >= 3 && points.every(validLocation) &&
  new Set(points.map(p => `${p.lat},${p.lng}`)).size >= 3 &&
  Math.abs(points.reduce((area, p, i) => {
    const q = points[(i + 1) % points.length]
    return area + p.lng * q.lat - q.lng * p.lat
  }, 0)) > 1e-12

export const validateStep = (f, step) => {
  const errors = []
  if (step === 0) {
    if (!text(f.name)) errors.push('name')
    if (f.phoneValid === false || !text(f.phone) || f.phone.replace(/\D/g, '').length < 7) errors.push('phone')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push('email')
  }
  if (step === 1) {
    if (!text(f.address) || !validLocation(f.location)) errors.push('address')
  }
  if (step === 2) {
    if (f.schedule ? !validSchedule(f.schedule) : f.hours.length !== 7 || !f.hours.some(h => h.enabled) || f.hours.some(h => h.enabled && (!time(h.open) || !time(h.close) || h.open === h.close))) errors.push('hours')
    if (!text(f.timezone)) errors.push('timezone')
    try { new Intl.DateTimeFormat('en', { timeZone: f.timezone }).format() } catch { errors.push('timezone') }
  }
  if (step === 3) {
    if (!f.orderTypes.length || f.orderTypes.some(id => ![1, 2, 3, 4, 5].includes(id))) errors.push('orderTypes')
    if (f.orderTypes.includes(1)) {
      const z = f.zone
      if (!text(z.name)) errors.push('zoneName')
      if (!amount(z.minimum)) errors.push('zoneMinimum')
      if (!amount(z.price)) errors.push('zonePrice')
      if (![1, 2, 4].includes(z.type) || (z.type === 1 && (!validLocation(z.data?.center) || !amount(z.data?.radio) || Number(z.data.radio) <= 0 || !Number.isFinite(Number(z.data.radio) * 1000))) || (z.type === 2 && !polygonValid(z.data))) errors.push('zoneGeometry')
    }
  }
  if (step === 1 && f.websiteColor && (!validWebsiteColor(f.websiteColor) || !validWebsiteTarget(f.websiteAppearanceTarget))) errors.push('websiteColor')
  if (step === 4 && (!f.payments.length || f.payments.some(g => !['cash', 'card_delivery'].includes(g)))) errors.push('payments')
  if (step === 5 && (!validMenuIdentities(f.categories) || !f.categories.length || f.categories.some(c => !text(c.name) || !validMenuMedia(c) || !c.products.length || c.products.some(p => !text(p.name) || !amount(p.price) || !validMenuMedia(p))))) errors.push('menu')
  return errors
}

export const validateForm = form => Array.from({ length: 6 }, (_, step) => ({ step, errors: validateStep(form, step) })).filter(result => result.errors.length)

export const schedulePayload = hours => {
  const days = [hours[6], ...hours.slice(0, 6)]
  const result = days.map(h => ({ enabled: Boolean(h.enabled), lapses: [] }))
  const asTime = t => ({ hour: Number(t.split(':')[0]), minute: Number(t.split(':')[1]) })
  days.forEach((h, i) => {
    if (!h.enabled) return
    if (h.close > h.open) result[i].lapses.push({ open: asTime(h.open), close: asTime(h.close) })
    else {
      result[i].lapses.push({ open: asTime(h.open), close: { hour: 23, minute: 59 } })
      if (h.close !== '00:00') {
        const next = result[(i + 1) % 7]
        next.enabled = true
        next.lapses.push({ open: { hour: 0, minute: 0 }, close: asTime(h.close) })
      }
    }
  })
  const minutes = t => t.hour * 60 + t.minute
  result.forEach(d => {
    const sorted = d.lapses.sort((a, b) => minutes(a.open) - minutes(b.open))
    d.lapses = []
    for (const lapse of sorted) {
      const previous = d.lapses.at(-1)
      if (previous && minutes(lapse.open) <= minutes(previous.close)) {
        if (minutes(lapse.close) > minutes(previous.close)) previous.close = lapse.close
      } else d.lapses.push(lapse)
    }
  })
  return result
}

export const slugify = value => stringToSlug(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || 'restaurant'
export const businessPayload = (draft, ownerId) => {
  const f = draft.form
  return {
    name: f.name.trim(),
    slug: `${slugify(f.name)}_${draft.nonce.slice(0, 8)}`,
    external_id: `onboarding:${draft.nonce}`,
    phone: f.phone,
    email: f.email,
    address: f.address,
    address_notes: f.addressNotes,
    location: JSON.stringify(f.location),
    timezone: f.timezone,
    schedule: JSON.stringify(f.schedule || schedulePayload(f.hours)),
    ...(f.logo && { logo: f.logo }),
    owner_id: ownerId,
    food: true,
    minimum: 0,
    delivery_price: 0,
    tax: 0,
    tax_type: 1,
    service_fee: 0,
    enabled: false
  }
}
export const zonePayload = f => ({
  name: f.zone.name.trim(),
  type: f.zone.type,
  minimum: Number(f.zone.minimum),
  price: Number(f.zone.price),
  enabled: true,
  ...(f.zone.type !== 4 && { data: JSON.stringify(f.zone.data) }),
  schedule: JSON.stringify(f.schedule || schedulePayload(f.hours))
})

export const getRestaurantUrl = (sites, slug, options = {}) => {
  if (!text(slug)) return null
  const candidates = onboardingWebsiteCandidates(sites, options)
  if (candidates.length !== 1) return null
  const base = onboardingWebsiteUrl(candidates[0], options)
  if (!base) return null
  const url = new URL(base)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  url.search = ''; url.hash = ''
  return url.href
}
