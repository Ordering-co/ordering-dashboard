// Reading a theme schema in nodes (api-core docs/THEMES_V2_SCHEMA_FORMAT.md):
// a node has `$value` (its default); anything else is a group. What the editor
// shows comes from `$extensions["co.ordering.editor"]` and the root `editor`
// block, so adding a component, a prop, a key or a page needs no code here.

const EDITOR = 'co.ordering.editor'
const ENGINE = 'co.ordering'

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const isNode = (value) => isObject(value) && Object.prototype.hasOwnProperty.call(value, '$value')

/** The editor's metadata of a node or a group. */
export const editorOf = (item) => item?.$extensions?.[EDITOR] || {}

/**
 * A node or group the editor leaves out: `hidden`, or `$deprecated` (DTCG:
 * true or why). Its values still save and serve.
 */
export const isHidden = (item) => !!editorOf(item).hidden || (item?.$deprecated !== undefined && item.$deprecated !== false && item.$deprecated !== null)

/** What the engine reads of a node or a group: `scale`, `options`, `inherits`, `formats`, `hints`. */
export const engineOf = (item) => item?.$extensions?.[ENGINE] || {}

/** The keys of a path; visibility's and images' keys have dots of their own (`header.cart`). */
export const splitPath = (path) => {
  if (Array.isArray(path)) return path
  const [first, ...rest] = String(path).split('.')
  if (['visibility', 'images'].includes(first) && rest.length) return [first, rest.join('.')]
  return [first, ...rest]
}

export const joinPath = (keys) => keys.join('.')

/** The children of a group or a node's parts: its keys that don't start with `$`. */
export const childKeys = (item) => (isObject(item) ? Object.keys(item).filter(key => !key.startsWith('$')) : [])

/** The node or group at `path`, or undefined. */
export const getAt = (schema, path) => splitPath(path).reduce((item, key) => (isObject(item) ? item[key] : undefined), schema)

/**
 * The pages a section's group shows in (`pages`), those the schema has: the
 * group is in each of them, under their values, and not in its own section.
 */
export const pagesOfGroup = (schema, group) => (Array.isArray(group?.pages)
  ? group.pages.filter(page => {
    const item = getAt(schema, ['pages', page])
    return item !== undefined && !isHidden(item)
  })
  : [])

/** The groups of other sections a page shows (their `pages` name it), in the editor's order. */
export const pageGroupsOf = (schema, page) => (schema?.editor?.sections || [])
  .flatMap(section => section.groups || [])
  .filter(group => !group.hidden && pagesOfGroup(schema, group).includes(page))

/** The components a section's group shows in (`components`), those the schema has, as `pages` is for pages. */
export const componentsOfGroup = (schema, group) => (Array.isArray(group?.components)
  ? group.components.filter(name => {
    const item = getAt(schema, ['components', name])
    return item !== undefined && !isHidden(item)
  })
  : [])

/** The groups of other sections a component shows (their `components` name it), in the editor's order. */
export const componentGroupsOf = (schema, name) => (schema?.editor?.sections || [])
  .flatMap(section => section.groups || [])
  .filter(group => !group.hidden && componentsOfGroup(schema, group).includes(name))

/** Whether a section's group shows in pages or components instead of its own section. */
export const isPlacedElsewhere = (schema, group) => pagesOfGroup(schema, group).length > 0 || componentsOfGroup(schema, group).length > 0

/** A node's `$type`, or the nearest group's above it. */
export const typeOf = (schema, path) => {
  const keys = splitPath(path)
  for (let length = keys.length; length > 0; length--) {
    const item = getAt(schema, keys.slice(0, length))
    if (item?.$type) return item.$type
  }
  return null
}

export const humanize = (key) => {
  const text = String(key ?? '').replace(/[._]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

/** The text of a node: its own label, else the label of every prop of that name (`editor.props`), else null. */
export const labelOf = (schema, path) => {
  const keys = splitPath(path)
  const own = editorOf(getAt(schema, keys)).label
  if (own) return own
  return schema?.editor?.props?.[keys[keys.length - 1]]?.label || null
}

export const infoOf = (schema, path) => {
  const keys = splitPath(path)
  return editorOf(getAt(schema, keys)).info || schema?.editor?.props?.[keys[keys.length - 1]]?.info || null
}

/**
 * A text of the schema (`{ key, default, params? }`) in the editor's
 * language. A param that is a list takes the item `choose[param]` says.
 * Without a text, `fallback` read as words.
 */
export const formatText = (t, text, { fallback, choose = {}, values = {} } = {}) => {
  if (!text) return humanize(fallback)
  let result = t(text.key, text.default)
  Object.entries(text.params || {}).forEach(([param, value]) => {
    const item = Array.isArray(value) ? value[choose[param] ?? 0] : value
    result = result.split(param).join(item ? formatText(t, item) : '')
  })
  Object.entries(values).forEach(([param, value]) => { result = result.split(param).join(String(value)) })
  return result
}

/* Where values live in the theme */

/**
 * Where a node's value is in the theme: the schema's path, except a
 * component's platform (`components.<c>.platforms.<p>.<prop>`), which the
 * theme keeps in `platforms.<p>.components.<c>.base.<prop>`.
 */
export const themePathOf = (path) => {
  const keys = splitPath(path)
  if (keys[0] === 'components' && keys[2] === 'platforms' && keys.length > 4) {
    return ['platforms', keys[3], 'components', keys[1], 'base', ...keys.slice(4)]
  }
  return keys
}

export const getIn = (tree, keys) => keys.reduce((node, key) => (isObject(node) ? node[key] : undefined), tree)

export const hasIn = (tree, keys) => {
  const parent = getIn(tree, keys.slice(0, -1))
  return isObject(parent) && Object.prototype.hasOwnProperty.call(parent, keys[keys.length - 1])
}

/**
 * What a value is now: the change not saved yet (`edits`), else what the
 * theme sets (`current`), else `fallback` (the node's default). A null
 * change takes the default back. `own`: the theme (or a change) sets it.
 */
export const readTheme = ({ current, edits }, keys, fallback) => {
  if (hasIn(edits, keys)) {
    const value = getIn(edits, keys)
    return value === null ? { value: fallback, own: false, edited: true } : { value, own: true, edited: true }
  }
  if (hasIn(current, keys)) return { value: getIn(current, keys), own: true, edited: false }
  return { value: fallback, own: false, edited: false }
}

/* Aliases and conditions */

const ALIAS = /^\{([a-z_]+)\.([a-z0-9_]+)\}$/

export const parseAlias = (value) => {
  const match = typeof value === 'string' ? ALIAS.exec(value) : null
  return match ? [match[1], match[2]] : null
}

const ROLE = /^\{([a-z][a-z0-9_]*)\}$/

/** A role (`{ink}`): one of its component's own colors, with no group, so not a theme token. */
export const parseRole = (value) => {
  const match = typeof value === 'string' ? ROLE.exec(value) : null
  return match ? match[1] : null
}

export const toAlias = (scale, level) => `{${scale}.${level}}`

/**
 * A value with its token aliases followed (`{space.none}` → 0), with the
 * changes not saved yet; what `resolve` served (`ctx.resolved`, the theme's
 * tree) wins while the path has no change newer than it. A cycle stops at null.
 */
export const resolveValue = (ctx, value, seen = []) => {
  const alias = parseAlias(value)
  if (!alias) return value
  const path = `tokens.${alias[0]}.${alias[1]}`
  if (seen.includes(path)) return null
  const served = getIn(ctx.resolved, splitPath(path))
  if (served !== undefined && !hasIn(ctx.edits, splitPath(path))) return served
  const node = getAt(ctx.schema, path)
  if (!isNode(node)) return null
  return resolveValue(ctx, readTheme(ctx, splitPath(path), node.$value).value, [...seen, path])
}

/** The value a condition reads: what `resolve` served for the path, else the theme's, aliases followed. */
export const resolvedAt = (ctx, path) => {
  const keys = splitPath(path)
  const served = getIn(ctx.resolved, themePathOf(keys))
  const node = getAt(ctx.schema, keys)
  if (served !== undefined && !hasIn(ctx.edits, themePathOf(keys))) return served
  return resolveValue(ctx, readTheme(ctx, themePathOf(keys), isNode(node) ? node.$value : undefined).value)
}

/** Whether a condition (`{ path, op, value? }`) holds; none always does. */
export const meets = (ctx, condition) => {
  if (!condition) return true
  const value = resolvedAt(ctx, condition.path)
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  switch (condition.op) {
    case 'eq': return same(value, condition.value)
    case 'neq': return !same(value, condition.value)
    case 'in': return Array.isArray(condition.value) && condition.value.some(item => same(value, item))
    case 'not_in': return !(Array.isArray(condition.value) && condition.value.some(item => same(value, item)))
    case 'truthy': return !!value
    case 'falsy': return !value
    default: return true
  }
}

/* Controls */

/** The scale a value's levels come from: the node's `scale`, else its type's. */
export const scaleOf = (schema, path) => {
  const scale = engineOf(getAt(schema, path)).scale
  if (scale) return scale
  return { typography: 'typography', duration: 'motion', opacity: 'opacity', shadow: 'shadow' }[typeOf(schema, path)] || null
}

const isToken = (path) => splitPath(path)[0] === 'tokens'

/** The control of a node: the editor's, else the one its type takes. */
export const controlOf = (schema, path) => {
  const node = getAt(schema, path)
  const control = editorOf(node).control
  if (control) return control
  const type = typeOf(schema, path)
  switch (type) {
    case 'color':
    case 'role': return 'color'
    case 'dimension': return scaleOf(schema, path) && !isToken(path) ? 'level' : 'range'
    case 'duration': return isToken(path) ? 'range' : 'level'
    case 'opacity': return isToken(path) ? 'range' : 'level'
    case 'typography': return isToken(path) ? 'typography' : 'level'
    case 'number': return 'range'
    case 'font': return 'font'
    case 'fontRole':
    case 'option':
    case 'layout': return 'select'
    case 'boolean': return 'toggle'
    case 'border': return 'border'
    case 'shadow': return 'shadow'
    case 'image': return 'image'
    case 'sections': return 'sortable_sections'
    case 'slot': return 'cards'
    case 'html': return 'html'
    default: return 'text'
  }
}

/** The levels of a scale (`{radius.md}`…) with their label and value, in the schema's order. */
export const levelsOf = (schema, scale) => {
  const group = schema?.tokens?.[scale]
  return childKeys(group).filter(name => isNode(group[name])).map(name => ({
    value: toAlias(scale, name),
    name,
    label: editorOf(group[name]).label || null,
    amount: group[name].$value
  }))
}

/**
 * A node's options: the editor's (with labels), else the engine's values.
 * A level the engine narrows (a rounding never none) keeps only those.
 */
export const optionsOf = (schema, path) => {
  const node = getAt(schema, path)
  const own = editorOf(node).options
  if (Array.isArray(own)) return own
  const allowed = engineOf(node).options
  const scale = scaleOf(schema, path)
  if (scale && controlOf(schema, path) === 'level') {
    const levels = levelsOf(schema, scale)
    return Array.isArray(allowed) ? levels.filter(level => allowed.includes(level.name)) : levels
  }
  return Array.isArray(allowed) ? allowed.map(value => ({ value })) : []
}

/* Walking */

/** A group's children in the editor's order (`order`, then the schema's), without the hidden ones. */
export const orderedChildren = (schema, path) => {
  const group = getAt(schema, path)
  return childKeys(group)
    .map((key, index) => ({ key, index, item: group[key] }))
    .filter(({ item }) => isObject(item) && !isHidden(item))
    .sort((a, b) => (editorOf(a.item).order ?? Infinity) - (editorOf(b.item).order ?? Infinity) || a.index - b.index)
    .map(({ key }) => key)
}

/** Every node under a path, depth first, in the editor's order. */
export const nodesUnder = (schema, path) => {
  const item = getAt(schema, path)
  if (isNode(item)) return [joinPath(splitPath(path))]
  return orderedChildren(schema, path).flatMap(key => nodesUnder(schema, [...splitPath(path), key]))
}

/** Whether the theme, or a change not saved, sets anything under a path of the theme. */
export const touches = (ctx, keys) => hasIn(ctx.current, keys) || hasIn(ctx.edits, keys)

/** The paths a theme's changes set, as `a.b.c`: a whole value's (a text style's) by its fields. */
const leafPaths = (tree, prefix = []) => Object.entries(isObject(tree) ? tree : {})
  .flatMap(([key, value]) => (isObject(value) && Object.keys(value).length ? leafPaths(value, [...prefix, key]) : [joinPath([...prefix, key])]))

/**
 * What the theme saved that this version of the schema no longer takes (the
 * API's `invalid`, `[{ path, code }]`, dropped when it saves, or clamped:
 * `isClamped`), by path; but
 * what a change not saved yet sets, since that change is what saves.
 */
export const storedErrorsOf = (invalid, edits) => {
  const changed = leafPaths(edits)
  const touched = (path) => changed.some(edit => edit === path || edit.startsWith(`${path}.`) || path.startsWith(`${edit}.`))
  return Object.fromEntries((Array.isArray(invalid) ? invalid : [])
    .filter(item => typeof item?.path === 'string' && !touched(item.path))
    .map(item => [item.path, item.code]))
}

/** A value saved out of its range (`out_of_range`): the API reads it at the closest limit and saves it there, not dropped. */
export const isClamped = (code) => String(code).endsWith('.out_of_range')

/** The errors the API answered under a path of the theme. */
export const errorsUnder = (fieldErrors, keys) => {
  const prefix = joinPath(keys)
  return Object.keys(fieldErrors || {}).filter(key => key === prefix || key.startsWith(`${prefix}.`))
}

/* Sections of a page (a `sections` node) */

/**
 * The sections as the website shows them with `value` (the theme's `[{ key,
 * visible }]`): each group fills the places its sections have by default, in
 * the theme's order; fixed ones (no group) stay. Unknown and repeated keys are
 * dropped, and a section that can't be hidden is always visible.
 */
export const resolveSections = (defaults, value) => {
  const themed = Array.isArray(value) ? value.filter(item => isObject(item) && typeof item.key === 'string') : []
  const byKey = new Map(defaults.map(section => [section.key, section]))
  const themeOrder = []
  const visibleOf = new Map()
  themed.forEach(item => {
    if (!byKey.has(item.key) || themeOrder.includes(item.key)) return
    themeOrder.push(item.key)
    if (typeof item.visible === 'boolean') visibleOf.set(item.key, item.visible)
  })
  const queues = {}
  defaults.forEach(section => {
    const group = section.group ?? null
    if (group === null || queues[group]) return
    const inGroup = defaults.filter(item => item.group === group).map(item => item.key)
    const ordered = themeOrder.filter(key => byKey.get(key).group === group)
    inGroup.forEach((key, index) => { if (!ordered.includes(key)) ordered.splice(index, 0, key) })
    queues[group] = ordered
  })
  return defaults
    .map(section => (section.group == null ? section : byKey.get(queues[section.group].shift())))
    .map(section => ({
      key: section.key,
      group: section.group ?? null,
      hideable: section.hideable !== false,
      visible: section.hideable === false || (visibleOf.has(section.key) ? visibleOf.get(section.key) : section.visible !== false)
    }))
}

/** `key` moved to where `toKey` is, among the places of its group; the rest stay. */
export const moveSection = (sections, key, toKey) => {
  const moving = sections.find(section => section.key === key)
  const target = sections.find(section => section.key === toKey)
  if (!moving || !target || moving.group == null || moving.group !== target.group || key === toKey) return sections
  const slots = sections.map((section, index) => (section.group === moving.group ? index : -1)).filter(index => index >= 0)
  const order = slots.map(index => sections[index]).filter(section => section.key !== key)
  order.splice(slots.map(index => sections[index].key).indexOf(toKey), 0, moving)
  const next = [...sections]
  slots.forEach((slot, index) => { next[slot] = order[index] })
  return next
}

export const isDefaultSections = (defaults, sections) => {
  const base = resolveSections(defaults, null)
  return base.length === sections.length && base.every((section, index) => section.key === sections[index].key && section.visible === sections[index].visible)
}

export const toSectionsValue = (sections) => sections.map(({ key, visible }) => ({ key, visible }))
