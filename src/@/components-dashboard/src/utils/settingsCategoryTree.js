/**
 * Builds Settings hub category trees from one flat config_categories list.
 * The API already returns configs on each category, so the hub
 * does not need a request per folder.
 */

export const SETTINGS_CATEGORIES_FETCH_VERSION = 'v2'

export const buildSettingsCategoriesFetchUrl = (root, version = SETTINGS_CATEGORIES_FETCH_VERSION) =>
  `${root}/config_categories?version=${version}&orderBy=rank`

const toId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

const sortByRank = (categories = []) =>
  [...categories].sort((a, b) => (Number(a?.rank) || 0) - (Number(b?.rank) || 0))

// the API can repeat a config inside one category (delivery_fee_free_multi_checkout in
// addon_multi_business_checkout). The hub addresses configs by key (focus, dependents, search), so a second row with the same
// key is the same field drawn twice: keep the first, in the API order. Configs without a key are kept as they are.
export const dedupeCategoryConfigs = (category) => {
  if (!Array.isArray(category?.configs)) return category
  const seenKeys = new Set()
  const configs = category.configs.filter(config => {
    const key = config?.key
    if (key === undefined || key === null || key === '') return true
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
  return configs.length === category.configs.length ? category : { ...category, configs }
}

const attachChildren = (rawCategory, childrenByParentId, seen) => {
  const category = dedupeCategoryConfigs(rawCategory)
  const id = toId(category?.id)
  if (id === null) return { ...category, children: [] }
  if (seen.has(id)) return { ...category, children: [] }
  const nextSeen = new Set(seen)
  nextSeen.add(id)
  const children = sortByRank(childrenByParentId.get(id) || [])
  return {
    ...category,
    children: children.map(child => attachChildren(child, childrenByParentId, nextSeen))
  }
}

/**
 * Groups a flat `config_categories` result into the `{ [parentKey]: tree[] }`
 * shape AllSettings passes to the hub. Parent keys receive their children.
 * Standalone keys receive the category itself.
 */
export const buildSettingsCategoryLists = ({
  categories = [],
  parentKeys = [],
  standaloneKeys = []
} = {}) => {
  const byKey = new Map()
  const childrenByParentId = new Map()

  categories.filter(Boolean).forEach(category => {
    if (category.key) byKey.set(category.key, category)
    const parentId = toId(category.parent_category_id)
    if (parentId === null) return
    if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, [])
    childrenByParentId.get(parentId).push(category)
  })

  const lists = {}

  parentKeys.forEach(key => {
    const parent = byKey.get(key)
    const parentId = toId(parent?.id)
    if (!parent || parentId === null) {
      lists[key] = []
      return
    }
    const children = sortByRank(childrenByParentId.get(parentId) || [])
    lists[key] = children.map(child => attachChildren(child, childrenByParentId, new Set([parentId])))
  })

  standaloneKeys.forEach(key => {
    const category = byKey.get(key)
    lists[key] = category ? [attachChildren(category, childrenByParentId, new Set())] : []
  })

  return lists
}
