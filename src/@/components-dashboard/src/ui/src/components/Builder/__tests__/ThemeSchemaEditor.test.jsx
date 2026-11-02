import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  HtmlEditor: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />)
  }
})

import { CONTROLS, SiteSettingsEditor, ThemeSchemaEditor, locatePath, showsPath } from '../ThemeSchemaEditor'
import { getResetSections } from '../BuilderWebTheme/ThemeEditor'
import { orderBounds, shownValue } from '../ThemeSchemaEditor/SchemaGroup'
import { imageHints } from '../ThemeSchemaEditor/controls'

const renderEditor = (extra = {}) => {
  const setValue = vi.fn()
  const props = { schema: SCHEMA, current: {}, edits: {}, fieldErrors: {}, setValue, ...extra }
  const view = renderWithProviders(<ThemeSchemaEditor {...props} />)
  const rerender = (next) => view.rerender(<ThemeSchemaEditor {...props} {...next} />)
  return { setValue, rerender }
}

const openSection = (name) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Theme sections' })).getByRole('button', { name }))
const rowOf = (path) => document.querySelector(`[data-path="${path}"]`)

describe('ThemeSchemaEditor', () => {
  it('lists the sections of the editor block by their parent', () => {
    renderEditor()
    const nav = screen.getByRole('navigation', { name: 'Theme sections' })
    expect(within(nav).getByText('Identity')).toBeInTheDocument()
    ;['Colors', 'Typography', 'Components', 'Pages', 'Visibility', 'Images'].forEach(name => {
      expect(within(nav).getByRole('button', { name })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Colors' })).toBeInTheDocument()
  })

  it('shows a color with the text on it in one row, with their contrast', () => {
    renderEditor()
    const row = rowOf('tokens.color.primary')
    expect(within(row).getByLabelText('Primary')).toBeInTheDocument()
    expect(within(row).getByLabelText('Text on Primary')).toBeInTheDocument()
    expect(within(row).getByText(/:1 · /)).toBeInTheDocument()
    expect(rowOf('tokens.color.on_primary')).toBeNull()
  })

  it('saves a token color where the theme keeps it, and resets it', () => {
    const { setValue, rerender } = renderEditor()
    fireEvent.change(within(rowOf('tokens.color.primary')).getByLabelText('Primary'), { target: { value: '#ff0000' } })
    expect(setValue).toHaveBeenCalledWith(['tokens', 'color', 'primary'], '#FF0000')
    rerender({ edits: { tokens: { color: { primary: '#FF0000' } } } })
    fireEvent.click(within(rowOf('tokens.color.primary')).getByRole('button', { name: 'Restore Primary to its default' }))
    expect(setValue).toHaveBeenCalledWith(['tokens', 'color', 'primary'], null)
  })

  it('switches a visibility key with dots in it', () => {
    const { setValue } = renderEditor()
    openSection('Visibility')
    expect(rowOf('visibility.header.cart')).toBeNull()
    // The chevron is hidden: the card's toggle keeps its name, and says whether it is open
    const header = screen.getByRole('button', { name: 'Header' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(header.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(within(rowOf('visibility.header.cart')).getByRole('switch', { name: 'Cart button' }))
    expect(setValue).toHaveBeenCalledWith(['visibility', 'header.cart'], false)
  })

  it('shows what is only on a page in that page, under its sections, not in Visibility', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Visibility')
    expect(screen.queryByRole('button', { name: 'Home' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Checkout' })).toBeNull()
    openSection('Pages')
    const shows = screen.getByRole('button', { name: 'What this page shows' })
    expect(rowOf('pages.home.sections').compareDocumentPosition(shows) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(shows)
    fireEvent.click(within(rowOf('visibility.home.hero.title')).getByRole('switch'))
    expect(setValue).toHaveBeenCalledWith(['visibility', 'home.hero.title'], false)
    // The page is marked changed in the list for what its groups change
    const list = screen.getByRole('navigation', { name: 'Pages' })
    expect(within(list).queryByText('Changed')).toBeNull()
    rerender({ edits: { visibility: { 'home.hero.title': false } } })
    expect(within(list).getByText('Changed')).toBeInTheDocument()
  })

  it('switches what phones show, starting as the website has it on phones', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Pages')
    fireEvent.click(screen.getByRole('button', { name: 'What this page shows' }))
    // Hidden on all screens, shown on phones by default
    expect(within(rowOf('visibility.home.hero.logo')).getByRole('switch')).not.toBeChecked()
    fireEvent.click(screen.getByRole('tab', { name: 'On phones' }))
    const logo = within(rowOf('visibility.home.hero.logo')).getByRole('switch')
    expect(logo).toBeChecked()
    fireEvent.click(logo)
    expect(setValue).toHaveBeenCalledWith(['platforms', 'mobile_web', 'visibility', 'home.hero.logo'], false)
    rerender({ edits: { platforms: { mobile_web: { visibility: { 'home.hero.logo': false } } } } })
    expect(within(screen.getByRole('tab', { name: /On phones/ })).getByText('Changed')).toBeInTheDocument()
    fireEvent.click(within(rowOf('visibility.home.hero.logo')).getByRole('button', { name: 'Restore Banner logo to its default' }))
    expect(setValue).toHaveBeenLastCalledWith(['platforms', 'mobile_web', 'visibility', 'home.hero.logo'], null)

    // In Visibility, a key without a value for phones follows all screens
    openSection('Visibility')
    fireEvent.click(screen.getByRole('tab', { name: 'On phones' }))
    fireEvent.click(screen.getByRole('button', { name: 'Header' }))
    const cart = within(rowOf('visibility.header.cart')).getByRole('switch', { name: 'Cart button' })
    expect(cart).toBeChecked()
    fireEvent.click(cart)
    expect(setValue).toHaveBeenLastCalledWith(['platforms', 'mobile_web', 'visibility', 'header.cart'], false)
  })

  it('opens the page that shows a value a page’s group has, on any screen', () => {
    const sections = SCHEMA.editor.sections
    expect(locatePath(SCHEMA, sections, 'visibility.home.hero.logo')).toEqual({ section: 'pages', item: 'pages.home' })
    expect(locatePath(SCHEMA, sections, 'platforms.mobile_web.visibility.home.hero.logo')).toEqual({ section: 'pages', item: 'pages.home' })
    expect(locatePath(SCHEMA, sections, 'platforms.mobile_web.visibility.header.cart')).toEqual({ section: 'visibility', item: null })
  })

  it('resets a page with the groups it shows, on all screens and on phones', () => {
    const reset = getResetSections(SCHEMA, { section: 'pages', item: 'pages.home' })
    expect(reset).toEqual([
      'pages.home',
      'platforms.mobile_web.pages.home',
      'visibility.home.hero.logo',
      'visibility.home.hero.title',
      'platforms.mobile_web.visibility.home.hero.logo',
      'platforms.mobile_web.visibility.home.hero.title'
    ])
    expect(getResetSections(SCHEMA, { section: 'pages', item: 'pages.not_found' })).toEqual(['pages.not_found', 'platforms.mobile_web.pages.not_found'])
  })

  it('resets in Visibility only what it shows, on all screens and on phones', () => {
    const reset = getResetSections(SCHEMA, { section: 'visibility' })
    expect(reset).toContain('visibility.header.cart')
    expect(reset).toContain('platforms.mobile_web.visibility.header.cart')
    expect(reset).not.toContain('visibility')
    // A group whose pages the schema doesn't have (confirmation) stays
    expect(reset).toContain('visibility.confirmation.order.eta')
    expect(reset.filter(path => /visibility\.(home|checkout)\./.test(path))).toEqual([])
    expect(reset.filter(path => path.startsWith('platforms.')).length).toBe(reset.length / 2)
  })

  it('shows a component’s parts as tabs and its cards where their values are', () => {
    renderEditor()
    openSection('Components')
    const tabs = screen.getByRole('tablist', { name: 'Button parts' })
    expect(within(tabs).getByRole('tab', { name: 'Base' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Colors and styles' }))
    expect(screen.getByRole('heading', { name: 'Button colors' })).toBeInTheDocument()
    const primary = rowOf('components.button.colors.primary')
    expect(within(primary).getByRole('button', { name: /Primary: Fill/ })).toBeInTheDocument()
    expect(within(primary).getByRole('button', { name: /Primary: Text on fill/ })).toBeInTheDocument()
  })

  it('shows a value a component’s card holds only in that card, after the plain rows', () => {
    renderEditor()
    openSection('Components')
    expect(document.querySelectorAll('[data-path="components.button.base.animated"]')).toHaveLength(1)
    const motion = screen.getByRole('heading', { name: 'Motion' })
    expect(rowOf('components.button.base.radius').compareDocumentPosition(motion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('picks a level with its amount, or a custom number in the node’s range', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Components')
    const select = within(rowOf('components.button.base.icon_gap')).getByRole('combobox')
    expect(within(select).getByRole('option', { name: /Small · \d+/ })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'custom' } })
    expect(setValue).toHaveBeenCalledWith(['components', 'button', 'base', 'icon_gap'], expect.any(Number))
    rerender({ edits: { components: { button: { base: { icon_gap: 200 } } } } })
    expect(within(rowOf('components.button.base.icon_gap')).getByRole('spinbutton')).toHaveAttribute('max', '96')
  })

  it('says which props follow Identity, and takes a custom one back to it', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Components')
    expect(within(rowOf('components.button.base.radius')).getByText('From Identity')).toBeInTheDocument()
    expect(within(rowOf('components.button.base.icon_gap')).queryByText('From Identity')).toBeNull()
    rerender({ edits: { components: { button: { base: { radius: '{radius.lg}' } } } } })
    const row = rowOf('components.button.base.radius')
    expect(within(row).getByText('Custom')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Rounding: back to Identity' }))
    expect(setValue).toHaveBeenCalledWith(['components', 'button', 'base', 'radius'], null)
  })

  it('shows a token as what it resolves to, not as the alias naming itself', () => {
    const h1 = { size: 34, line: 1.24, weight: 700 }
    renderEditor({ resolved: { tokens: { typography: { h1 } } }, aliases: { 'tokens.typography.h1': '{typography.h1}' } })
    openSection('Typography')
    const row = rowOf('tokens.typography.h1')
    expect(within(row).getByRole('spinbutton', { name: 'Heading 1: Size' })).toHaveValue(34)
    expect(within(row).getByRole('spinbutton', { name: 'Heading 1: Line height' })).toHaveValue(1.24)
  })

  it('shows the value a component inherits as its level, until the theme sets its own', () => {
    const resolved = { tokens: { radius: { md: 10, xl: 20 } }, components: { business_card: { base: { radius: 20 } } } }
    const { rerender } = renderEditor({ resolved, sources: { 'components.business_card.base.radius': 'inherited' } })
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Store card' }))
    const select = within(rowOf('components.business_card.base.radius')).getByRole('combobox')
    expect(select.options[select.selectedIndex].text).toBe('High · 20')
    // The alias resolve names wins over guessing it from the amount
    rerender({ resolved: { ...resolved, tokens: { radius: { md: 10, lg: 20, xl: 20 } } }, aliases: { 'components.business_card.base.radius': '{radius.xl}' } })
    const named = within(rowOf('components.business_card.base.radius')).getByRole('combobox')
    expect(named.value).toBe(JSON.stringify('{radius.xl}'))
    rerender({ resolved, edits: { components: { business_card: { base: { radius: '{radius.sm}' } } } } })
    const own = within(rowOf('components.business_card.base.radius')).getByRole('combobox')
    expect(own.options[own.selectedIndex].text).toMatch(/^Slight/)
  })

  it('says where a value comes from, as resolve serves it, and names fonts by family', () => {
    renderEditor({ sources: { 'components.business_card.base.radius': 'inherited' }, format: { fonts: { montserrat: 'Montserrat', archivo: 'Archivo Narrow' } } })
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Store card' }))
    const row = rowOf('components.business_card.base.radius')
    expect(within(row).getByText('From Content container')).toBeInTheDocument()
    openSection('Typography')
    expect(within(rowOf('tokens.font.body')).getByRole('option', { name: 'Archivo Narrow' })).toBeInTheDocument()
  })

  it('shows a node only while its condition holds', () => {
    const { rerender } = renderEditor()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Styles' }))
    expect(rowOf('components.tabs.variants.pill.gap')).not.toBeNull()
    expect(rowOf('components.tabs.variants.pill.joined')).toBeNull()
    rerender({ edits: { components: { tabs: { variants: { pill: { gap: '{space.none}' } } } } } })
    expect(rowOf('components.tabs.variants.pill.joined')).not.toBeNull()
  })

  it('edits a component inside a group from the component, saved in the group', () => {
    const { setValue } = renderEditor()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Category tabs' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Inside' }))
    const tabs = screen.getByRole('tablist', { name: 'Tabs parts' })
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Base' }))
    const row = rowOf('components.tabs.base.text')
    expect(within(row).getByText('From Tabs')).toBeInTheDocument()
    fireEvent.change(within(row).getByRole('combobox'), { target: { value: JSON.stringify('{typography.h3}') } })
    expect(setValue).toHaveBeenCalledWith(['components', 'category_tabs', 'scope', 'tabs', 'base', 'text'], '{typography.h3}')
  })

  it('saves a page’s footer on a platform under the platform', () => {
    const { setValue } = renderEditor()
    openSection('Pages')
    expect(screen.getByRole('radio', { name: 'As on the whole website (shown)' })).toBeChecked()
    fireEvent.click(screen.getByRole('tab', { name: 'On phones' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Hide' }))
    expect(setValue).toHaveBeenCalledWith(['platforms', 'mobile_web', 'pages', 'home', 'footer'], false)
    expect(screen.getByRole('radio', { name: 'As on all screens (shown)' })).toBeInTheDocument()
  })

  it('orders a page’s sections on phones only after its switch copies them', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Pages')
    fireEvent.click(screen.getByRole('tab', { name: 'On phones' }))
    expect(screen.getByText('Phones show them as on all screens.')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^Move .* down$/ })).toHaveLength(0)
    fireEvent.click(screen.getByRole('switch', { name: 'Order and hide them differently on phones' }))
    expect(setValue).toHaveBeenCalledWith(['platforms', 'mobile_web', 'pages', 'home', 'sections'], expect.arrayContaining([{ key: 'hero', visible: true }]))
    rerender({ edits: { platforms: { mobile_web: { pages: { home: { sections: [{ key: 'hero', visible: true }] } } } } } })
    expect(screen.getAllByRole('button', { name: /^Move .* down$/ }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('switch', { name: 'Order and hide them differently on phones' }))
    expect(setValue).toHaveBeenLastCalledWith(['platforms', 'mobile_web', 'pages', 'home', 'sections'], null)
  })

  it('moves a page’s sections within their block', () => {
    const { setValue } = renderEditor()
    openSection('Pages')
    fireEvent.click(screen.getAllByRole('button', { name: /^Move .* down$/ })[0])
    expect(setValue).toHaveBeenCalledWith(['pages', 'home', 'sections'], expect.arrayContaining([expect.objectContaining({ key: expect.any(String), visible: true })]))
  })

  it('leaves the website’s settings out of the theme', () => {
    renderEditor()
    expect(within(screen.getByRole('navigation', { name: 'Theme sections' })).queryByRole('button', { name: 'Website settings' })).toBeNull()
    expect(screen.queryByLabelText('Website name')).toBeNull()
  })

  it.each(['scope', 'cards', undefined])('edits website scope independently of settings with schema control %s', (control) => {
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    schema.site.mode.$extensions['co.ordering.editor'].control = control
    const site = {
      current: { site: { name: 'Burger Town' } },
      edits: {},
      fieldErrors: {},
      errorCodes: [],
      scope: { mode: 'marketplace', businessId: null, franchiseId: null },
      scopeOptions: {
        stores: { items: [{ id: 7, name: 'Burger Town Centro' }], search: '', page: 1, totalPages: 1, total: 1, loading: false, loaded: true, error: false },
        franchises: { items: [{ id: 3, name: 'Burger Group' }], search: '', page: 1, totalPages: 1, total: 1, loading: false, loaded: true, error: false }
      },
      hasEdits: false,
      setValue: vi.fn(),
      setScope: vi.fn(),
      setScopeMode: vi.fn(),
      loadScopeOptions: vi.fn(),
      save: vi.fn(),
      discard: vi.fn()
    }
    const view = renderWithProviders(<SiteSettingsEditor schema={schema} site={site} />)
    expect(within(rowOf('site.name')).getByRole('textbox', { name: 'Website name' })).toHaveValue('Burger Town')
    expect(screen.queryByLabelText('Store slug')).toBeNull()
    // Their own HTML and third-party code aren't offered yet
    expect(screen.queryByText('Your own content')).toBeNull()
    expect(screen.queryByText('Third-party code')).toBeNull()
    expect(screen.queryByLabelText('In the page head')).toBeNull()
    fireEvent.change(within(rowOf('site.description')).getByRole('textbox'), { target: { value: 'Best burgers' } })
    expect(site.setValue).toHaveBeenCalledWith(['site', 'description'], 'Best burgers')
    fireEvent.click(screen.getByRole('radio', { name: 'One store' }))
    expect(site.setScopeMode).toHaveBeenCalledWith('single_store')
    view.rerender(<SiteSettingsEditor schema={schema} site={{ ...site, hasEdits: true, scope: { mode: 'single_store', businessId: null, franchiseId: null } }} />)
    fireEvent.click(screen.getByRole('option', { name: 'Burger Town Centro' }))
    expect(site.setScope).toHaveBeenCalledWith({ mode: 'single_store', businessId: 7, item: { id: 7, name: 'Burger Town Centro' } })
    view.rerender(<SiteSettingsEditor schema={schema} site={{ ...site, hasEdits: true, scope: { mode: 'single_store', businessId: 7, franchiseId: null }, scopeSelection: { item: { id: 7, name: 'Burger Town Centro' } }, errorCodes: ['business_id.exists'] }} />)
    expect(screen.getByRole('radio', { name: 'One store' })).toBeChecked()
    expect(screen.getByText('That store doesn’t exist anymore. Choose another one.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(site.save).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Franchise' }))
    expect(site.setScopeMode).toHaveBeenLastCalledWith('franchise')
    view.rerender(<SiteSettingsEditor schema={schema} site={{ ...site, hasEdits: true, scope: { mode: 'franchise', businessId: null, franchiseId: null } }} />)
    fireEvent.click(screen.getByRole('option', { name: 'Burger Group' }))
    expect(site.setScope).toHaveBeenLastCalledWith({ mode: 'franchise', franchiseId: 3, item: { id: 3, name: 'Burger Group' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Marketplace' }))
    expect(site.setScopeMode).toHaveBeenLastCalledWith('marketplace')
    expect(site.setValue).toHaveBeenCalledTimes(1)
    expect(site.setValue).not.toHaveBeenCalledWith(['site', 'mode'], expect.anything())
    expect(schema.site.mode.$extensions['co.ordering.editor'].control).toBe(control)
  })

  it('marks the website type changed by its scope, not by a mode in its settings, and takes the marketplace back with its reset', () => {
    const site = {
      current: { site: { name: 'Burger Town', mode: 'franchise' } },
      edits: {},
      fieldErrors: {},
      errorCodes: [],
      scope: { mode: 'single_store', businessId: 7, franchiseId: null },
      scopeSelection: { item: { id: 7, name: 'Burger Town Centro' } },
      scopeOptions: {},
      hasEdits: false,
      setValue: vi.fn(),
      setScope: vi.fn(),
      setScopeMode: vi.fn(),
      loadScopeOptions: vi.fn(),
      save: vi.fn(),
      discard: vi.fn()
    }
    const view = renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
    expect(screen.getByRole('radio', { name: 'One store' })).toBeChecked()
    expect(within(rowOf('site.mode')).getByText('Changed')).toBeInTheDocument()
    fireEvent.click(within(rowOf('site.mode')).getByRole('button', { name: 'Restore Website type to its default' }))
    expect(site.setScopeMode).toHaveBeenCalledWith('marketplace')
    expect(site.setValue).not.toHaveBeenCalled()
    view.rerender(<SiteSettingsEditor schema={SCHEMA} site={{ ...site, scope: { mode: 'marketplace', businessId: null, franchiseId: null }, scopeSelection: null }} />)
    expect(screen.getByRole('radio', { name: 'Marketplace' })).toBeChecked()
    expect(within(rowOf('site.mode')).queryByText('Changed')).toBeNull()
    expect(within(rowOf('site.mode')).queryByRole('button', { name: 'Restore Website type to its default' })).toBeNull()
  })

  it('shows a read-only website type as its scope', () => {
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    schema.site.mode.$extensions['co.ordering.editor'].readonly = true
    const site = {
      current: { site: { name: 'Burger Town' } },
      edits: {},
      fieldErrors: {},
      errorCodes: [],
      scope: { mode: 'single_store', businessId: 7, franchiseId: null },
      scopeOptions: {},
      hasEdits: false,
      setValue: vi.fn(),
      setScope: vi.fn(),
      setScopeMode: vi.fn(),
      loadScopeOptions: vi.fn(),
      save: vi.fn(),
      discard: vi.fn()
    }
    renderWithProviders(<SiteSettingsEditor schema={schema} site={site} />)
    expect(within(rowOf('site.mode')).getByRole('img', { name: 'Website type: Single store' })).toBeInTheDocument()
    expect(within(rowOf('site.mode')).queryByText('Changed')).toBeNull()
  })

  it('says the website’s settings saved out of their range were set to the closest limit, apart from those dropped', () => {
    const site = {
      product: { settings_invalid: [{ path: 'site.name', code: 'site.name.invalid' }, { path: 'site.description', code: 'site.description.out_of_range' }] },
      current: { site: { name: 'A name much longer than it takes' } },
      edits: {},
      fieldErrors: {},
      errorCodes: [],
      scope: { mode: 'marketplace', businessId: null, franchiseId: null },
      scopeOptions: {},
      setValue: vi.fn()
    }
    renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
    expect(screen.getByText('1 saved setting isn’t valid in this version of the website: it’s dropped when you save. It’s marked below.')).toBeInTheDocument()
    expect(screen.getByText('1 saved setting is outside the range this version of the website takes: it was set to the closest limit, and it’s saved like that when you save. It’s marked below.')).toBeInTheDocument()
    expect(rowOf('site.description').textContent).toContain('was set to the closest limit')
  })

  it('marks the website’s saved settings this version drops, and says saving drops them', () => {
    const site = {
      product: { settings_invalid: [{ path: 'site.name', code: 'site.name.invalid' }] },
      current: { site: { name: 'A name much longer than it takes' } },
      edits: {},
      fieldErrors: {},
      errorCodes: [],
      scope: { mode: 'marketplace', businessId: null, franchiseId: null },
      scopeOptions: {},
      setValue: vi.fn()
    }
    const view = renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
    expect(screen.getByText('1 saved setting isn’t valid in this version of the website: it’s dropped when you save. It’s marked below.')).toBeInTheDocument()
    expect(rowOf('site.name').textContent).toContain('It was saved before this version of the website and is dropped when you save.')
    view.rerender(<SiteSettingsEditor schema={SCHEMA} site={{ ...site, edits: { site: { name: 'Burger Town' } } }} />)
    expect(screen.queryByText(/saved setting isn’t valid/)).toBeNull()
  })

  it('lists what converting the website’s settings to this version lost', () => {
    const site = { product: { settings_upgrade_dropped: ['site.description'] }, current: { site: {} }, edits: {}, fieldErrors: {}, errorCodes: [], scope: { mode: 'marketplace' }, scopeOptions: {}, setValue: vi.fn() }
    renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
    const notice = screen.getByText('Converting the settings to this version of the website dropped these, which take their default:').parentElement
    expect(notice.textContent).toContain('site.description')
  })

  it('leaves out a group the schema hides, in any section', () => {
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    schema.editor.sections.find(section => section.key === 'colors').groups.find(group => group.key === 'brand').hidden = true
    renderEditor({ schema })
    expect(rowOf('tokens.color.primary')).toBeNull()
    expect(screen.queryByText('Brand')).toBeNull()
    expect(screen.getByText('Success, warning, error and info')).toBeInTheDocument()
  })

  it('shows sections, tabs and cards as the editor block declares them', () => {
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    const parts = schema.editor.parts
    parts.find(part => part.key === 'variants').choices = false
    // Only colors in Colors and styles; appearances get a tab of their own
    parts.find(part => part.key === 'colors').sources = ['colors']
    parts.splice(2, 0, { key: 'appearances', label: { key: 'BUILDER_THEME_PART_STYLES', default: 'Styles' } })
    const button = schema.components.button.$extensions['co.ordering.editor']
    button.parts = { colors: { label: { key: 'BUILDER_THEME_BUTTON_COLORS', default: 'Button colors' } } }
    button.groups.find(group => group.key === 'motion').placement = 'before'
    renderEditor({ schema })
    openSection('Components')
    const tabs = within(screen.getByRole('tablist', { name: 'Button parts' })).getAllByRole('tab').map(tab => tab.textContent)
    expect(tabs).toEqual(['Base', 'Button colors', 'Styles', 'Sizes', 'Shapes'])
    // Motion declared before the rows
    const motion = screen.getByRole('heading', { name: 'Motion' })
    expect(motion.compareDocumentPosition(rowOf('components.button.base.radius')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Variants whole: every variant's values, no chip per variant
    fireEvent.click(screen.getByRole('button', { name: 'Tabs' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Styles' }))
    expect(screen.queryByRole('radiogroup', { name: 'Styles' })).toBeNull()
    expect(rowOf('components.tabs.variants.pill.background')).not.toBeNull()
    expect(rowOf('components.tabs.variants.underline.indicator')).not.toBeNull()
  })

  it('keeps a border painted in a role (the schema’s `{ink}`), whatever its path', () => {
    const borderOf = (schema) => {
      renderEditor({ schema })
      openSection('Components')
      fireEvent.click(within(screen.getByRole('tablist', { name: 'Button parts' })).getByRole('tab', { name: 'Colors and styles' }))
      const row = rowOf('components.button.appearances.outline.border')
      const controls = { selects: within(row).getAllByRole('combobox').length, color: within(row).queryByRole('button', { name: /color/ }) }
      cleanup()
      return controls
    }
    // The outline's border is the button color's ink: width and style only
    expect(borderOf(SCHEMA)).toEqual({ selects: 2, color: null })
    // A theme color instead of a role: its color can be chosen too
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    schema.components.button.appearances.outline.border.$value.color = '{color.border}'
    const own = borderOf(schema)
    expect(own.selects).toBe(2)
    expect(own.color).not.toBeNull()
  })

  it('shows a section as cards when it says so, whatever its paths are', () => {
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    schema.editor.sections.find(section => section.key === 'pages').layout = 'cards'
    renderEditor({ schema })
    openSection('Pages')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(rowOf('pages.home.footer')).not.toBeNull()
  })

  it('keeps a section that fails to show from blanking the editor', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const schema = JSON.parse(JSON.stringify(SCHEMA))
    // A label React can't render throws inside the section
    schema.tokens.typography.h1.$extensions['co.ordering.editor'].label = { key: 'BROKEN', default: { not: 'text' } }
    renderEditor({ schema })
    openSection('Typography')
    expect(screen.getByRole('alert')).toHaveTextContent('This part of the editor couldn’t be shown')
    openSection('Colors')
    expect(rowOf('tokens.color.primary')).not.toBeNull()
    spy.mockRestore()
  })

  it('picks a role in a select, with an option for none that sends null', () => {
    const roles = ['main', 'on', 'ink', 'subtle', 'pressed'].map(role => ({ value: `{${role}}`, label: { key: `BUILDER_THEME_ROLE_${role.toUpperCase()}`, default: role[0].toUpperCase() + role.slice(1) } }))
    const schema = { hover: { $type: 'role', $value: null, $extensions: { 'co.ordering.editor': { control: 'select', options: roles, labels: { unset: { key: 'BUILDER_THEME_SAME_AS_PRESSED', default: 'Same as pressed' } } } } } }
    const ctx = { schema, t: (_key, fallback) => fallback }
    const onChange = vi.fn()
    const view = renderWithProviders(<CONTROLS.select ctx={ctx} path='hover' label='Hover background' value={null} onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Hover background' })
    expect(select).toHaveDisplayValue('Same as pressed')
    fireEvent.change(select, { target: { value: JSON.stringify('{pressed}') } })
    expect(onChange).toHaveBeenLastCalledWith('{pressed}')
    view.rerender(<CONTROLS.select ctx={ctx} path='hover' label='Hover background' value='{pressed}' onChange={onChange} />)
    expect(select).toHaveDisplayValue('Pressed')
    fireEvent.change(select, { target: { value: 'unset' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('names a state’s shadow without a value of its own, not as the level none, and takes it back to none', () => {
    const level = (name, label) => ({ $type: 'shadow', $value: { x: 0, y: 0, blur: 0, spread: 0, color: '#000000' }, $extensions: { 'co.ordering.editor': { label: { key: name, default: label } } } })
    const schema = {
      tokens: { shadow: { none: level('NONE', 'None'), sm: level('SM', 'Small') } },
      hover: { $type: 'shadow', $value: null, $extensions: { 'co.ordering.editor': { control: 'shadow', labels: { unset: { key: 'BUILDER_THEME_SAME_AS_RESTING', default: 'Same as resting' } } } } }
    }
    const ctx = { schema, t: (_key, fallback) => fallback }
    const onChange = vi.fn()
    const view = renderWithProviders(<CONTROLS.shadow ctx={ctx} path='hover' label='Hover shadow' value={null} onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Hover shadow' })
    expect(select).toHaveDisplayValue('Same as resting')
    expect(within(select).getByRole('option', { name: 'None' })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: '{shadow.none}' } })
    expect(onChange).toHaveBeenLastCalledWith('{shadow.none}')
    view.rerender(<CONTROLS.shadow ctx={ctx} path='hover' label='Hover shadow' value='{shadow.none}' onChange={onChange} />)
    expect(select).toHaveDisplayValue('None')
    fireEvent.change(select, { target: { value: 'unset' } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('shows a value with a name for none as none while the theme has none, whatever resolve fills in', () => {
    const schema = { components: { button: { hover: { $type: 'role', $value: null, $extensions: { 'co.ordering.editor': { control: 'select', labels: { unset: { default: 'Same as pressed' } } } } } } } }
    const read = { value: null, own: false, themeKeys: ['components', 'button', 'hover'] }
    const ctx = { schema, resolved: { components: { button: { hover: '{pressed}' } } }, sources: {} }
    expect(shownValue(ctx, 'components.button.hover', read)).toBeNull()
    expect(shownValue({ ...ctx, sources: { 'components.button.hover': 'inherited' } }, 'components.button.hover', read)).toBe('{pressed}')
  })

  it('says what an image takes: its formats, size, proportion, weight and transparency', () => {
    const t = (_key, fallback) => fallback
    expect(imageHints(t, ['png', 'jpg', 'webp', 'avif'], { size: [2560, 1440], ratio: '16:9', alpha: true, max_kb: 600 }))
      .toBe('PNG, JPG, WebP, AVIF · 2560 × 1440 px (16:9) · Up to 600 KB · Transparent background')
    expect(imageHints(t, ['svg'], { ratio: '1:1', alpha: false })).toBe('SVG · Proportion 1:1')
    expect(imageHints(t, ['jpg'])).toBe('JPG')

    const schema = { images: { hero: { $type: 'image', $value: null, $extensions: { 'co.ordering': { formats: null, hints: { size: [1080, 1920], max_kb: 400 } }, 'co.ordering.editor': { control: 'image' } } } } }
    renderWithProviders(<CONTROLS.image ctx={{ schema, t, format: { images: { default_formats: ['jpg', 'png'] } } }} path='images.hero' label='Hero' value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Upload' })).toHaveAccessibleDescription('JPG, PNG · 1080 × 1920 px · Up to 400 KB')
    expect(screen.getByLabelText('Image file: Hero')).toHaveAttribute('accept', '.jpg,.png')
  })

  it('shows a tone a button color doesn’t declare as the API works it out, to read', () => {
    // Primary declares its pressed tone (shown, as in 26.1.0); Error doesn't
    const schema = structuredClone(SCHEMA)
    delete schema.components.button.colors.primary.pressed.$extensions['co.ordering.editor'].hidden
    const { rerender } = renderEditor({ schema, resolved: { components: { button: { colors: { danger: { pressed: '#A11D2E' } } } } } })
    openSection('Components')
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Button parts' })).getByRole('tab', { name: 'Colors and styles' }))
    expect(within(rowOf('components.button.colors.danger')).getByRole('img', { name: /: Automatic \(#A11D2E\)$/i })).toBeInTheDocument()
    rerender({ resolved: {} })
    expect(within(rowOf('components.button.colors.danger')).queryByRole('img', { name: /Automatic/ })).toBeNull()
  })

  it('shows a read-only value as resolve serves it, named Automatic without one of its own, with nothing to edit or reset', () => {
    const schema = structuredClone(SCHEMA)
    const tone = schema.components.button.colors.primary.pressed
    tone.$value = null
    tone.$extensions['co.ordering.editor'] = { control: 'color', readonly: true, labels: { unset: { key: 'BUILDER_THEME_AUTOMATIC', default: 'Automatic' } } }
    const resolved = { components: { button: { colors: { primary: { pressed: '#DB4900' } } } } }
    const { setValue, rerender } = renderEditor({ schema, resolved })
    openSection('Components')
    fireEvent.click(within(screen.getByRole('tablist', { name: 'Button parts' })).getByRole('tab', { name: 'Colors and styles' }))
    const row = () => rowOf('components.button.colors.primary')
    expect(within(row()).getByRole('img', { name: /: Automatic \(#DB4900\)$/i })).toBeInTheDocument()
    expect(within(row()).queryByRole('button', { name: /Pressed/ })).toBeNull()
    // Its own value shows, still not to change or reset
    rerender({ schema, resolved, current: { components: { button: { colors: { primary: { pressed: '#111111' } } } } } })
    expect(within(row()).getByRole('img', { name: /: #DB4900$/i })).toBeInTheDocument()
    expect(within(row()).queryByRole('button', { name: /Restore/ })).toBeNull()
    expect(setValue).not.toHaveBeenCalled()
  })

  it('says why a number or an image was refused: out of its range, or in a format it doesn’t take', () => {
    renderEditor({ fieldErrors: { 'tokens.color.primary': 'tokens.color.primary.out_of_range', 'tokens.color.secondary': 'tokens.color.secondary.format' } })
    expect(within(rowOf('tokens.color.primary')).getByRole('alert')).toHaveTextContent('This value is outside the range it takes. Choose another one.')
    expect(within(rowOf('tokens.color.secondary')).getByRole('alert')).toHaveTextContent('This image’s format isn’t taken here. Upload it in one of the formats below.')
  })

  it('marks a typography field, a number or an image refused where its control is', () => {
    renderEditor({
      fieldErrors: {
        'tokens.typography.h1.size': 'tokens.typography.h1.size.out_of_range',
        'images.logo': 'images.logo.format',
        'tokens.color.primary': 'tokens.color.primary.invalid'
      }
    })
    expect(within(rowOf('tokens.color.primary')).getByRole('alert')).toHaveTextContent('This value isn’t valid. Choose another one.')
    openSection('Typography')
    expect(within(rowOf('tokens.typography.h1')).getByRole('alert')).toHaveTextContent('This value is outside the range it takes. Choose another one.')
    openSection('Images')
    expect(within(rowOf('images.logo')).getByRole('alert')).toHaveTextContent('This image’s format isn’t taken here. Upload it in one of the formats below.')
  })

  it('says a number the theme saved out of its range was set to the closest limit, not dropped', () => {
    renderEditor({ invalid: [{ path: 'tokens.typography.h1.size', code: 'tokens.typography.h1.size.out_of_range' }] })
    openSection('Typography')
    const row = rowOf('tokens.typography.h1')
    expect(row.textContent).toContain('It was saved outside the range this version of the website takes and was set to the closest limit. It’s saved like that when you save.')
    expect(row.textContent).not.toContain('dropped when you save')
    expect(within(row).queryByRole('alert')).toBeNull()
  })

  it('takes the empty maps of a theme as objects', () => {
    renderEditor({ current: { modes: {}, tokens: {}, components: {}, pages: {}, platforms: {} }, edits: { modes: {} } })
    expect(rowOf('tokens.color.primary')).toBeInTheDocument()
  })

  it('marks what the theme saved that this version drops, until a change sets it', () => {
    const invalid = [{ path: 'tokens.color.primary', code: 'tokens.color.primary.invalid' }]
    const { rerender } = renderEditor({ invalid })
    expect(rowOf('tokens.color.primary').textContent).toContain('This value isn’t valid. Choose another one. It was saved before this version of the website and is dropped when you save.')
    rerender({ edits: { tokens: { color: { primary: '#00AA00' } } } })
    expect(rowOf('tokens.color.primary').textContent).not.toContain('dropped when you save')
  })

  it('knows which paths of the theme the editor shows', () => {
    expect(showsPath(SCHEMA, 'tokens.color.primary')).toBe(true)
    expect(showsPath(SCHEMA, 'tokens.typography.h1.size')).toBe(true)
    expect(showsPath(SCHEMA, 'platforms.mobile_web.pages.checkout.footer')).toBe(true)
    expect(showsPath(SCHEMA, 'tokens.color.gone')).toBe(false)
    expect(showsPath(SCHEMA, 'modes.dark.color.primary')).toBe(false)
    expect(showsPath(SCHEMA, 'site.name')).toBe(false)
  })

  it('marks a value the API refused', () => {
    renderEditor({ fieldErrors: { 'tokens.color.primary': 'tokens.color.primary.invalid' } })
    expect(within(rowOf('tokens.color.primary')).getByRole('alert')).toHaveTextContent('This value isn’t valid')
  })

  it('says why a color was refused: transparent where it can’t be, or following a color the theme no longer has', () => {
    renderEditor({ fieldErrors: { 'tokens.color.primary': 'tokens.color.primary.alpha', 'tokens.color.secondary': 'tokens.color.secondary.alias' } })
    expect(within(rowOf('tokens.color.primary')).getByRole('alert')).toHaveTextContent('This color can’t be transparent. Choose an opaque one.')
    expect(within(rowOf('tokens.color.secondary')).getByRole('alert')).toHaveTextContent('This value follows one the theme no longer has. Choose another one.')
  })

  it('shows what a component shows in its Base, on all screens and on phones, not in Visibility', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Visibility')
    expect(screen.queryByRole('button', { name: 'User menu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Store cards' })).toBeNull()
    expect(rowOf('visibility.smart_app_banner')).not.toBeNull()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Sidebar menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'What it shows' }))
    // Before the component's own rows
    expect(rowOf('visibility.menu.wallet').compareDocumentPosition(rowOf('components.sidebar_menu.base.title')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(rowOf('visibility.menu.wallet')).getByRole('switch'))
    expect(setValue).toHaveBeenCalledWith(['visibility', 'menu.wallet'], expect.any(Boolean))
    fireEvent.click(screen.getByRole('tab', { name: 'On phones' }))
    expect(screen.getByText(/What phones show/)).toBeInTheDocument()
    fireEvent.click(within(rowOf('visibility.menu.wallet')).getByRole('switch'))
    expect(setValue).toHaveBeenLastCalledWith(['platforms', 'mobile_web', 'visibility', 'menu.wallet'], expect.any(Boolean))
    // Marked changed in the list and on its screen
    const list = screen.getByRole('navigation', { name: 'Components' })
    expect(within(list).queryByText('Changed')).toBeNull()
    rerender({ edits: { platforms: { mobile_web: { visibility: { 'menu.wallet': false } } } } })
    expect(within(list).getByText('Changed')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /On phones/ })).getByText('Changed')).toBeInTheDocument()
  })

  it('leaves a key a component’s card switches in that card, not in what the component shows', () => {
    const { setValue } = renderEditor()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Store card' }))
    fireEvent.click(screen.getByRole('button', { name: 'What it shows' }))
    expect(rowOf('visibility.business_card.fee')).not.toBeNull()
    expect(rowOf('visibility.business_card.logo')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Show the logo' }))
    expect(setValue).toHaveBeenCalledWith(['visibility', 'business_card.logo'], expect.any(Boolean))
  })

  it('opens and resets a component with what it shows, and a card’s switch where the card is', () => {
    const sections = SCHEMA.editor.sections
    expect(locatePath(SCHEMA, sections, 'platforms.mobile_web.visibility.menu.wallet')).toEqual({ section: 'components', item: 'components.sidebar_menu' })
    expect(locatePath(SCHEMA, sections, 'tokens.motion_style.enabled')).toEqual({ section: 'motion', item: null })
    const reset = getResetSections(SCHEMA, { section: 'components', item: 'components.sidebar_menu' })
    expect(reset).toEqual(expect.arrayContaining(['components.sidebar_menu', 'platforms.mobile_web.components.sidebar_menu', 'visibility.menu.wallet', 'platforms.mobile_web.visibility.menu.wallet']))
    const visibility = getResetSections(SCHEMA, { section: 'visibility' })
    expect(visibility).toContain('visibility.smart_app_banner')
    expect(visibility.filter(path => /visibility\.(menu|business_card)\./.test(path))).toEqual([])
  })

  it('offers a component’s text style a custom one, starting as its level, without a family', () => {
    const { setValue, rerender } = renderEditor()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: 'Sidebar menu' }))
    const select = within(rowOf('components.sidebar_menu.base.title')).getByRole('combobox')
    expect(within(select).getByRole('option', { name: 'Custom' })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'custom' } })
    const h3 = SCHEMA.tokens.typography.h3.$value
    expect(setValue).toHaveBeenLastCalledWith(['components', 'sidebar_menu', 'base', 'title'], h3)
    rerender({ edits: { components: { sidebar_menu: { base: { title: h3 } } } } })
    const row = rowOf('components.sidebar_menu.base.title')
    expect(within(row).getByRole('combobox', { name: 'Text style' })).toHaveValue('custom')
    // The type scale's fields, with their widest limits
    const size = within(row).getByRole('spinbutton', { name: 'Text style: Size' })
    expect(size).toHaveAttribute('max', '72')
    fireEvent.change(size, { target: { value: '22' } })
    expect(setValue).toHaveBeenLastCalledWith(['components', 'sidebar_menu', 'base', 'title'], { ...h3, size: 22 })
  })

  it('offers each text style only the weights its font has', () => {
    renderEditor({ edits: { tokens: { font: { heading: 'lato' } } } })
    openSection('Typography')
    const heading = within(rowOf('tokens.typography.h1')).getByRole('combobox', { name: /Weight/ })
    expect(within(heading).queryByRole('option', { name: /200/ })).toBeNull()
    expect(within(heading).getByRole('option', { name: /300/ })).toBeInTheDocument()
    const body = within(rowOf('tokens.typography.body')).getByRole('combobox', { name: /Weight/ })
    expect(within(body).getByRole('option', { name: /200/ })).toBeInTheDocument()
  })

  it('shows chosen a value the schema no longer offers: an option, a font, a text style of its own', () => {
    const schema = structuredClone(SCHEMA)
    delete schema.components.sidebar_menu.base.title.$extensions['co.ordering.editor'].custom
    renderEditor({
      schema,
      current: {
        tokens: { shadow_style: { direction: 'gone_way' }, layout: { mode: 'gone_mode' }, font: { heading: 'comic_sans' } },
        components: { sidebar_menu: { base: { title: { size: 22, line: 1.3, weight: 600 } } } }
      }
    })
    openSection('Typography')
    expect(within(rowOf('tokens.font.heading')).getByRole('combobox')).toHaveValue('comic_sans')
    openSection('Shadows')
    expect(within(rowOf('tokens.shadow_style.direction')).getByRole('radio', { name: 'Gone way' })).toBeChecked()
    openSection('Layout')
    expect(within(rowOf('tokens.layout.mode')).getByRole('radio', { name: 'Gone mode' })).toBeChecked()
    openSection('Components')
    fireEvent.click(screen.getByRole('button', { name: /^Sidebar menu/ }))
    const select = within(rowOf('components.sidebar_menu.base.title')).getByRole('combobox')
    expect(select.selectedOptions[0]).toHaveTextContent(/^Custom$/)
  })

  it('only shows a value whose control the editor doesn’t have, or that a text field would save as text', () => {
    const schema = structuredClone(SCHEMA)
    schema.tokens.color.primary.$extensions['co.ordering.editor'].control = 'gradient'
    schema.tokens.typography.h1.$extensions['co.ordering.editor'].control = 'text'
    const { setValue } = renderEditor({ schema })
    const primary = rowOf('tokens.color.primary')
    expect(within(primary).queryByRole('textbox')).toBeNull()
    expect(within(primary).getByRole('img', { name: /^Primary: #/ })).toBeInTheDocument()
    openSection('Typography')
    expect(within(rowOf('tokens.typography.h1')).queryByRole('textbox')).toBeNull()
    expect(setValue).not.toHaveBeenCalled()
  })

  it('keeps each value of an ordered card between its neighbours', () => {
    renderEditor({ edits: { tokens: { size: { lg: 44 } } } })
    openSection('Sizes')
    const medium = within(rowOf('tokens.size.md')).getByRole('spinbutton')
    expect(medium).toHaveAttribute('min', '32')
    expect(medium).toHaveAttribute('max', '44')
    // Text styles in descending order: a heading's size between the next one's and the one before
    const ctx = { schema: SCHEMA, current: {}, edits: {} }
    const levels = ['display', 'h1', 'h2'].map(level => `tokens.typography.${level}`)
    const sizes = levels.map(path => SCHEMA.tokens.typography[path.split('.')[2]].$value.size)
    expect(orderBounds(ctx, levels, 'descending')['tokens.typography.h1']).toEqual({ min: sizes[2], max: sizes[0] })
  })

  it('names a page’s blocks with the sections node’s own, with their help', () => {
    renderEditor()
    openSection('Pages')
    expect(screen.getByText('Under the banner')).toBeInTheDocument()
    expect(screen.getByText('What shows below the banner.')).toBeInTheDocument()
  })

  it('takes a text up to its length and in its format, empty as unset, with its example', () => {
    const setValue = vi.fn()
    const site = { current: { site: { name: 'Burger Town' } }, edits: {}, fieldErrors: {}, errorCodes: [], scope: { mode: 'marketplace', businessId: null, franchiseId: null }, scopeOptions: {}, hasEdits: false, setValue, setScope: vi.fn(), setScopeMode: vi.fn(), loadScopeOptions: vi.fn(), save: vi.fn(), discard: vi.fn() }
    renderWithProviders(<SiteSettingsEditor schema={SCHEMA} site={site} />)
    const name = within(rowOf('site.name')).getByRole('textbox')
    expect(name).toHaveAttribute('maxLength', '60')
    expect(within(rowOf('site.name')).getByText('11/60')).toBeInTheDocument()
    fireEvent.change(name, { target: { value: '' } })
    expect(setValue).toHaveBeenLastCalledWith(['site', 'name'], null)
    expect(within(rowOf('site.description')).getByRole('textbox').tagName).toBe('TEXTAREA')
    const apple = within(rowOf('site.smart_banner.apple_id')).getByRole('textbox')
    expect(apple).toHaveAttribute('placeholder', '123456789')
    fireEvent.change(apple, { target: { value: 'abc' } })
    expect(within(rowOf('site.smart_banner.apple_id')).getByRole('alert')).toBeInTheDocument()
    expect(setValue).not.toHaveBeenCalledWith(['site', 'smart_banner', 'apple_id'], 'abc')
    fireEvent.change(apple, { target: { value: '1234567' } })
    expect(setValue).toHaveBeenLastCalledWith(['site', 'smart_banner', 'apple_id'], '1234567')
  })

  it('leaves out of the website’s settings a theme’s value, which they wouldn’t save', () => {
    const schema = {
      ...SCHEMA,
      editor: {
        ...SCHEMA.editor,
        sections: SCHEMA.editor.sections.map(section => section.key !== 'site'
          ? section
          : {
              ...section,
              groups: section.groups.map(group => group.key !== 'smart_banner' ? group : { ...group, toggle: { path: 'visibility.smart_app_banner' }, paths: [...group.paths, 'visibility.header.cart'] })
            })
      }
    }
    const site = { current: { site: {} }, edits: {}, fieldErrors: {}, errorCodes: [], scope: { mode: 'marketplace', businessId: null, franchiseId: null }, scopeOptions: {}, hasEdits: false, setValue: vi.fn(), setScope: vi.fn(), setScopeMode: vi.fn(), loadScopeOptions: vi.fn(), save: vi.fn(), discard: vi.fn() }
    renderWithProviders(<SiteSettingsEditor schema={schema} site={site} />)
    expect(rowOf('site.smart_banner.apple_id')).not.toBeNull()
    expect(rowOf('visibility.header.cart')).toBeNull()
    expect(screen.queryByRole('switch', { name: /download the app/ })).toBeNull()
  })

  it('edits the website’s home and footer HTML in the rich editor, as HTML what it can’t keep', async () => {
    const schema = {
      ...SCHEMA,
      editor: {
        ...SCHEMA.editor,
        sections: SCHEMA.editor.sections.map(section => section.key !== 'site'
          ? section
          : { ...section, groups: section.groups.map(group => group.key !== 'content' ? group : { ...group, hidden: false }) })
      }
    }
    const setValue = vi.fn()
    const site = { current: { site: { home_html: '<p><b>Open</b> every day</p>', footer_html: '<div class="links">Contact</div>' } }, edits: {}, fieldErrors: {}, errorCodes: [], scope: { mode: 'marketplace', businessId: null, franchiseId: null }, scopeOptions: {}, hasEdits: false, setValue, setScope: vi.fn(), setScopeMode: vi.fn(), loadScopeOptions: vi.fn(), save: vi.fn(), discard: vi.fn() }
    renderWithProviders(<SiteSettingsEditor schema={schema} site={site} />)
    const home = await within(rowOf('site.home_html')).findByRole('textbox', { name: 'Home content' })
    expect(home).toHaveAttribute('contenteditable', 'true')
    expect(home.querySelector('strong')).toHaveTextContent('Open')
    const footer = within(rowOf('site.footer_html')).getByRole('textbox', { name: 'Footer content' })
    expect(footer).toHaveValue('<div class="links">Contact</div>')
    fireEvent.change(footer, { target: { value: '<div class="links">Call us</div>' } })
    expect(setValue).toHaveBeenLastCalledWith(['site', 'footer_html'], '<div class="links">Call us</div>')
  })

  it('says to keep what matters inside an image’s safe area', () => {
    expect(imageHints((_key, text) => text, ['png'], { safe: '3:1' })).toContain('Keep what matters in the middle 3:1')
  })

  it('writes a text style whole and without the family it resolves with', () => {
    const resolved = { tokens: { typography: { h1: { size: 32, line: 1.25, weight: 600, family: 'montserrat' } } } }
    const { setValue } = renderEditor({ resolved, current: { tokens: { typography: { body: { weight: 300 } } } } })
    openSection('Typography')
    fireEvent.change(within(rowOf('tokens.typography.h1')).getByRole('spinbutton', { name: 'Heading 1: Size' }), { target: { value: '33' } })
    expect(setValue).toHaveBeenLastCalledWith(['tokens', 'typography', 'h1'], { size: 33, line: 1.25, weight: 600 })
    // One that has only its weight takes the rest from its default
    fireEvent.change(within(rowOf('tokens.typography.body')).getByRole('spinbutton', { name: 'Text: Size' }), { target: { value: '15' } })
    expect(setValue).toHaveBeenLastCalledWith(['tokens', 'typography', 'body'], { size: 15, line: 1.71, weight: 300 })
  })

  it('shows a line height as a ratio of the size, with what it is in px, as typed until it leaves', () => {
    const { setValue, rerender } = renderEditor({ edits: { tokens: { typography: { h1: { size: 32, line: 1.5, weight: 600 } } } } })
    openSection('Typography')
    const row = rowOf('tokens.typography.h1')
    const line = within(row).getByRole('spinbutton', { name: 'Heading 1: Line height' })
    expect(line).toHaveDisplayValue('1.50')
    expect(line).toHaveAttribute('step', '0.01')
    expect(within(row).getByText('×')).toBeInTheDocument()
    expect(within(row).getByText('= 48 px')).toBeInTheDocument()
    fireEvent.change(line, { target: { value: '1.4' } })
    expect(setValue).toHaveBeenLastCalledWith(['tokens', 'typography', 'h1'], { size: 32, line: 1.4, weight: 600 })
    rerender({ edits: { tokens: { typography: { h1: { size: 32, line: 1.4, weight: 600 } } } } })
    expect(line).toHaveDisplayValue('1.4')
    fireEvent.blur(line)
    expect(line).toHaveDisplayValue('1.40')
    // Off the level's limits: said as ratios, not saved
    fireEvent.change(line, { target: { value: '1.8' } })
    expect(within(row).getByRole('alert')).toHaveTextContent('Use 1.00× to 1.60×.')
    expect(setValue).not.toHaveBeenCalledWith(['tokens', 'typography', 'h1'], expect.objectContaining({ line: 1.8 }))
  })
})
