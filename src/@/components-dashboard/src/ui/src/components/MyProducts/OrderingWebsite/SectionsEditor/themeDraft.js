// redesign ordering-website B3a (D4): the pure helpers of the sections editor's drafts. What the person edits (the site's
// fields, the theme of the website and the whole theme of Advanced) is compared with what the server has, so the save bar can say
// how many changes are pending and in which sections. No React and no text here.

/**
 * Set `newValue` at the dotted `path` of `object`, in place. Moved as it was from `MyProducts/OrderingWebsite/index.js`
 * (the legacy editor imports it from here now): it expects every object on the path to exist.
 */
export const updateObject = (object, newValue, path) => {
  const stack = path.split('.')
  while (stack.length > 1) {
    object = object[stack.shift()]
  }
  object[stack.shift()] = newValue
}

/**
 * A new copy of `themeValues` with `[section, 'components', block]` changed to `value`: what `handleChangeValue` of the legacy
 * editor does before it hands the copy to `setThemeValues`.
 */
export const setThemePath = (themeValues, section, block, value) => {
  const copy = JSON.parse(JSON.stringify(themeValues))
  updateObject(copy, value, [section, 'components', block].join('.'))
  return copy
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const sameValue = (a, b) => {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((key) => sameValue(a[key], b[key]))
  }
  return false
}

/**
 * The paths (dotted) of the leaves that differ between `a` and `b`. Objects are walked; arrays and primitive values are compared
 * whole (an array is one leaf). `undefined` against an absent key is no difference. An object on one side only counts through its
 * own leaves; a leaf that is `undefined` there counts for nothing.
 */
export const diffLeaves = (a, b) => {
  const paths = []
  const walk = (left, right, prefix) => {
    if (isPlainObject(left) || isPlainObject(right)) {
      if ((left === undefined || isPlainObject(left)) && (right === undefined || isPlainObject(right))) {
        const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})])
        for (const key of keys) walk(left?.[key], right?.[key], prefix ? `${prefix}.${key}` : key)
        return
      }
    }
    if (!sameValue(left, right)) paths.push(prefix)
  }
  walk(a ?? undefined, b ?? undefined, '')
  return paths
}

const under = (path, root) => path === root || path.startsWith(`${root}.`)

/**
 * How many changes are pending and which sections they are in.
 *
 * - theme: the leaves of `themeValues` that differ from `savedThemeValues`, without `website_settings.*` (the mirror of the site's
 *   fields, which are counted once as site changes);
 * - Advanced: the leaves of `advancedValues` that differ from `savedValues`, without `my_products.*` (that is the theme above);
 * - site: the keys of `siteChanges` (`formState.changes`), without `header` (the controller adds it when it saves, OW-02).
 *
 * Without a saved baseline (still loading) there is nothing to compare with: that part counts nothing.
 *
 * `count` is every leaf and key. `names` are the labels of the sections whose `match({ scope, path })` accepts one of them (scope
 * `'site'`, `'theme'` or `'advanced'`; the path is the key or the dotted path inside its draft), in the order of `sections` and
 * without repeating a label. A change no section accepts counts but names nothing.
 *
 * @returns {{ count: number, names: string[], changes: Array<{ scope: string, path: string }> }}
 */
export const countChanges = ({ themeValues, savedThemeValues, advancedValues, savedValues, siteChanges, savedSite, sections = [] }) => {
  const changes = []
  Object.keys(siteChanges || {})
    .filter((key) => key !== 'header')
    // redesign ordering-website review R1-02: a field typed back to its saved value is no change
    .filter((key) => !savedSite || (siteChanges[key] ?? '') !== (savedSite[key] ?? ''))
    .forEach((path) => changes.push({ scope: 'site', path }))
  if (savedThemeValues != null) {
    diffLeaves(themeValues, savedThemeValues)
      .filter((path) => !under(path, 'website_settings'))
      .forEach((path) => changes.push({ scope: 'theme', path }))
  }
  if (savedValues != null) {
    diffLeaves(advancedValues, savedValues)
      .filter((path) => !under(path, 'my_products'))
      .forEach((path) => changes.push({ scope: 'advanced', path }))
  }
  const names = []
  sections.forEach((section) => {
    if (typeof section.match !== 'function') return
    if (!changes.some((change) => section.match(change))) return
    if (!names.includes(section.label)) names.push(section.label)
  })
  return { count: changes.length, names, changes }
}
