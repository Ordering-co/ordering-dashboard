import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

// redesign reviews FD2 (D1, RV-01, RV-11, RV-15): the address of /intelligence/reviews. What `main` kept in it stays:
// ?tab= (business, drivers, customers, professionals, products), ?page= and ?pageSize= (written by the lists), ?id= (a business or a
// user), ?business= (products) and ?category= with ?product= (the panel of a product). The page keeps the state; this reads the
// address once, when the page opens, and is the only place that writes it.

export const REVIEW_TABS = ['business', 'drivers', 'customers', 'professionals', 'products']

// What a change of tab takes out of the address, as main did (handleChangeOption)
const TAB_RESET_KEYS = ['page', 'pageSize', 'business', 'category', 'product', 'id']

const number = (query, key) => {
  const raw = query.get(key)
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const positiveInteger = (value, fallback) => (Number.isInteger(value) && value >= 1 ? value : fallback)

/** The address as the page needs it on its first render. `tab` is `null` when the address names none (or one that does not exist). */
export const parseReviewsQuery = (search) => {
  const query = new URLSearchParams(search)
  const tab = query.get('tab')
  return {
    tab: REVIEW_TABS.includes(tab) ? tab : null,
    id: number(query, 'id'),
    business: number(query, 'business'),
    category: number(query, 'category'),
    product: number(query, 'product'),
    page: positiveInteger(number(query, 'page'), 1),
    pageSize: positiveInteger(number(query, 'pageSize'), 10)
  }
}

/** The first load does not erase anything (RV-15): it only adds `tab` when the address has none. */
export const writeFirstTab = (tab) => addQueryToUrl({ tab })

/** The user changed the tab: the parameters of the old tab go away and `tab` is written (Products also gets its business back). */
export const writeTab = (tab, businessId) => {
  removeQueryToUrl(TAB_RESET_KEYS)
  addQueryToUrl(tab === 'products' && businessId != null ? { tab, business: businessId } : { tab })
}

/** A business or a user opens (`id`) or closes (`null`). */
export const writeRecord = (id) => (id == null ? removeQueryToUrl(['id']) : addQueryToUrl({ id }))

/** A product opens (`category` and `product`) or closes (`null`). A product with no category writes only its own number. */
export const writeProduct = (product, category) => {
  if (product == null) {
    removeQueryToUrl(['category', 'product'])
    return
  }
  addQueryToUrl(category != null ? { category, product } : { product })
}

/** The business of Products changes: its page and its panel belong to the old one. */
export const writeStore = (business) => {
  removeQueryToUrl(['page', 'pageSize', 'category', 'product'])
  addQueryToUrl({ business })
}

/** «Product reviews» of a business (RV-01): Products, with that business and nothing of the old tab. */
export const writeProducts = (business) => {
  removeQueryToUrl(['id', 'page', 'pageSize', 'category', 'product'])
  addQueryToUrl({ tab: 'products', business })
}

/** The address of the first render, read once (the page's state is its own from then on, as in main). */
export const useReviewsQuery = () => {
  const { search } = useLocation()
  const [initial] = useState(() => parseReviewsQuery(search))
  return initial
}
