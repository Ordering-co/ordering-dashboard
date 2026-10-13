/**
 * The page the user is on, sent with each message as `context` so the
 * assistant knows what "this store" or "this order" means. It is data for the
 * model, never permissions: the API still scopes every call to the user.
 */

const ROUTE_MAX_LENGTH = 200
const ORDER_ROUTES = ['/orders', '/deliveries', '/all-in-one']
// Pages whose `?id=` is a store. Others under /stores and /connect use it for
// their own record (brand, device, markup, delivery company)
const BUSINESS_ROUTES = ['/stores/list', '/stores/products', '/connect/sales-channels', '/connect/pos-menu', '/connect/importers']
const FRANCHISE_ROUTES = ['/stores/brand']
// Customers, admins and drivers: `?id=` is the user open on the page
const USER_ROUTES = ['/users/customers', '/users/admins', '/delivery/drivers-list']

const isRoute = (pathname, routes) => routes.some(route => pathname === route || pathname.startsWith(`${route}/`))

const toId = (value) => {
  if (value === null || value === undefined || !/^\d+$/.test(String(value))) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * @param {{ pathname: String, search: String }} location
 * @returns {{ context: Object|null, refs: Array<{ type: 'business'|'category'|'product'|'order'|'franchise'|'user', id: Number }> }}
 */
export const getAssistantPageContext = (location) => {
  const pathname = location?.pathname || '/'
  const search = location?.search || ''
  const params = new URLSearchParams(search)
  const context = {}

  const route = `${pathname}${search}`
  if (route.length <= ROUTE_MAX_LENGTH) context.route = route
  else if (pathname.length <= ROUTE_MAX_LENGTH) context.route = pathname

  if (isRoute(pathname, BUSINESS_ROUTES)) {
    const businessId = toId(params.get('id'))
    if (businessId) context.business_id = businessId
  }
  if (pathname.startsWith('/stores/products')) {
    const productId = toId(params.get('product'))
    if (productId) context.product_id = productId
  }
  if (isRoute(pathname, ORDER_ROUTES)) {
    const orderId = toId(params.get('id'))
    if (orderId) context.order_id = orderId
  }
  if (isRoute(pathname, FRANCHISE_ROUTES)) {
    const franchiseId = toId(params.get('id'))
    if (franchiseId) context.franchise_id = franchiseId
  }
  if (isRoute(pathname, USER_ROUTES)) {
    const userId = toId(params.get('id'))
    if (userId) context.user_id = userId
  }

  return withRefs(context, {})
}

const REF_TYPES = [
  ['business', 'business_id'],
  ['category', 'category_id'],
  ['product', 'product_id'],
  ['order', 'order_id'],
  ['franchise', 'franchise_id'],
  ['user', 'user_id']
]

const withRefs = (context, names) => ({
  context: Object.keys(context).length ? context : null,
  refs: REF_TYPES
    .filter(([, key]) => context[key])
    .map(([type, key]) => ({ type, id: context[key], name: names[type] || null }))
})

/**
 * Add what the page itself published (useAssistantPageEntities): its ids win
 * over the URL, and its names label the chips.
 * `category_id` is dropped by api-ai until the contract takes it; the route
 * still carries `?category=`.
 * @param {{ context: Object|null }} fromUrl getAssistantPageContext result
 * @param {Object|null} entities `{ business, category, product }`, each `{ id, name }`
 */
export const withPageEntities = (fromUrl, entities) => {
  const context = { ...(fromUrl?.context || {}) }
  const names = {}
  if (entities) {
    for (const [type, key] of REF_TYPES) {
      const id = toId(entities[type]?.id)
      if (!id) continue
      context[key] = id
      if (entities[type].name) names[type] = String(entities[type].name)
    }
  }
  return withRefs(context, names)
}
