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

const attachChildren = (category, childrenByParentId, seen) => {
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
