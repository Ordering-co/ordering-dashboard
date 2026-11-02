import React, { useId, useState } from 'react'
import { ChevronDown } from 'react-bootstrap-icons'

import {
  ChangedDot,
  ContrastBadge,
  EditorCard,
  FieldError,
  GroupToggle,
  RowControls,
  RowHead,
  SourceTag,
  SourceTags,
  SrOnly,
  ValueRow
} from '../BuilderWebTheme/styles'
import { getContrast, getContrastLevel } from './colors'
import { CONTROLS, ComputedValue, ResetValue, Toggle } from './controls'
import { isReadOnly, ReadOnlyValue } from './ReadOnlyValue'
import { SectionsControl } from './SectionsControl'
import {
  childKeys,
  controlOf,
  editorOf,
  engineOf,
  errorsUnder,
  formatText,
  getAt,
  getIn,
  infoOf,
  isClamped,
  isHidden,
  isNode,
  joinPath,
  labelOf,
  levelsOf,
  meets,
  orderedChildren,
  parseAlias,
  readTheme,
  resolvedAt,
  resolveValue,
  scaleOf,
  splitPath,
  themePathOf,
  typeOf
} from './schemaNodes'

// The recursive renderer: a node is a row with the
// control its metadata names; a group is its cards (`groups`), or its nodes in
// order and its subgroups under them. `ctx.mount` shows a group's nodes saved
// elsewhere: a component inside a group (`scope`), a page on a platform.

/**
 * Why the API refused a value (`theme.invalid`, by the end of its code): a
 * translucent color where the schema allows none (`.alpha`), a value that
 * follows one the theme no longer has (`.alias`), a number out of its range
 * (`.out_of_range`), an image in a format it doesn't take (`.format`), else
 * any other. `stored`: the theme saved it before this version of the schema,
 * which drops it when the theme saves; but a number out of its range, which
 * reads at the closest limit and saves there.
 */
export const invalidText = (t, codes, { stored = false } = {}) => {
  const ends = (end) => codes.some(code => String(code).endsWith(end))
  if (stored && codes.every(isClamped)) return t('BUILDER_THEME_CLAMPED_STORED', 'It was saved outside the range this version of the website takes and was set to the closest limit. It’s saved like that when you save.')
  const why = ends('.alpha')
    ? t('BUILDER_THEME_INVALID_ALPHA', 'This color can’t be transparent. Choose an opaque one.')
    : ends('.alias')
      ? t('BUILDER_THEME_INVALID_ALIAS', 'This value follows one the theme no longer has. Choose another one.')
      : ends('.out_of_range')
        ? t('BUILDER_THEME_INVALID_RANGE', 'This value is outside the range it takes. Choose another one.')
        : ends('.format')
          ? t('BUILDER_THEME_INVALID_FORMAT', 'This image’s format isn’t taken here. Upload it in one of the formats below.')
          : t('BUILDER_THEME_INVALID_VALUE', 'This value isn’t valid. Choose another one.')
  return stored ? `${why} ${t('BUILDER_THEME_INVALID_STORED', 'It was saved before this version of the website and is dropped when you save.')}` : why
}

export const Changed = ({ t }) => (
  <>
    <ChangedDot aria-hidden='true' title={t('BUILDER_THEME_CHANGED', 'Changed')} />
    <SrOnly>{t('BUILDER_THEME_CHANGED', 'Changed')}</SrOnly>
  </>
)

const startsWith = (keys, prefix) => prefix.every((key, index) => keys[index] === key)

/**
 * Where a node is in the theme and what it is now. Mounted (`ctx.mount`), it
 * is saved under `mount.to` and, until it is set there, takes the group's
 * default, the node's own on the platform (`co.ordering.platforms`) or, without
 * one, what the node has where it comes from.
 */
export const readNode = (ctx, path) => {
  const keys = splitPath(path)
  const node = getAt(ctx.schema, keys)
  const fallback = isNode(node) ? node.$value : undefined
  const mount = ctx.mount && startsWith(keys, ctx.mount.from) ? ctx.mount : null
  if (!mount) {
    const themeKeys = themePathOf(keys)
    return { ...readTheme(ctx, themeKeys, fallback), themeKeys, fallback }
  }
  const themeKeys = [...mount.to, ...keys.slice(mount.from.length)]
  const scoped = getAt(ctx.schema, themeKeys)
  const onPlatform = ctx.platform ? engineOf(node).platforms?.[ctx.platform] : undefined
  const from = isNode(scoped) ? scoped.$value : onPlatform !== undefined ? onPlatform : readTheme(ctx, themePathOf(keys), fallback).value
  return { ...readTheme(ctx, themeKeys, from), themeKeys, fallback: from, mounted: !isNode(scoped) }
}

const readScope = ({ scope }, node, keys) => {
  const value = scope?.mode ?? node.$value
  return { value, own: value !== node.$value, themeKeys: themePathOf(keys), fallback: node.$value }
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * What a control shows for a value the theme doesn't set: what `resolve`
 * served (a parent's, Identity's) when it differs from the node's own
 * default, as the alias it came from (`aliases` by path; a border's width
 * at `<path>.width`). Without one, a level is the level with that amount.
 */
export const shownValue = (ctx, path, read) => {
  if (read.own || !ctx.resolved) return read.value
  const key = joinPath(read.themeKeys)
  // A value with a name for none (`labels.unset`: "Same as pressed") shows that name while the
  // theme has none, whatever resolve fills in for it; unless it inherits a component's
  if ((read.value === null || read.value === undefined) && editorOf(getAt(ctx.schema, path)).labels?.unset && ctx.sources?.[key] !== 'inherited') return read.value
  const served = getIn(ctx.resolved, read.themeKeys)
  if (served === undefined || same(resolveValue(ctx, read.value), served)) return read.value
  // A token is the level itself: it shows what it is, never an alias (its own name)
  if (splitPath(path)[0] === 'tokens') return served
  const scale = scaleOf(ctx.schema, path)
  const alias = ctx.aliases?.[key]
  if (alias && scale && parseAlias(alias)?.[0] === scale) return alias
  const levelOf = (group, amount) => levelsOf(ctx.schema, group).find(level => same(resolveValue(ctx, level.value), amount))?.value
  if (scale) return levelOf(scale, served) ?? served
  if (typeOf(ctx.schema, path) === 'border' && served && typeof served === 'object') {
    const part = (name, group) => ctx.aliases?.[`${key}.${name}`] ?? (group && typeof served[name] === 'number' ? levelOf(group, served[name]) : null) ?? served[name]
    return { ...served, width: part('width', 'border'), color: part('color') }
  }
  return served
}

/**
 * The control of a node, or null when it only shows its value: a control
 * this editor doesn't have (a newer schema's), or a text field for what isn't
 * a text, which would save it as one.
 */
const controlFor = (schema, path, value) => {
  const control = controlOf(schema, path)
  if (!CONTROLS[control] || (control === 'text' && value !== null && typeof value === 'object')) return null
  return CONTROLS[control]
}

const isShown = (ctx, path) => {
  const node = getAt(ctx.schema, path)
  return !isHidden(node) && meets(ctx, editorOf(node).visible_if)
}

/** One node: its label (with where its value comes from), its control, its reset and its error. */
export const NodeField = ({ ctx, path, pairPath }) => {
  const { t, schema, fieldErrors, setValue } = ctx
  const errorId = useId()
  const keys = splitPath(path)
  const node = getAt(schema, keys)
  const meta = editorOf(node)
  if (!isNode(node) || !isShown(ctx, path)) return null
  const control = controlOf(schema, path)
  const siteScope = control === 'scope' ? ctx.siteScope : null
  const read = siteScope ? readScope(siteScope, node, keys) : readNode(ctx, path)
  const label = formatText(t, labelOf(schema, keys), { fallback: keys[keys.length - 1] })
  const info = ctx.platform && meta.platform?.info ? meta.platform.info : infoOf(schema, keys)
  const disabled = meta.disabled_if ? meets(ctx, meta.disabled_if) : false
  const pair = pairPath ? readNode(ctx, pairPath) : null
  // What the API refused, else what the theme saved that this version drops
  const errorsIn = (map) => [...errorsUnder(map, read.themeKeys), ...(pair ? errorsUnder(map, pair.themeKeys) : [])]
  const refused = errorsIn(fieldErrors)
  const stored = refused.length ? false : errorsIn(ctx.storedErrors).length > 0
  const errors = stored ? errorsIn(ctx.storedErrors) : refused
  const errorCodes = errors.map(key => (stored ? ctx.storedErrors : fieldErrors)[key])
  // A read-only value isn't the editor's to change: no changed mark, no reset
  const own = (read.own && !isReadOnly(schema, path)) || (pair?.own && !isReadOnly(schema, pairPath))
  // Where the value comes from (`resolve`'s sources): the component it inherits from, or a group's component
  const parent = ctx.sources?.[joinPath(read.themeKeys)] === 'inherited' && !read.own ? engineOf(getAt(schema, ['components', keys[1]])).inherits : null
  const fromName = ctx.mount && read.mounted && !read.own
    ? ctx.mount.label
    : parent ? formatText(t, labelOf(schema, ['components', parent]), { fallback: parent }) : null
  // A prop that follows Identity's overall shadow, rounding or border (`co.ordering.follows`): its value comes
  // from there (resolve applies it) until the theme sets its own, which goes back to Identity's with the reset
  const identity = engineOf(node).follows && !fromName ? t('BUILDER_THEME_GROUP_IDENTITY', 'Identity') : null
  const onChange = (next) => siteScope ? siteScope.setScopeMode(next ?? read.fallback) : setValue(read.themeKeys, next)
  // What a boolean without a value of its own follows (a page's footer: the whole website's, or on a
  // platform the page's), for the option that reads "As on the whole website (shown)"
  const inherited = typeof read.fallback === 'boolean' ? read.fallback : typeOf(schema, keys) === 'boolean' ? resolvedAt(ctx, 'visibility.footer') : null
  const choose = { _state_: inherited === false ? 1 : 0 }

  const renderControl = (controlPath, value, change, controlLabel, nodeRead = read) => {
    if (isReadOnly(schema, controlPath)) return <ReadOnlyValue ctx={ctx} path={controlPath} label={controlLabel} read={nodeRead} />
    if (control === 'sortable_sections') {
      return <SectionsControl ctx={ctx} path={controlPath} label={controlLabel} value={value} own={nodeRead.own} fallback={nodeRead.fallback} onChange={change} keepValue={!!ctx.mount} />
    }
    const Control = controlFor(schema, controlPath, value)
    if (!Control) return <ReadOnlyValue ctx={ctx} path={controlPath} label={controlLabel} read={nodeRead} />
    return (
      <Control
        ctx={ctx}
        path={controlPath}
        label={controlLabel}
        value={value}
        own={nodeRead.own}
        fallback={nodeRead.fallback}
        onChange={change}
        invalid={errors.length > 0}
        describedBy={errors.length ? errorId : undefined}
        choose={choose}
      />
    )
  }

  const pairLabel = pairPath ? formatText(t, labelOf(schema, pairPath), { fallback: splitPath(pairPath).pop() }) : null
  const ratio = pair ? getContrast(resolveValue(ctx, read.value), resolveValue(ctx, pair.value)) : null
  const level = getContrastLevel(ratio)
  const contrastText = level && `${ratio}:1 · ${level === 'aaa' ? 'AAA' : level === 'aa' ? 'AA' : level === 'large' ? t('BUILDER_THEME_CONTRAST_LARGE', 'Large text') : t('BUILDER_THEME_CONTRAST_LOW', 'Low')}`

  return (
    <ValueRow data-path={joinPath(keys)} style={disabled ? { opacity: 0.5 } : undefined}>
      <span>
        {label}
        {own && !fromName && !identity && <Changed t={t} />}
        {(fromName || identity) && (
          <SourceTags>
            {fromName && <SourceTag>{t('BUILDER_THEME_FROM_PARENT', 'From _name_').replace('_name_', fromName)}</SourceTag>}
            {identity && !read.own && <SourceTag>{t('BUILDER_THEME_FROM_PARENT', 'From _name_').replace('_name_', identity)}</SourceTag>}
            {identity && read.own && <SourceTag custom>{t('BUILDER_THEME_CUSTOM', 'Custom')}</SourceTag>}
          </SourceTags>
        )}
        {info && <small style={{ flexBasis: '100%', fontWeight: 400, fontSize: 12, color: '#5E6B7D' }}>{formatText(t, info)}</small>}
      </span>
      <fieldset disabled={disabled} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {pair
          ? (
            <RowControls columns='minmax(0, 1fr) minmax(0, 1fr) 130px'>
              {renderControl(path, shownValue(ctx, path, read), onChange, label)}
              {renderControl(pairPath, shownValue(ctx, pairPath, pair), (next) => setValue(pair.themeKeys, next), pairLabel, pair)}
              {level ? <ContrastBadge level={level}>{contrastText}</ContrastBadge> : <span />}
            </RowControls>
            )
          : renderControl(path, shownValue(ctx, path, read), onChange, label)}
      </fieldset>
      {own
        ? <ResetValue label={identity && read.own ? t('BUILDER_THEME_BACK_TO_PARENT_OF', '_name_: back to _parent_').replace('_name_', label).replace('_parent_', identity) : t('BUILDER_THEME_RESTORE_DEFAULT_OF', 'Restore _name_ to its default').replace('_name_', label)} onClick={() => { if (!isReadOnly(schema, path)) onChange(null); if (pair && !isReadOnly(schema, pairPath)) setValue(pair.themeKeys, null) }} />
        : <span />}
      {errors.length > 0 && <FieldError id={errorId} role={stored ? undefined : 'alert'}>{invalidText(t, errorCodes, { stored })}</FieldError>}
    </ValueRow>
  )
}

/** Rows of nodes: a node that names its `pair` shares that row, next to it. */
const NodeRows = ({ ctx, paths }) => {
  const paired = new Set(paths.filter(path => {
    const pair = editorOf(getAt(ctx.schema, path)).pair
    return pair && paths.includes(pair)
  }))
  const pairOf = (path) => [...paired].find(item => editorOf(getAt(ctx.schema, item)).pair === path)
  return paths.filter(path => !paired.has(path)).map(path => <NodeField key={path} ctx={ctx} path={path} pairPath={pairOf(path)} />)
}

/** What a card says of its hidden nodes (`info_off`), once each. */
const offNotes = (ctx, paths) => {
  const notes = paths
    .filter(path => !isHidden(getAt(ctx.schema, path)))
    .map(path => editorOf(getAt(ctx.schema, path)))
    .filter(meta => meta.info_off && !meets(ctx, meta.visible_if))
    .map(meta => formatText(ctx.t, meta.info_off))
  return [...new Set(notes)]
}

/**
 * Rows and columns of values: each row a group (a button color, a size),
 * each column a prop they share (fill and text, height and icon).
 */
const MatrixRows = ({ ctx, paths }) => {
  const { t, schema, setValue } = ctx
  const rows = paths.filter(path => !isNode(getAt(schema, path)))
  const columns = []
  rows.forEach(row => orderedChildren(schema, row).forEach(key => {
    if (isNode(getAt(schema, [...splitPath(row), key])) && !columns.includes(key)) columns.push(key)
  }))
  const template = `repeat(${columns.length}, minmax(0, 1fr))`
  const columnLabel = (key) => {
    const row = rows.find(item => isNode(getAt(schema, [...splitPath(item), key])))
    return formatText(t, labelOf(schema, [...splitPath(row), key]), { fallback: key })
  }
  return (
    <>
      <RowHead aria-hidden='true'>
        <span />
        <RowControls columns={template}>{columns.map(key => <span key={key}>{columnLabel(key)}</span>)}</RowControls>
        <span />
      </RowHead>
      {rows.map(row => {
        const name = formatText(t, labelOf(schema, row), { fallback: splitPath(row).pop() })
        const cells = columns.map(key => [...splitPath(row), key])
        const reads = cells.map(cell => (isNode(getAt(schema, cell)) && isShown(ctx, cell) ? readNode(ctx, cell) : null))
        const editable = reads.map((read, index) => !!read && !isReadOnly(schema, cells[index]))
        const own = reads.some((read, index) => editable[index] && read.own)
        const info = infoOf(schema, row)
        return (
          <ValueRow key={row} data-path={row}>
            <span>
              {name}
              {own && <Changed t={t} />}
              {info && <small style={{ flexBasis: '100%', fontWeight: 400, fontSize: 12, color: '#5E6B7D' }}>{formatText(t, info)}</small>}
            </span>
            <RowControls columns={template}>
              {cells.map((cell, index) => {
                const read = reads[index]
                const cellLabel = `${name}: ${columnLabel(columns[index])}`
                if (!read) {
                  // Not in the schema: what the API works out for it, if anything, to read
                  const computed = isNode(getAt(schema, cell)) ? undefined : getIn(ctx.resolved, themePathOf(cell))
                  if (computed !== undefined && computed !== null && typeof computed !== 'object') return <ComputedValue key={index} t={t} label={cellLabel} value={computed} />
                  return <span key={index} aria-hidden='true' style={{ textAlign: 'center', color: '#ADB5BD' }}>—</span>
                }
                const Control = controlFor(schema, cell, read.value)
                if (!editable[index] || !Control) return <ReadOnlyValue key={index} ctx={ctx} path={joinPath(cell)} label={cellLabel} read={read} />
                // Cells are narrow: a color shows its link as an icon, and its whole name on hover
                return <Control key={index} ctx={ctx} path={joinPath(cell)} label={cellLabel} value={shownValue(ctx, joinPath(cell), read)} own={read.own} fallback={read.fallback} onChange={(next) => setValue(read.themeKeys, next)} compact />
              })}
            </RowControls>
            {own
              ? <ResetValue label={t('BUILDER_THEME_RESTORE_DEFAULT_OF', 'Restore _name_ to its default').replace('_name_', name)} onClick={() => reads.forEach((read, index) => editable[index] && read.own && setValue(read.themeKeys, null))} />
              : <span />}
          </ValueRow>
        )
      })}
    </>
  )
}

/**
 * A card of the schema (`groups[]`, a section's group): its title and help,
 * the switch in its header (`toggle`), and its paths: nodes as rows (a
 * matrix with `control: matrix`), groups as their own cards below.
 */
export const GroupCard = ({ ctx: outerCtx, group }) => {
  const { t, schema, setValue } = outerCtx
  const [open, setOpen] = useState(group.open !== false)
  const id = useId()
  const paths = (group.paths || []).filter(path => getAt(schema, path) !== undefined && !isHidden(getAt(schema, path)))
  // A card that keeps its values in order (`ordered`): each one between its neighbours
  const ctx = ['ascending', 'descending'].includes(group.ordered) ? { ...outerCtx, bounds: orderBounds(outerCtx, paths, group.ordered) } : outerCtx
  // A group the schema hides (`hidden`) isn't shown; its values still save and serve
  if (group.hidden || (!paths.length && !group.toggle)) return null
  const nodes = paths.filter(path => isNode(getAt(schema, path)))
  const groups = paths.filter(path => !isNode(getAt(schema, path)))
  const label = group.label ? formatText(t, group.label) : null
  const toggle = group.toggle && isNode(getAt(schema, group.toggle.path)) ? readNode(ctx, group.toggle.path) : null
  const toggleLabel = group.toggle ? formatText(t, group.toggle.label || labelOf(schema, group.toggle.path), { fallback: group.toggle.path }) : null
  const collapsible = group.open !== undefined
  // Rows of groups whose parent is a matrix (a button's colors) are one, even when the card doesn't say so
  const parentControl = (path) => editorOf(getAt(schema, splitPath(path).slice(0, -1))).control
  const matrix = group.control === 'matrix' || (groups.length > 0 && !nodes.length && groups.every(path => parentControl(path) === 'matrix'))
  const changed = !!toggle?.own || paths.some(path => {
    const read = isNode(getAt(schema, path)) ? readNode(ctx, path) : null
    return read ? read.own : false
  })
  const body = (
    <>
      {matrix ? <MatrixRows ctx={ctx} paths={paths} /> : <NodeRows ctx={ctx} paths={nodes.filter(path => path !== group.toggle?.path)} />}
      {offNotes(ctx, nodes).map(note => <p key={note} style={{ margin: 0, padding: '4px 20px 12px', color: '#5E6B7D' }}>{note}</p>)}
    </>
  )
  return (
    <>
      <EditorCard aria-labelledby={label ? id : undefined} $bare={!label}>
        {collapsible && label
          ? (
            <GroupToggle type='button' id={id} aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(prev => !prev)}>
              {label}
              {changed && <span>{t('BUILDER_THEME_CHANGED', 'Changed')}</span>}
              <ChevronDown aria-hidden='true' />
            </GroupToggle>
            )
          : label && (
            <header>
              <h3 id={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{label}{toggle?.own && <Changed t={t} />}</h3>
              {toggle && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Toggle label={toggleLabel} checked={toggle.value !== false} onChange={(next) => setValue(toggle.themeKeys, next)} />
                  <span aria-hidden='true'>{toggleLabel}</span>
                  {toggle.own && <ResetValue label={t('BUILDER_THEME_RESTORE_DEFAULT_OF', 'Restore _name_ to its default').replace('_name_', toggleLabel)} onClick={() => setValue(toggle.themeKeys, null)} />}
                </span>
              )}
              {group.info && <p>{formatText(t, group.info)}</p>}
            </header>
          )}
        {(!collapsible || open) && body}
      </EditorCard>
      {(!collapsible || open) && !matrix && groups.map(path => <SchemaGroup key={path} ctx={ctx} path={path} titled />)}
    </>
  )
}

/** A value to keep in order: a number, or a text style's size. */
const amountOf = (value) => (typeof value === 'number' ? value : typeof value?.size === 'number' ? value.size : null)

/**
 * In a card that keeps its values in order (`ordered`: ascending or
 * descending, as its paths go), the least and most each can be: its
 * neighbours' values, by path.
 */
export const orderBounds = (ctx, paths, ordered) => {
  const amounts = paths.map(path => amountOf(resolvedAt(ctx, path)))
  return Object.fromEntries(paths.map((path, index) => {
    const before = index > 0 ? amounts[index - 1] : null
    const after = index < paths.length - 1 ? amounts[index + 1] : null
    return [path, ordered === 'descending' ? { min: after, max: before } : { min: before, max: after }]
  }))
}

/** The paths a group's cards hold, to leave out of its plain rows. */
const pathsInCards = (cards) => new Set(cards.flatMap(card => card.paths || []))

/**
 * A group of the schema: the nodes no card holds in a card of their own
 * (titled with the group's label when `titled`), its cards (`groups`) before
 * or after them by their `placement` (after by default), then its subgroups
 * (a variant's states…), each as a group. What `exclude` names (shown by a
 * card of the component) is left out at any depth.
 */
export const SchemaGroup = ({ ctx, path, titled, skip = [], exclude }) => {
  const { t, schema } = ctx
  const keys = splitPath(path)
  const item = getAt(schema, keys)
  if (item === undefined || isHidden(item)) return null
  if (isNode(item)) return <EditorCard $bare><NodeField ctx={ctx} path={joinPath(keys)} /></EditorCard>
  const meta = editorOf(item)
  const cards = (meta.groups || []).filter(card => !skip.includes(card.key))
  const inCards = pathsInCards(meta.groups || [])
  // `exclude`: paths a card around this group already shows
  const children = orderedChildren(schema, keys).map(key => joinPath([...keys, key])).filter(child => !inCards.has(child) && !exclude?.has(child))
  const nodes = children.filter(child => isNode(getAt(schema, child)))
  const groups = children.filter(child => !isNode(getAt(schema, child)))
  const label = meta.label ? formatText(t, meta.label) : null
  return (
    <>
      {cards.filter(card => card.placement === 'before').map(card => <GroupCard key={card.key} ctx={ctx} group={card} />)}
      {nodes.length > 0 && <GroupCard ctx={ctx} group={{ key: 'rows', label: titled ? meta.label : null, info: titled ? meta.info : null, paths: nodes }} />}
      {nodes.length === 0 && titled && label && groups.length > 0 && <h4 style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600 }}>{label}</h4>}
      {cards.filter(card => card.placement !== 'before').map(card => <GroupCard key={card.key} ctx={ctx} group={card} />)}
      {groups.map(child => <SchemaGroup key={child} ctx={ctx} path={child} titled exclude={exclude} />)}
    </>
  )
}

/** Whether anything under a path is set by the theme, or by a change not saved. */
export const touchesPath = (ctx, path) => {
  const keys = splitPath(path)
  const item = getAt(ctx.schema, keys)
  if (isNode(item)) return readNode(ctx, keys).own
  return childKeys(item).some(key => touchesPath(ctx, [...keys, key]))
}
