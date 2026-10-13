/**
 * Which record a write of the assistant changed, from its operation_id and
 * path params. The params are named as in the API routes of the 9 writes the
 * MCP allows (apiv4 docs/clasificacion-capas.csv): Business.update takes
 * `business` and Order.update.put `order`; the rest `<thing>_id`.
 */

/** Event the assistant fires on the event bus when a change went through */
export const ASSISTANT_RECORD_CHANGED = 'assistant_record_changed'

/** The param that holds each entity's own id */
const OWN_ID_PARAM = {
  Business: ['business', 'business_id'],
  Category: ['category_id'],
  Product: ['product_id'],
  Extra: ['extra_id'],
  ExtraOption: ['option_id'],
  ExtraOptionSuboption: ['suboption_id'],
  Menu: ['menu_id'],
  Offer: ['offer_id'],
  Order: ['order', 'order_id']
}

/** Normalized id keys, from the route param names */
const ID_KEYS = {
  business: 'business_id',
  business_id: 'business_id',
  category_id: 'category_id',
  product_id: 'product_id',
  extra_id: 'extra_id',
  option_id: 'option_id',
  suboption_id: 'suboption_id',
  menu_id: 'menu_id',
  offer_id: 'offer_id',
  order: 'order_id',
  order_id: 'order_id'
}

const toId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

export const getRecordEntity = (operationId) => String(operationId || '').split('.')[0] || null

/**
 * @param {{ operation_id: String, path_params: Object, after?: Object }} action
 * @returns {{ entity: String|null, id: Number|null, ids: Object, after: Object|null }}
 *   `ids` always uses `business_id`, `category_id`, `product_id`, `order_id`…
 */
export const describeRecordChange = (action) => {
  const entity = getRecordEntity(action?.operation_id)
  const params = action?.path_params && typeof action.path_params === 'object' ? action.path_params : {}

  const ids = {}
  Object.entries(params).forEach(([name, value]) => {
    const key = ID_KEYS[name]
    const id = toId(value)
    if (key && id) ids[key] = id
  })

  const own = (OWN_ID_PARAM[entity] || []).map(name => toId(params[name])).find(Boolean) ?? null
  return { entity, id: own, ids, after: action?.after ?? null }
}

/**
 * Whether a confirmed change went through: executed, or an unknown outcome
 * whose record reads as applied
 */
export const isChangeApplied = (result) => (
  result?.status === 'executed' || (result?.status === 'unknown' && result?.observed === 'applied')
)
