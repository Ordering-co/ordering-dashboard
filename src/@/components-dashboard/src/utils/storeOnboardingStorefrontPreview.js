import { schedulePayload } from './storeOnboarding'

const text = value => typeof value === 'string' ? value : ''
export const previewImage = value => {
  if (typeof value !== 'string') return ''
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)) return value
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : '' } catch { return '' }
}

export const storefrontDraftBusiness = (form, emptyName = '') => {
  const id = 987654321
  let productId = 100000
  const categories = (form.categories || []).filter(category => text(category.name).trim()).map((category, index) => {
    const categoryId = 1000 + index
    const products = (category.products || []).filter(product => text(product.name).trim()).map(product => ({
      id: productId++,
      business_id: id,
      category_id: categoryId,
      name: text(product.name),
      description: text(product.description),
      price: String(product.price ?? '').trim() && Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
      images: previewImage(product.images),
      enabled: true,
      available: true,
      extras: [],
      ingredients: [],
      gallery: [],
      featured: false,
      inventory: null,
      position: productId
    }))
    return { id: categoryId, business_id: id, name: text(category.name), description: text(category.description), image: previewImage(category.image), header: previewImage(category.header), enabled: true, products }
  })
  const schedule = form.schedule || (form.hours?.length === 7 ? schedulePayload(form.hours) : [])
  const publicSchedule = schedule.map(day => ({ enabled: Boolean(day.enabled), lapses: day.lapses.map(lapse => ({ open: { hour: Number(lapse.open.hour), minute: Number(lapse.open.minute) }, close: { hour: Number(lapse.close.hour), minute: Number(lapse.close.minute) } })) }))
  const location = { lat: Number(form.location?.lat) || 0, lng: Number(form.location?.lng) || 0 }
  return {
    id,
    slug: 'onboarding_preview',
    name: text(form.name) || emptyName,
    address: text(form.address),
    logo: previewImage(form.logo),
    header: '',
    location,
    phone: '',
    email: '',
    open: true,
    enabled: true,
    timezone: text(form.timezone) || 'America/Mexico_City',
    food: true,
    categories,
    products: categories.flatMap(category => category.products),
    reviews: { total: 0, reviews: [] },
    gallery: [],
    offers: [],
    configs: [],
    professionals: [],
    types: (form.orderTypes || [1, 2]).filter(type => [1, 2].includes(type)).sort((a, b) => a - b),
    delivery_price: Number(form.zone?.price) || 0,
    minimum: Number(form.zone?.minimum) || 0,
    delivery_time: '00:00',
    pickup_time: '00:00',
    schedule: publicSchedule,
    today: { enabled: true, lapses: [] },
    distance: 0,
    in_zone: true,
    valid: true,

    lazy_load_products_recommended: true
  }
}
