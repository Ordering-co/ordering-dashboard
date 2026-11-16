// redesign stores 5.5b: pure helpers behind the «Basic» tab of a menu. No React, no state: the flat model of the catalog
// tree, the product search and the count of selected products.

/**
 * Flattens the categories of a business (recursive `subcategories`, `products`) into every product with the names of the categories
 * on its path. A product that sits in two categories has two entries in `products` and one id in `productIds`.
 * @param {Array|null|undefined} categories business.categories
 * @returns {{ productIds: Set, products: Array<{ id, name, path: string[] }> }}
 */
export const flattenCategories = (categories) => {
  const productIds = new Set()
  const products = []
  const walk = (list, parentPath) => {
    if (!Array.isArray(list)) return
    list.forEach(category => {
      if (!category) return
      const path = [...parentPath, category.name]
      if (Array.isArray(category.products)) {
        category.products.forEach(product => {
          if (!product) return
          productIds.add(product.id)
          products.push({ id: product.id, name: product.name, path })
        })
      }
      walk(category.subcategories, path)
    })
  }
  walk(categories, [])
  return { productIds, products }
}

const normalize = (value) => String(value ?? '').trim().toLowerCase()

/**
 * The ids of the products a search shows: those whose name matches, or that sit under a category whose name matches. Ignores case and
 * the spaces around the query.
 * @returns {Set|null} null when the query is blank (nothing is filtered)
 */
export const matchProductIds = (model, query) => {
  const needle = normalize(query)
  if (!needle) return null
  const ids = new Set()
  ;(model?.products || []).forEach(product => {
    if (normalize(product.name).includes(needle) || (product.path || []).some(name => normalize(name).includes(needle))) {
      ids.add(product.id)
    }
  })
  return ids
}

/**
 * How many of the selected ids are products of the tree (each counted once; an id the tree does not have is ignored).
 */
export const countSelected = (model, selectedIds) => {
  if (!Array.isArray(selectedIds) || !model?.productIds) return 0
  return new Set(selectedIds.filter(id => model.productIds.has(id))).size
}

/**
 * Whether `schedule` is the week the Schedule controller seeds for a menu that has none: 7 days, all enabled, one lapse 00:00-23:59.
 * Seeding it is not an edit of the user's, so a new menu does not count it as a change.
 */
export const isDefaultSchedule = (schedule) => (
  Array.isArray(schedule) &&
  schedule.length === 7 &&
  schedule.every(day => (
    day?.enabled === true &&
    Array.isArray(day.lapses) &&
    day.lapses.length === 1 &&
    day.lapses[0]?.open?.hour === 0 &&
    day.lapses[0]?.open?.minute === 0 &&
    day.lapses[0]?.close?.hour === 23 &&
    day.lapses[0]?.close?.minute === 59
  ))
)

/**
 * Every category of the tree, at every depth, with the ids of all the products under it (its own, then those of its subcategories,
 * recursively). Same shape and meaning as the `subCategoriesList` of the controller, but built from the categories at hand: the
 * controller computes its list once, when the menu opens, and a reload with the menu in the URL gets there before the categories.
 * @param {Array|null|undefined} categories business.categories
 * @returns {Array<{ id, name, productIds: Array }>} parents before their subcategories
 */
export const buildCategoryIndex = (categories) => {
  const index = []
  const walk = (list) => {
    const ids = []
    if (!Array.isArray(list)) return ids
    list.forEach(category => {
      if (!category) return
      const entry = { id: category.id, name: category.name, productIds: [] }
      index.push(entry)
      const own = Array.isArray(category.products) ? category.products.filter(Boolean).map(product => product.id) : []
      entry.productIds = [...own, ...walk(category.subcategories)]
      ids.push(...entry.productIds)
    })
    return ids
  }
  walk(categories)
  return index
}

/**
 * What a menu needs before it reaches the API: a name that is not blank and, for a new menu, either All products or at least one
 * product. The one rule for Save of the Basic tab and for Save of the leave guard.
 * @param {{ menu?: object, changes?: object, selectedProductsIds?: Array }} form
 * @returns {{ nameBlank: boolean, productsMissing: boolean, ok: boolean }}
 */
export const validateMenuForm = ({ menu, changes, selectedProductsIds } = {}) => {
  const current = menu || {}
  const pending = changes || {}
  const nameBlank = !String(pending.name ?? current.name ?? '').trim()
  const hasProducts = (Array.isArray(selectedProductsIds) && selectedProductsIds.length > 0) ||
    (Array.isArray(pending.products) && pending.products.length > 0)
  const productsMissing = !current.id && !(pending.all_products ?? current.all_products) && !hasProducts
  return { nameBlank, productsMissing, ok: !nameBlank && !productsMissing }
}
