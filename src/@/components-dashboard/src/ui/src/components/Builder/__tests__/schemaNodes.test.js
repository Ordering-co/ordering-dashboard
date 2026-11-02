import { describe, expect, it } from 'vitest'

import SCHEMA from './themeNodesFixture.json'
import { controlOf, formatText, getAt, isHidden, isNode, labelOf, levelsOf, meets, moveSection, nodesUnder, optionsOf, orderedChildren, parseAlias, parseRole, readTheme, resolvedAt, resolveSections, resolveValue, splitPath, storedErrorsOf, themePathOf, typeOf } from '../ThemeSchemaEditor/schemaNodes'

const t = (_key, fallback) => fallback
const ctx = (extra = {}) => ({ schema: SCHEMA, current: {}, edits: {}, ...extra })

describe('schema nodes', () => {
  it('keeps of what the theme saved and this version drops what no change sets', () => {
    const invalid = [
      { path: 'tokens.color.overlay', code: 'tokens.color.overlay.alpha' },
      { path: 'tokens.typography.h1', code: 'tokens.typography.h1.invalid' },
      { path: 'visibility.header.cart', code: 'visibility.header.cart.unknown' },
      { path: 'pages.home.footer', code: 'pages.home.footer.invalid' }
    ]
    const edits = { tokens: { typography: { h1: { size: 30, line: 1.2, weight: 600 } } }, visibility: { 'header.cart': true }, pages: { home: null } }
    expect(storedErrorsOf(invalid, edits)).toEqual({ 'tokens.color.overlay': 'tokens.color.overlay.alpha' })
    expect(storedErrorsOf(undefined, edits)).toEqual({})
  })

  it('reads visibility and images keys with their dots', () => {
    expect(splitPath('visibility.header.cart')).toEqual(['visibility', 'header.cart'])
    expect(splitPath('images.empty.not_found')).toEqual(['images', 'empty.not_found'])
    expect(splitPath('components.button.base.radius')).toEqual(['components', 'button', 'base', 'radius'])
    expect(isNode(getAt(SCHEMA, 'visibility.header.cart'))).toBe(true)
  })

  it('tells a role (`{ink}`) from a theme alias (`{color.primary}`)', () => {
    expect(parseRole('{ink}')).toBe('ink')
    expect(parseRole('{color.primary}')).toBeNull()
    expect(parseRole('#FF0000')).toBeNull()
    expect(parseAlias('{ink}')).toBeNull()
  })

  it('takes the type of the nearest group that declares one', () => {
    expect(typeOf(SCHEMA, 'tokens.color.primary')).toBe('color')
    expect(typeOf(SCHEMA, 'visibility.footer')).toBe('boolean')
    expect(typeOf(SCHEMA, 'components.button.base.radius')).toBe('dimension')
  })

  it('labels a node with its own label, else the label of its prop name', () => {
    expect(labelOf(SCHEMA, 'tokens.color.primary')).toEqual({ key: 'BUILDER_THEME_COLOR_PRIMARY', default: 'Primary' })
    expect(labelOf(SCHEMA, 'components.button.base.radius')).toEqual({ key: 'BUILDER_THEME_PROP_RADIUS', default: 'Rounding' })
  })

  it('formats a text with its params, and a list param by choice', () => {
    expect(formatText(t, labelOf(SCHEMA, 'tokens.color.on_primary'))).toBe('Text on Primary')
    const inherit = getAt(SCHEMA, 'pages.home.footer').$extensions['co.ordering.editor'].options[0]
    expect(formatText(t, inherit.label_platform, { choose: { _state_: 1 } })).toBe('As on all screens (hidden)')
    expect(formatText(t, null, { fallback: 'mobile_full_width' })).toBe('Mobile full width')
  })

  it('names the control from the editor, else from the type', () => {
    expect(controlOf(SCHEMA, 'tokens.color.primary')).toBe('color')
    expect(controlOf(SCHEMA, 'components.button.base.radius')).toBe('level')
    expect(controlOf(SCHEMA, 'tokens.typography.h1')).toBe('typography')
    expect(controlOf(SCHEMA, 'pages.home.sections')).toBe('sortable_sections')
    expect(controlOf(SCHEMA, 'components.auth_form.slots.submit')).toBe('cards')
  })

  it('lists a scale’s levels and the ones a node allows', () => {
    const radius = levelsOf(SCHEMA, 'radius')
    expect(radius.map(level => level.value)).toContain('{radius.md}')
    expect(radius.find(level => level.name === 'md').label).toEqual({ key: 'BUILDER_THEME_RADIUS_MD', default: 'Medium' })
    expect(optionsOf(SCHEMA, 'components.button.base.radius').map(option => option.value)).toEqual(radius.map(level => level.value))
    // A level the engine narrows keeps only those
    const narrowed = { ...SCHEMA, components: { x: { base: { radius: { $type: 'dimension', $value: '{radius.md}', $extensions: { 'co.ordering': { scale: 'radius', options: ['sm', 'md'] } } } } } } }
    expect(optionsOf(narrowed, 'components.x.base.radius').map(option => option.value)).toEqual(['{radius.sm}', '{radius.md}'])
  })

  it('keeps a component’s platform values where the theme has them', () => {
    expect(themePathOf('components.button.platforms.mobile_web.radius')).toEqual(['platforms', 'mobile_web', 'components', 'button', 'base', 'radius'])
    expect(themePathOf('visibility.header.cart')).toEqual(['visibility', 'header.cart'])
  })

  it('reads a change, then the theme, then the default; a null change takes the default back', () => {
    const keys = ['tokens', 'color', 'primary']
    expect(readTheme(ctx(), keys, '#2C7BE5')).toEqual({ value: '#2C7BE5', own: false, edited: false })
    expect(readTheme(ctx({ current: { tokens: { color: { primary: '#FF5500' } } } }), keys, '#2C7BE5').value).toBe('#FF5500')
    expect(readTheme(ctx({ current: { tokens: { color: { primary: '#FF5500' } } }, edits: { tokens: { color: { primary: null } } } }), keys, '#2C7BE5')).toEqual({ value: '#2C7BE5', own: false, edited: true })
  })

  it('follows aliases with the changes not saved, and what resolve served', () => {
    expect(resolveValue(ctx(), '{space.none}')).toBe(0)
    expect(resolveValue(ctx({ edits: { tokens: { space: { xs: 6 } } } }), '{space.xs}')).toBe(6)
    expect(resolveValue(ctx({ resolved: { tokens: { space: { xs: 5 } } } }), '{space.xs}')).toBe(5)
    // A change newer than what resolve served wins
    expect(resolveValue(ctx({ resolved: { tokens: { space: { xs: 5 } } }, edits: { tokens: { space: { xs: 6 } } } }), '{space.xs}')).toBe(6)
    expect(resolvedAt(ctx({ resolved: { visibility: { 'header.cart': false } } }), 'visibility.header.cart')).toBe(false)
  })

  it('evaluates conditions on resolved values', () => {
    const gapIsZero = { path: 'components.tabs.variants.pill.gap', op: 'eq', value: 0 }
    expect(resolvedAt(ctx(), 'components.tabs.variants.pill.gap')).toBe(getAt(SCHEMA, 'tokens.space.xxs').$value)
    expect(meets(ctx(), gapIsZero)).toBe(false)
    expect(meets(ctx({ edits: { components: { tabs: { variants: { pill: { gap: '{space.none}' } } } } } }), gapIsZero)).toBe(true)
    expect(meets(ctx(), { path: 'visibility.footer', op: 'truthy' })).toBe(true)
    expect(meets(ctx(), { path: 'tokens.layout.mode', op: 'in', value: ['original', 'appointments'] })).toBe(true)
    expect(meets(ctx(), undefined)).toBe(true)
  })

  it('orders children by the editor’s order and leaves the hidden ones out', () => {
    expect(orderedChildren(SCHEMA, 'components.button.colors.primary')).toEqual(['main', 'on'])
    expect(nodesUnder(SCHEMA, 'components.button.colors.primary')).toEqual(['components.button.colors.primary.main', 'components.button.colors.primary.on'])
  })

  it('moves a section within its group only', () => {
    const defaults = getAt(SCHEMA, 'pages.home.sections').$value
    const sections = resolveSections(defaults, null)
    const main = sections.filter(section => section.group === 'main').map(section => section.key)
    const moved = moveSection(sections, main[1], main[0])
    expect(moved.filter(section => section.group === 'main').map(section => section.key)).toEqual([main[1], main[0], ...main.slice(2)])
    expect(moveSection(sections, 'hero', main[0])).toBe(sections)
  })

  it('leaves out a node the schema hides or deprecates (DTCG $deprecated, true or why)', () => {
    expect(isHidden({ $value: 1 })).toBe(false)
    expect(isHidden({ $value: 1, $extensions: { 'co.ordering.editor': { hidden: true } } })).toBe(true)
    expect(isHidden({ $value: 1, $deprecated: true })).toBe(true)
    expect(isHidden({ $value: 1, $deprecated: 'Categories come from the store now' })).toBe(true)
    expect(isHidden({ $value: 1, $deprecated: false })).toBe(false)
    const schema = { images: { $type: 'image', logo: { $value: null }, 'categories.food': { $value: null, $deprecated: true } } }
    expect(orderedChildren(schema, 'images')).toEqual(['logo'])
  })
})
