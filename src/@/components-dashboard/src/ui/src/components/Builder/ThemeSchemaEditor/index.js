import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Search } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { TabButton, TabList } from '../styles'
import { ChipRow, ComponentDetail, ComponentLayout, ComponentList, EditorBody, EditorMain, SectionNav } from '../BuilderWebTheme/styles'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { Changed, GroupCard, SchemaGroup, touchesPath } from './SchemaGroup'
import { childKeys, componentGroupsOf, componentsOfGroup, editorOf, formatText, getAt, isHidden, isNode, isPlacedElsewhere, joinPath, labelOf, pageGroupsOf, pagesOfGroup, splitPath, storedErrorsOf } from './schemaNodes'
import { isSiteSection } from './SiteSettings'

export { SchemaGroup, GroupCard, NodeField, readNode } from './SchemaGroup'
export { CONTROLS } from './controls'
export { SiteSettingsEditor, isSiteSection } from './SiteSettings'
export { invalidText } from './SchemaGroup'

// The theme editor built from the schema: the root
// `editor` block gives the sections, their groups, their order and how each
// shows (`layout`, the parts' `sources`, `choices` and `nested`, each card's
// `part` and `placement`). What it doesn't declare follows the rules below.
// Values go through `setValue(path, value)` as BuilderThemeEditor has it.

const normalizeSearch = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** A list with a detail (`layout: "list"`); undeclared, when every path of its groups is a group. */
const isListSection = (schema, section) => {
  if (section.layout) return section.layout === 'list'
  const paths = (section.groups || []).flatMap(group => group.paths || [])
  return paths.length > 0 && paths.every(path => {
    const item = getAt(schema, path)
    return item !== undefined && !isNode(item)
  })
}

/** Undeclared, a tab joins Colors and styles, and takes no cards per option in these parts. */
const PART_SOURCES = { colors: ['colors', 'appearances'] }
const WHOLE_PARTS = ['base', 'slots', 'platforms', 'scope']

const sourcesOf = (part) => part.sources || PART_SOURCES[part.key] || [part.key]

/** Whether a card's paths start under the component. */
const insideOf = (path, card) => {
  const first = splitPath(card.paths?.[0] || '')
  const keys = splitPath(path)
  return first.length > keys.length && keys.every((key, index) => first[index] === key)
}

/** The tab a component's card goes in (`part`); undeclared, the one its first path is under, else Base. */
const partOfCard = (path, card, parts) => {
  if (card.part) return card.part
  if (!insideOf(path, card)) return 'base'
  const source = splitPath(card.paths[0])[splitPath(path).length]
  return parts.find(part => sourcesOf(part).includes(source))?.key || source
}

/** Before or after the tab's rows (`placement`); undeclared, before unless it is the component's own in Base. */
const placementOf = (path, card, part) => card.placement || (part === 'base' && insideOf(path, card) ? 'after' : 'before')

/**
 * A component: a tab per part it has (Base, Colors and styles, Variants,
 * Sizes, Shapes, Pieces, Inside, Platforms), and in each the part's groups,
 * or a chip per choice (a variant, a size) and the chosen one's values. Its
 * own cards (`groups`) go in the part their values are in. With `mount` it is
 * a component inside a group: saved there, starting as the component.
 */
const ComponentParts = ({ ctx, path, mount }) => {
  const { t, schema } = ctx
  const keys = splitPath(path)
  const item = getAt(schema, keys)
  const meta = editorOf(item)
  const partsMeta = schema?.editor?.parts || []
  // A tab shows when the component has one of its parts; inside a group, only those `nested` (not Inside)
  const nested = (part) => part.nested ?? part.key !== 'scope'
  const parts = partsMeta.filter(part => sourcesOf(part).some(source => childKeys(item).includes(source)) && !(mount && !nested(part)))
  const [picked, setPicked] = useState(null)
  const [choice, setChoice] = useState(null)
  const [inner, setInner] = useState(null)
  const part = parts.some(item => item.key === picked) ? picked : parts[0]?.key
  const cards = (meta.groups || [])
    .filter(card => !mount || (card.paths || []).every(cardPath => cardPath.startsWith(`${joinPath(keys)}.`)))
    .filter(card => partOfCard(path, card, partsMeta) === part)
  const variants = getAt(schema, [...keys, 'variants'])
  const onlyStates = childKeys(variants).length > 0 && childKeys(variants).every(name => childKeys(variants[name]).every(key => key === 'states'))
  const tabLabel = (item) => {
    // The component's own label for the tab (`parts`), else the undeclared rules
    if (meta.parts?.[item.key]?.label) return formatText(t, meta.parts[item.key].label)
    if (item.key === 'variants' && onlyStates && item.label_states) return formatText(t, item.label_states)
    if (item.key === 'variants' && isNode(getAt(schema, [...keys, 'base', 'variant'])) && item.label_styles) return formatText(t, item.label_styles)
    return formatText(t, item.label, { fallback: item.key })
  }
  const partCtx = mount ? { ...ctx, mount } : ctx
  // What the component shows (Visibility's groups that name it) goes first in Base
  const showsIn = parts.some(item => item.key === 'base') ? 'base' : parts[0]?.key
  const shows = !mount && part === showsIn ? <ComponentShows key='shows' ctx={ctx} path={path} /> : null

  const content = () => {
    const partPath = [...keys, part]
    // What the component's cards show stays out of the plain rows
    const exclude = new Set(cards.flatMap(card => card.paths || []))
    if (part === 'scope') {
      const names = childKeys(getAt(schema, partPath)).filter(name => getAt(schema, ['components', name]))
      const name = names.includes(inner) ? inner : names[0]
      if (!name) return null
      return (
        <>
          <ChipRow role='radiogroup' aria-label={t('BUILDER_THEME_INSIDE_COMPONENT', 'Component')}>
            {names.map(item => (
              <button key={item} type='button' role='radio' aria-checked={item === name ? 'true' : 'false'} onClick={() => setInner(item)}>
                {formatText(t, labelOf(schema, ['components', item]), { fallback: item })}
                {touchesPath(ctx, [...partPath, item]) && <Changed t={t} />}
              </button>
            ))}
          </ChipRow>
          <ComponentParts
            key={name}
            ctx={ctx}
            path={`components.${name}`}
            mount={{ from: ['components', name], to: [...partPath, name], label: formatText(t, labelOf(schema, ['components', name]), { fallback: name }) }}
          />
        </>
      )
    }
    // The part's cards go before or after its rows (`placement`)
    const before = cards.filter(card => placementOf(path, card, part) === 'before').map(card => <GroupCard key={card.key} ctx={partCtx} group={card} />)
    const after = cards.filter(card => placementOf(path, card, part) === 'after').map(card => <GroupCard key={card.key} ctx={partCtx} group={card} />)
    const partMeta = parts.find(item => item.key === part) || { key: part }
    const sources = sourcesOf(partMeta)
    const partNode = getAt(schema, partPath)
    // Whole (`choices: false`, or a part with cards of its own), or a chip per option and the chosen one
    const whole = !(partMeta.choices ?? !WHOLE_PARTS.includes(part)) || (sources.length === 1 && (editorOf(partNode).groups || []).length > 0)
    if (whole) return <>{shows}{before}<SchemaGroup ctx={partCtx} path={partPath} exclude={exclude} />{after}</>
    const choices = sources.flatMap(source => childKeys(getAt(schema, [...keys, source])).map(name => joinPath([...keys, source, name])))
      .filter(choicePath => !isHidden(getAt(schema, choicePath)) && !exclude.has(choicePath))
    const chosen = choices.includes(choice) ? choice : choices[0]
    return (
      <>
        {shows}
        {before}
        {choices.length > 1 && (
          <ChipRow role='radiogroup' aria-label={tabLabel(parts.find(item => item.key === part))}>
            {choices.map(choicePath => (
              <button key={choicePath} type='button' role='radio' aria-checked={choicePath === chosen ? 'true' : 'false'} onClick={() => setChoice(choicePath)}>
                {formatText(t, labelOf(schema, choicePath), { fallback: splitPath(choicePath).pop() })}
              </button>
            ))}
          </ChipRow>
        )}
        {chosen && <SchemaGroup ctx={partCtx} path={chosen} exclude={exclude} />}
        {after}
      </>
    )
  }

  return (
    <>
      {parts.length > 1 && (
        <TabList role='tablist' aria-label={t('BUILDER_THEME_COMPONENT_PARTS', '_name_ parts').replace('_name_', formatText(t, meta.label, { fallback: keys[keys.length - 1] }))}>
          {parts.map(item => (
            <TabButton key={item.key} type='button' role='tab' aria-selected={item.key === part ? 'true' : 'false'} selected={item.key === part} onClick={() => { setPicked(item.key); setChoice(null) }}>
              {tabLabel(item)}
            </TabButton>
          ))}
        </TabList>
      )}
      {part && content()}
    </>
  )
}

const platformsOf = (schema) => (Array.isArray(schema?.platforms) ? schema.platforms : [])

/** Values under `root` as a platform has them: saved in `platforms.<p>.<root>`, starting as on all screens. */
const onPlatform = (ctx, platform, root) => (platform === 'base' ? ctx : { ...ctx, platform, mount: { from: root, to: ['platforms', platform, ...root], label: null } })

/** Whether a platform sets anything under these paths (a page's, a group's). */
const touchesOn = (ctx, platform, paths) => paths.some(path => touchesPath(onPlatform(ctx, platform, splitPath(path).slice(0, 1)), path))

/** All screens and a tab per platform, each marked when the theme changes it. */
const ScreenTabs = ({ ctx, label, platform, onChange, touched }) => {
  const { t, schema } = ctx
  const labels = schema?.editor?.labels?.platforms || {}
  return (
    <TabList role='tablist' aria-label={label}>
      {['base', ...platformsOf(schema)].map(value => (
        <TabButton key={value} type='button' role='tab' aria-selected={value === platform ? 'true' : 'false'} selected={value === platform} onClick={() => onChange(value)}>
          {value === 'base' ? t('BUILDER_THEME_ALL_SCREENS', 'All screens') : formatText(t, labels[value], { fallback: value })}
          {value !== 'base' && touched(value) && <> <Changed t={t} /></>}
        </TabButton>
      ))}
    </TabList>
  )
}

/**
 * A page: its values on all screens, and on each platform (saved in
 * `platforms.<p>.pages.<page>`), with the groups of other sections it shows
 * (their `pages`), as the Visibility of what is only on it.
 */
const PageScreens = ({ ctx, path }) => {
  const { t, schema } = ctx
  const keys = splitPath(path)
  const platforms = platformsOf(schema)
  const [screen, setScreen] = useState('base')
  const platform = platforms.includes(screen) ? screen : 'base'
  // One group is what the page shows, not a name the page already has ("Home" in Home)
  const own = pageGroupsOf(schema, keys[1])
  const groups = own.length === 1 ? [{ ...own[0], label: { key: 'BUILDER_THEME_PAGE_VISIBILITY', default: 'What this page shows' } }] : own
  const groupPaths = groups.flatMap(group => group.paths || [])
  return (
    <>
      {platforms.length > 0 && (
        <ScreenTabs
          ctx={ctx}
          label={t('BUILDER_THEME_PAGE_SCREENS', 'Screens of _name_').replace('_name_', formatText(t, labelOf(schema, keys), { fallback: keys[1] }))}
          platform={platform}
          onChange={setScreen}
          touched={(value) => touchesPath(onPlatform(ctx, value, keys), keys) || touchesOn(ctx, value, groupPaths)}
        />
      )}
      <SchemaGroup key={platform} ctx={onPlatform(ctx, platform, keys)} path={path} />
      {groups.map(group => <GroupCard key={group.key} ctx={onPlatform(ctx, platform, splitPath(group.paths?.[0] || '').slice(0, 1))} group={group} />)}
    </>
  )
}

/** The roots whose values a platform can have of its own in a section of cards (`platforms.<p>.visibility`). */
const PLATFORM_ROOTS = ['visibility']

const platformHelp = (t) => <p style={{ margin: 0, color: '#5E6B7D' }}>{t('BUILDER_THEME_PLATFORM_VISIBILITY_HELP', 'What phones show. Until you change one here, it shows as on all screens, or as the website has it on phones.')}</p>

/**
 * What a component shows: the groups of other sections that name it
 * (`components`), in their order, on all screens and on each platform. A key
 * a card of the component switches in its header (`toggle`) stays there.
 */
const ComponentShows = ({ ctx, path }) => {
  const { t, schema } = ctx
  const keys = splitPath(path)
  const platforms = platformsOf(schema)
  const [screen, setScreen] = useState('base')
  const platform = platforms.includes(screen) ? screen : 'base'
  const toggled = new Set((editorOf(getAt(schema, keys)).groups || []).map(card => card.toggle?.path).filter(Boolean))
  const own = componentGroupsOf(schema, keys[1])
    .map(group => ({ ...group, paths: (group.paths || []).filter(item => !toggled.has(item)) }))
    .filter(group => group.paths.length)
  if (!own.length) return null
  // One group is what the component shows, not a name it already has ("Header" in Header)
  const groups = own.length === 1 ? [{ ...own[0], label: { key: 'BUILDER_THEME_COMPONENT_VISIBILITY', default: 'What it shows' } }] : own
  const paths = groups.flatMap(group => group.paths)
  return (
    <>
      {platforms.length > 0 && (
        <ScreenTabs
          ctx={ctx}
          label={t('BUILDER_THEME_COMPONENT_SCREENS', 'Screens of what _name_ shows').replace('_name_', formatText(t, labelOf(schema, keys), { fallback: keys[1] }))}
          platform={platform}
          onChange={setScreen}
          touched={(value) => touchesOn(ctx, value, paths)}
        />
      )}
      {platform !== 'base' && platformHelp(t)}
      {groups.map(group => <GroupCard key={group.key} ctx={onPlatform(ctx, platform, splitPath(group.paths[0]).slice(0, 1))} group={group} />)}
    </>
  )
}

/**
 * A section of cards. Its groups shown in pages (`pages`) are there instead.
 * When all it has is under a root a platform can change, it has a tab per
 * platform, as pages do.
 */
const CardsSection = ({ ctx, section }) => {
  const { t, schema } = ctx
  const [screen, setScreen] = useState('base')
  const groups = (section.groups || []).filter(group => !isPlacedElsewhere(schema, group))
  const paths = groups.flatMap(group => group.paths || [])
  const roots = [...new Set(paths.map(path => splitPath(path)[0]))]
  const screened = platformsOf(schema).length > 0 && roots.length === 1 && PLATFORM_ROOTS.includes(roots[0])
  const platform = screened && platformsOf(schema).includes(screen) ? screen : 'base'
  const screenCtx = onPlatform(ctx, platform, roots)
  return (
    <>
      {screened && (
        <ScreenTabs
          ctx={ctx}
          label={t('BUILDER_THEME_PAGE_SCREENS', 'Screens of _name_').replace('_name_', formatText(t, section.label, { fallback: section.key }))}
          platform={platform}
          onChange={setScreen}
          touched={(value) => touchesOn(ctx, value, paths)}
        />
      )}
      {platform !== 'base' && platformHelp(t)}
      {groups.map(group => <GroupCard key={group.key} ctx={screenCtx} group={group} />)}
    </>
  )
}

/**
 * An entry of a nav (a section, a component or a page). With `href` it is a
 * link, so it opens in a new tab (Cmd or Ctrl) and its address can be copied;
 * a plain click opens it here, without loading the page again.
 */
const NavEntry = ({ href, onSelect, children, ...props }) => {
  if (!href) return <button type='button' onClick={onSelect} {...props}>{children}</button>
  const follow = (e) => {
    // A new tab or window (Cmd, Ctrl, Shift, Alt, another button) is the browser's
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onSelect()
  }
  return <a href={href} onClick={follow} {...props}>{children}</a>
}

/** The groups a list section shows (not `hidden`), with the components or pages the schema has and shows. */
const listGroups = (schema, section) => (section.groups || []).filter(group => !group.hidden).map(group => ({
  ...group,
  paths: (group.paths || []).filter(path => getAt(schema, path) !== undefined && !isHidden(getAt(schema, path)))
}))

/** Whether the theme changes a component or a page, with the groups of other sections it shows, on any screen. */
const touchesItem = (ctx, path) => {
  const keys = splitPath(path)
  if (touchesPath(ctx, keys)) return true
  const shown = keys[0] === 'pages' ? pageGroupsOf(ctx.schema, keys[1]) : keys[0] === 'components' ? componentGroupsOf(ctx.schema, keys[1]) : []
  const paths = shown.flatMap(group => group.paths || [])
  return ['base', ...platformsOf(ctx.schema)].some(platform => touchesOn(ctx, platform, paths))
}

/** Below this width the chosen one's rows stack (styled-components v5 has no container queries). */
const DETAIL_NARROW = 560

/** A section whose groups hold components or pages: a list to search, and the chosen one. `itemHref`: each one's link. */
const ListSection = ({ ctx, section, selected, onSelect, itemHref }) => {
  const { t, schema } = ctx
  const [query, setQuery] = useState('')
  const search = normalizeSearch(query)
  const detail = useRef(null)
  // Narrow, rows put their name above their controls
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const measure = () => {
      const width = detail.current?.getBoundingClientRect().width
      if (width) setNarrow(width < DETAIL_NARROW)
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (detail.current) observer?.observe(detail.current)
    return () => observer?.disconnect()
  }, [])
  const nameOf = (path) => formatText(t, labelOf(schema, path), { fallback: splitPath(path).pop() })
  const groups = listGroups(schema, section)
  const shown = search
    ? groups.map(group => ({ ...group, paths: group.paths.filter(path => normalizeSearch(`${nameOf(path)} ${path}`).includes(search)) })).filter(group => group.paths.length)
    : groups
  const all = groups.flatMap(group => group.paths)
  const current = all.includes(selected) ? selected : all[0]
  const meta = editorOf(getAt(schema, current))
  const isPage = splitPath(current || '')[0] === 'pages'
  const listLabel = formatText(t, section.label, { fallback: section.key })
  return (
    <ComponentLayout>
      <ComponentList aria-label={listLabel}>
        <label>
          <Search aria-hidden='true' />
          <input type='search' value={query} placeholder={t('SEARCH', 'Search')} aria-label={`${t('SEARCH', 'Search')}: ${listLabel}`} autoComplete='off' onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }} />
        </label>
        <div>
          {shown.length === 0 && <p role='status'>{t('BUILDER_THEME_NO_MATCH', 'Nothing matches “_query_”.').replace('_query_', query.trim())}</p>}
          {shown.map(group => (
            <React.Fragment key={group.key}>
              {group.label && <h4>{formatText(t, group.label)}</h4>}
              {group.paths.map(path => (
                <NavEntry key={path} href={itemHref?.(path)} aria-current={path === current ? 'true' : undefined} onSelect={() => { detail.current?.scrollTo?.(0, 0); onSelect(path) }}>
                  {nameOf(path)}
                  {touchesItem(ctx, path) && <Changed t={t} />}
                </NavEntry>
              ))}
            </React.Fragment>
          ))}
        </div>
      </ComponentList>
      <ComponentDetail ref={detail} data-narrow={narrow ? 'true' : undefined}>
        {current && (
          <>
            <header>
              <div>
                <h3>{nameOf(current)}</h3>
                {meta.info && <p>{formatText(t, meta.info)}</p>}
              </div>
            </header>
            <EditorErrorBoundary t={t} resetKey={current}>
              {isPage
                ? <PageScreens key={current} ctx={ctx} path={current} />
                : <ComponentParts key={current} ctx={ctx} path={current} />}
            </EditorErrorBoundary>
          </>
        )}
      </ComponentDetail>
    </ComponentLayout>
  )
}

/**
 * The section that shows a path, and the component or page it is in: a
 * platform's value (`platforms.<p>.components.<c>…`) is its component's, a
 * value of a group a page or a component shows (`pages`, `components`) is
 * that one's, and a card's switch (`toggle`) is where that card is.
 */
export const locatePath = (schema, sections, path) => {
  const keys = splitPath(path)
  const target = keys[0] === 'platforms' && ['components', 'pages', ...PLATFORM_ROOTS].includes(keys[2]) ? joinPath(keys.slice(2)) : joinPath(keys)
  for (const section of sections) {
    for (const group of section.groups || []) {
      const hit = [...(group.paths || []), ...(group.toggle?.path ? [group.toggle.path] : [])].find(item => target === item || target.startsWith(`${item}.`))
      if (!hit) continue
      // A group a page or a component shows is in that one
      const [page] = pagesOfGroup(schema, group)
      const [component] = componentsOfGroup(schema, group)
      const placed = page ? `pages.${page}` : component ? `components.${component}` : null
      const inPlace = placed && locatePath(schema, sections, placed)
      if (inPlace) return inPlace
      return { section: section.key, item: isListSection(schema, section) ? hit : null }
    }
  }
  return null
}

/**
 * Whether the theme editor shows a path of the theme (a value the API names
 * in `errors` or `invalid`): a section's group has it, and neither it nor a
 * group above it is hidden. A path inside a value (a text style's `size`) is
 * its node's.
 */
export const showsPath = (schema, path) => {
  const sections = (schema?.editor?.sections || []).filter(item => !isSiteSection(item))
  if (!locatePath(schema, sections, path)) return false
  const keys = splitPath(path)
  const target = keys[0] === 'platforms' && ['components', 'pages', ...PLATFORM_ROOTS].includes(keys[2]) ? splitPath(joinPath(keys.slice(2))) : keys
  for (let length = 1; length <= target.length; length++) {
    const item = getAt(schema, target.slice(0, length))
    if (item === undefined || isHidden(item)) return false
    if (isNode(item)) return true
  }
  return true
}

/**
 * Where the editor opens (`start`: a section, and in a list section its
 * component or page): an unknown section is the item's, and with neither the
 * first section and item open.
 */
const startOf = (schema, sections, start) => {
  const found = start?.item ? locatePath(schema, sections, start.item) : null
  const section = sections.some(item => item.key === start?.section) ? start.section : found?.section || null
  return { section, items: found?.item && found.section === section ? { [section]: found.item } : {} }
}

/**
 * The editor of a theme from its schema in nodes: a nav of the `editor`
 * block's sections (by their parent), and the chosen one. `resolved`,
 * `sources` and `aliases` are what `resolve` serves (the theme's tree, and by
 * path where each value comes from and the alias it is); without them values
 * follow the theme and the schema's defaults. `format` has what the schema
 * doesn't: the fonts' families. The website's settings (`site`) aren't the
 * theme's: their sections are left out (SiteSettingsEditor edits them). `focus`
 * (a path) opens the section that shows it; `onLocationChange` tells the
 * section, the component or page open, and whether the section is a list.
 * `start` (`{ section, item }`) is where it opens, and `linkTo` gives the
 * address of each one, so the nav's entries are links.
 */
export const ThemeSchemaEditor = (props) => {
  const { schema, format, current, edits, fieldErrors, invalid, setValue, resolved, sources, aliases, uploadImage, editorAction, focus, onLocationChange, start, linkTo } = props
  const [, t] = useLanguage()
  const sections = (schema?.editor?.sections || []).filter(item => !isSiteSection(item))
  const parents = schema?.editor?.section_groups || []
  const [own, setOwn] = useState(() => startOf(schema, sections, start).section)
  const [items, setItems] = useState(() => startOf(schema, sections, start).items)
  const sectionKey = sections.some(item => item.key === own) ? own : sections[0]?.key
  const section = sections.find(item => item.key === sectionKey)
  const ctx = { schema, format, current, edits, fieldErrors: fieldErrors || {}, storedErrors: storedErrorsOf(invalid, edits), setValue, resolved, sources, aliases, uploadImage, editorAction, t }
  const navGroups = parents.length
    ? parents.map(parent => ({ ...parent, sections: sections.filter(item => item.parent === parent.key) })).concat([{ key: null, sections: sections.filter(item => !parents.some(parent => parent.key === item.parent)) }])
    : [{ key: null, sections }]

  // A path to show (the first value the API refused): its section, and its component or page
  useEffect(() => {
    const found = focus && locatePath(schema, sections, focus)
    if (!found) return
    setOwn(found.section)
    if (found.item) setItems(prev => ({ ...prev, [found.section]: found.item }))
  }, [focus])

  const list = section && isListSection(schema, section)
  // The one chosen while the list has it, else its first
  const listed = list ? listGroups(schema, section).flatMap(group => group.paths) : []
  const item = list ? (listed.includes(items[sectionKey]) ? items[sectionKey] : listed[0] || null) : null
  useEffect(() => { onLocationChange && sectionKey && onLocationChange({ section: sectionKey, item, list: !!list }) }, [sectionKey, item])

  if (!section) return null
  return (
    <EditorBody $fill={!!list}>
      <SectionNav aria-label={t('BUILDER_THEME_SECTIONS', 'Theme sections')}>
        {navGroups.filter(group => group.sections.length).map(group => (
          <React.Fragment key={group.key || 'other'}>
            {group.label && <h3>{formatText(t, group.label)}</h3>}
            {group.sections.map(item => (
              <NavEntry key={item.key} href={linkTo?.({ section: item.key })} aria-current={item.key === sectionKey ? 'true' : undefined} onSelect={() => setOwn(item.key)}>
                {formatText(t, item.label, { fallback: item.key })}
              </NavEntry>
            ))}
          </React.Fragment>
        ))}
      </SectionNav>
      <EditorMain $fill={!!list}>
        <div>
          <h2>{formatText(t, section.label, { fallback: section.key })}</h2>
          {section.info && <p>{formatText(t, section.info)}</p>}
        </div>
        <EditorErrorBoundary t={t} resetKey={section.key}>
          {list
            ? <ListSection key={section.key} ctx={ctx} section={section} selected={item} onSelect={(path) => setItems(prev => ({ ...prev, [section.key]: path }))} itemHref={linkTo && ((path) => linkTo({ section: section.key, item: path }))} />
            : <CardsSection key={section.key} ctx={ctx} section={section} />}
        </EditorErrorBoundary>
      </EditorMain>
    </EditorBody>
  )
}
