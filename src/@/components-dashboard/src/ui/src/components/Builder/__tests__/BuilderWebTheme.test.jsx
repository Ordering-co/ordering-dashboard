import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

const state = vi.hoisted(() => ({ list: {}, editor: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductThemes: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.list} />,
  BuilderThemeEditor: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.editor} />,
  ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useToast: () => [{}, { showToast: state.showToast }],
  useUtils: () => [{ parseDate: (value) => String(value) }]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />),
    Input: ReactActual.forwardRef((props, ref) => <input ref={ref} {...props} />)
  }
})
vi.mock('../../Shared', () => ({
  Confirm: ({ open, title, acceptText, onAccept, onCancel, children }) => open
    ? (
      <div role='dialog' aria-label={title}>
        {children}
        <button onClick={onCancel}>Keep</button>
        <button onClick={onAccept}>{acceptText}</button>
      </div>
      )
    : null
}))
vi.mock('../../Shared/SideBar', () => ({ SideBar: ({ children }) => <div data-testid='side-bar'>{children}</div> }))

import { BuilderThemeEditorView, BuilderWebThemes } from '../BuilderWebTheme'

const product = { id: 45, name: 'Burger Town website', product_type: 'marketplace_website' }
const v1 = { id: 3, name: null, active: true, version: 1, preset: null, has_draft: false, updated_at: '2026-09-12 10:00:00' }
const summer = { id: 10, name: 'Summer 2026', active: false, version: 2, preset: { id: 1, name: 'Classic', version: 3 }, has_draft: true, updated_at: '2026-10-09 10:42:00' }

const renderList = (extra = {}) => {
  state.list = {
    themesState: { loading: false, error: false, themes: [v1, summer] },
    presetsState: { loading: false, loaded: true, presets: [], error: false },
    themeAction: null,
    reloadThemes: vi.fn(),
    getPresets: vi.fn(),
    createTheme: vi.fn(async () => ({ ok: true, errorCodes: [], theme: { id: 11 } })),
    activateTheme: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    deleteTheme: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    ...extra
  }
  const onEditTheme = vi.fn()
  renderWithProviders(<BuilderWebThemes product={product} onEditTheme={onEditTheme} />)
  return { onEditTheme }
}

const editorTheme = (extra = {}) => ({
  id: 10,
  name: 'Summer 2026',
  active: false,
  version: 2,
  preset: { id: 1, name: 'Classic', version: 3 },
  has_draft: false,
  updated_at: '2026-10-09 10:42:00',
  values: { tokens: { color: { primary: '#FF5500' } } },
  draft_values: null,
  ...extra
})

const renderEditor = (extra = {}) => {
  const theme = extra.theme || editorTheme()
  state.editor = {
    schemaState: { loading: false, error: false, schema: extra.schema || SCHEMA },
    themeState: { loading: false, error: false, notFound: false, theme },
    current: theme.draft_values ?? theme.values,
    edits: {},
    editCount: 0,
    fieldErrors: {},
    editorAction: null,
    reload: vi.fn(),
    setValue: vi.fn(),
    saveDraft: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    publish: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    discardDraft: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    resetToPreset: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    rename: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    uploadImage: vi.fn(async () => ({ ok: true, errorCodes: [] })),
    ...extra
  }
  const onBack = vi.fn()
  renderWithProviders(<BuilderThemeEditorView product={product} themeId={10} onBack={onBack} />)
  return { onBack }
}

const click = async (element) => { await act(async () => { fireEvent.click(element) }) }

describe('Saved themes of a website', () => {
  beforeEach(() => { state.showToast.mockReset() })

  it('shows the previous version theme as the current one, with a way to make a new theme from it', () => {
    renderList()
    const card = screen.getByRole('region', { name: 'Saved themes' })
    expect(within(card).getByText('2 of 5')).toBeTruthy()
    expect(within(card).getByText('Current theme (previous version)')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Create a new theme from this one' })).toBeTruthy()
    // The active theme can't be deleted or activated
    expect(within(card).queryByRole('button', { name: 'Delete Current theme (previous version)' })).toBe(null)
    expect(within(card).getByText('Based on Classic v3 · Updated 2026-10-09 10:42:00')).toBeTruthy()
    expect(within(card).getByText('Unpublished changes')).toBeTruthy()
  })

  it('marks a theme saved with an earlier version of the website', () => {
    renderList({ themesState: { loading: false, error: false, themes: [v1, { ...summer, upgraded_from: '26.1.0' }] } })
    expect(screen.getByText('Converted from 26.1.0')).toBeTruthy()
  })

  it('opens the editor of a theme', async () => {
    const { onEditTheme } = renderList()
    await click(screen.getByRole('button', { name: 'Edit: Summer 2026' }))
    expect(onEditTheme).toHaveBeenCalledWith(10)
  })

  it('activates a theme after confirming, saying the draft stays in the editor', async () => {
    renderList()
    await click(screen.getByRole('button', { name: 'Activate: Summer 2026' }))
    const dialog = screen.getByRole('dialog', { name: 'Activate Summer 2026?' })
    expect(within(dialog).getByText(/Its unpublished changes stay in the editor/)).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(state.list.activateTheme).toHaveBeenCalledWith(10)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Summer 2026 is active. Your website shows it within 5 minutes.')
  })

  it('deletes an inactive theme after confirming', async () => {
    renderList()
    await click(screen.getByRole('button', { name: 'Delete Summer 2026' }))
    await click(within(screen.getByRole('dialog', { name: 'Delete Summer 2026?' })).getByRole('button', { name: 'Delete' }))
    expect(state.list.deleteTheme).toHaveBeenCalledWith(10)
  })

  it('stops creating at 5 themes', () => {
    renderList({ themesState: { loading: false, error: false, themes: [v1, summer, { ...summer, id: 11 }, { ...summer, id: 12 }, { ...summer, id: 13 }] } })
    expect(screen.getByRole('button', { name: /New theme/ }).disabled).toBe(true)
    expect(screen.getByText('You already have 5 themes. Delete one to create another.')).toBeTruthy()
  })

  it('asks for a name before creating, and opens the new theme', async () => {
    const { onEditTheme } = renderList()
    await click(screen.getByRole('button', { name: /New theme/ }))
    const panel = screen.getByTestId('side-bar')
    expect(state.list.getPresets).toHaveBeenCalled()
    expect(within(panel).getByText('There are no presets for this kind of website yet.')).toBeTruthy()
    expect(within(panel).getByLabelText(/Your current theme/).checked).toBe(true)

    await click(within(panel).getByRole('button', { name: 'Create and edit' }))
    expect(state.list.createTheme).not.toHaveBeenCalled()
    expect(within(panel).getByRole('alert').textContent).toBe('Enter a name.')

    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: '  Night menu ' } })
    fireEvent.click(within(panel).getByLabelText(/From scratch/))
    await click(within(panel).getByRole('button', { name: 'Create and edit' }))
    expect(state.list.createTheme).toHaveBeenCalledWith({ name: 'Night menu', source: 'blank', presetId: null })
    expect(onEditTheme).toHaveBeenCalledWith(11)
  })

  it('says when the limit was reached meanwhile', async () => {
    renderList({ createTheme: vi.fn(async () => ({ ok: false, errorCodes: ['theme.limit'], theme: null })) })
    await click(screen.getByRole('button', { name: /New theme/ }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Night' } })
    await click(screen.getByRole('button', { name: 'Create and edit' }))
    expect(screen.getByRole('alert').textContent).toBe('You already have 5 themes. Delete one to create another.')
  })
})

describe('Theme editor', () => {
  beforeEach(() => {
    state.showToast.mockReset()
    window.history.replaceState(null, '', '/builder/45?tab=theme&theme=10')
  })

  it('shows the theme, and edits its values from the schema', () => {
    renderEditor()
    expect(screen.getByRole('heading', { name: 'Summer 2026' })).toBeTruthy()
    expect(screen.getByText(/This theme isn’t active/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Primary'), { target: { value: '#00aa00' } })
    expect(state.editor.setValue).toHaveBeenCalledWith(['tokens', 'color', 'primary'], '#00AA00')
  })

  it('saves the draft only with changes, and publishes', async () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Save draft' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Publish' }).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('No unsaved changes')
  })

  it('counts the unsaved changes and saves them', async () => {
    renderEditor({ editCount: 2, edits: { tokens: { color: { primary: '#00AA00', secondary: '#111111' } } } })
    expect(screen.getByRole('status').textContent).toBe('2 unsaved changes')
    await click(screen.getByRole('button', { name: 'Save draft' }))
    expect(state.editor.saveDraft).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Draft saved')
    await click(screen.getByRole('button', { name: 'Publish' }))
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Published. Activate the theme to show it on your website.')
  })

  it('asks before leaving with unsaved changes', async () => {
    const { onBack } = renderEditor({ editCount: 1, edits: { tokens: { color: { primary: '#00AA00' } } } })
    await click(screen.getByRole('button', { name: 'Back to themes' }))
    expect(onBack).not.toHaveBeenCalled()
    await click(within(screen.getByRole('dialog', { name: 'Leave without saving?' })).getByRole('button', { name: 'Leave' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('discards the draft after confirming', async () => {
    renderEditor({ theme: editorTheme({ has_draft: true }) })
    await click(screen.getByRole('button', { name: 'Discard draft' }))
    await click(within(screen.getByRole('dialog', { name: 'Discard the draft?' })).getByRole('button', { name: 'Discard draft' }))
    expect(state.editor.discardDraft).toHaveBeenCalled()
  })

  it('resets the section open to the preset, a component with its platforms', async () => {
    renderEditor()
    await click(screen.getByRole('button', { name: 'Reset to preset' }))
    await click(screen.getByRole('button', { name: 'Only this section' }))
    await click(within(screen.getByRole('dialog', { name: 'Reset this section to the preset?' })).getByRole('button', { name: 'Reset' }))
    expect(state.editor.resetToPreset).toHaveBeenCalledWith(['tokens.color', 'tokens.opacity.scrim'])
    await click(within(screen.getByRole('navigation', { name: 'Theme sections' })).getByRole('link', { name: 'Components' }))
    await click(screen.getByRole('button', { name: 'Reset to preset' }))
    await click(screen.getByRole('button', { name: 'Only this section' }))
    await click(within(screen.getByRole('dialog', { name: 'Reset this section to the preset?' })).getByRole('button', { name: 'Reset' }))
    expect(state.editor.resetToPreset).toHaveBeenLastCalledWith(['components.button', 'platforms.mobile_web.components.button'])
  })

  it('says a theme is shown converted and what converting it lost, and saves it converted with no changes', async () => {
    renderEditor({ theme: editorTheme({ upgraded_from: '26.1.0', schema_version: '27.0.0', upgrade_dropped: ['tokens.color.rating'] }) })
    expect(screen.getByText(/saved with version 26\.1\.0 of the website and you see it converted to version 27\.0\.0/)).toBeTruthy()
    expect(screen.getByText('Converting it dropped these values, which take their default:')).toBeTruthy()
    expect(screen.getByText('tokens.color.rating')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save draft' })
    expect(save.disabled).toBe(false)
    await click(save)
    expect(state.editor.saveDraft).toHaveBeenCalled()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Draft saved')
  })

  it('marks the saved values this version drops, lists those the editor doesn’t show, and forgets one changed', () => {
    const invalid = [{ path: 'tokens.color.primary', code: 'tokens.color.primary.alpha' }, { path: 'tokens.color.gone', code: 'tokens.color.gone.unknown' }]
    renderEditor({ theme: editorTheme({ invalid }) })
    expect(screen.getByText(/^2 saved values aren’t valid in this version of the website/)).toBeTruthy()
    expect(screen.getByText('tokens.color.gone')).toBeTruthy()
    expect(screen.queryByText('tokens.color.primary')).toBeNull()
    const row = document.querySelector('[data-path="tokens.color.primary"]')
    expect(row.textContent).toContain('This color can’t be transparent. Choose an opaque one. It was saved before this version of the website and is dropped when you save.')
    cleanup()
    renderEditor({ theme: editorTheme({ invalid }), editCount: 1, edits: { tokens: { color: { primary: '#00AA00' } } } })
    expect(screen.getByText(/^1 saved value isn’t valid/)).toBeTruthy()
    expect(document.querySelector('[data-path="tokens.color.primary"]').textContent).not.toContain('dropped when you save')
  })

  it('says apart the saved values set to the closest limit and those dropped', () => {
    const invalid = [
      { path: 'tokens.color.gone', code: 'tokens.color.gone.unknown' },
      { path: 'tokens.typography.h1.size', code: 'tokens.typography.h1.size.out_of_range' },
      { path: 'components.gone.base.height', code: 'components.gone.base.height.out_of_range' }
    ]
    renderEditor({ theme: editorTheme({ invalid }) })
    expect(screen.getByText(/^1 saved value isn’t valid in this version of the website/)).toBeTruthy()
    expect(screen.getByText('2 saved values are outside the range this version of the website takes: they were set to the closest limit, and they’re saved like that when you save. The editor marks them where it shows them.')).toBeTruthy()
    expect(screen.getByText('components.gone.base.height')).toBeTruthy()
    expect(screen.queryByText('tokens.typography.h1.size')).toBeNull()
  })

  it('lists what a save refused where the editor shows nothing, and says so', async () => {
    const errors = [{ path: 'tokens.color.gone', code: 'tokens.color.gone.unknown' }]
    renderEditor({
      editCount: 1,
      edits: { tokens: { color: { primary: '#00AA00' } } },
      fieldErrors: { 'tokens.color.gone': 'tokens.color.gone.unknown' },
      saveDraft: vi.fn(async () => ({ ok: false, errorCodes: ['theme.invalid'], errors }))
    })
    const alert = screen.getByText('The website didn’t take these values, which aren’t in the editor:').closest('[role="alert"]')
    expect(alert.textContent).toContain('tokens.color.gone · tokens.color.gone.unknown')
    await click(screen.getByRole('button', { name: 'Save draft' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'Some values aren’t valid and the editor doesn’t show them. They’re listed above the editor.')
  })

  it('says a preset this version no longer takes can’t be applied', async () => {
    renderEditor({ resetToPreset: vi.fn(async () => ({ ok: false, errorCodes: ['preset.incompatible'], errors: [] })) })
    await click(screen.getByRole('button', { name: 'Reset to preset' }))
    await click(screen.getByRole('button', { name: 'The whole theme' }))
    await click(within(screen.getByRole('dialog', { name: 'Reset the whole theme to the preset?' })).getByRole('button', { name: 'Reset' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'This preset was made for an earlier version of the website, so it can’t be applied. The draft didn’t change.')
  })

  it('opens the section of the first value the API refused', () => {
    renderEditor({ fieldErrors: { 'platforms.mobile_web.components.tabs.base.text': 'invalid' } })
    expect(screen.getByRole('heading', { level: 2, name: 'Components' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Tabs' })).toBeTruthy()
  })

  it('says when the website’s schema isn’t in the new format yet', () => {
    renderEditor({ schema: { tokens: { color: { primary: ['color', '#2C7BE5'] } } } })
    expect(screen.getByText('The editor for this website isn’t ready yet')).toBeTruthy()
  })
})

describe('Theme editor links', () => {
  const at = (search) => window.history.replaceState(null, '', `/builder/45${search}`)
  const sectionsNav = () => screen.getByRole('navigation', { name: 'Theme sections' })
  const query = () => Object.fromEntries(new URLSearchParams(window.location.search))
  /** Clicks a link and tells whether the browser would follow it (a new tab), or the editor opened it in place. */
  const clickLink = async (link, init) => {
    let followed
    const watch = (e) => { followed = !e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', watch)
    await act(async () => { fireEvent.click(link, init) })
    window.removeEventListener('click', watch)
    return followed
  }

  beforeEach(() => { at('?tab=theme&theme=10') })

  it('opens the section and the component of the URL', () => {
    at('?tab=theme&theme=10&section=components&item=components.input')
    renderEditor()
    expect(screen.getByRole('heading', { level: 2, name: 'Components' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Field' })).toBeTruthy()
    expect(within(sectionsNav()).getByRole('link', { name: 'Components' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('link', { name: 'Field' }).getAttribute('aria-current')).toBe('true')
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'components', item: 'components.input' })
  })

  it('opens a page of the URL without its section, in the section that has it', () => {
    at('?tab=theme&theme=10&item=pages.checkout')
    renderEditor()
    expect(screen.getByRole('heading', { level: 2, name: 'Pages' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Checkout' })).toBeTruthy()
    expect(query()).toMatchObject({ section: 'pages', item: 'pages.checkout' })
  })

  it('opens the first section, or the first component, for a section or item it doesn’t have', () => {
    at('?tab=theme&theme=10&section=nope&item=components.nope')
    renderEditor()
    expect(screen.getByRole('heading', { level: 2, name: 'Colors' })).toBeTruthy()
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'colors' })
    cleanup()

    at('?tab=theme&theme=10&section=components&item=pages.home')
    renderEditor()
    expect(screen.getByRole('heading', { level: 2, name: 'Components' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Button' })).toBeTruthy()
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'components', item: 'components.button' })
  })

  it('links every section, component and page, and the URL follows what is open', async () => {
    renderEditor()
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'colors' })
    const components = within(sectionsNav()).getByRole('link', { name: 'Components' })
    expect(components.getAttribute('href')).toBe('/builder/45?tab=theme&theme=10&section=components')
    expect(await clickLink(components)).toBe(false)
    expect(screen.getByRole('heading', { level: 2, name: 'Components' })).toBeTruthy()
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'components', item: 'components.button' })

    const field = screen.getByRole('link', { name: 'Field' })
    expect(field.getAttribute('href')).toBe('/builder/45?tab=theme&theme=10&section=components&item=components.input')
    expect(await clickLink(field)).toBe(false)
    expect(screen.getByRole('heading', { level: 3, name: 'Field' })).toBeTruthy()
    expect(query().item).toBe('components.input')

    // Back in a section of cards, no component in the URL
    expect(within(sectionsNav()).getByRole('link', { name: 'Typography' }).getAttribute('href')).toBe('/builder/45?tab=theme&theme=10&section=typography')
    await clickLink(within(sectionsNav()).getByRole('link', { name: 'Typography' }))
    expect(query()).toEqual({ tab: 'theme', theme: '10', section: 'typography' })
  })

  it('leaves Cmd, Ctrl or Shift clicks to the browser (a new tab or window)', async () => {
    renderEditor()
    const pages = within(sectionsNav()).getByRole('link', { name: 'Pages' })
    expect(await clickLink(pages, { metaKey: true })).toBe(true)
    expect(await clickLink(pages, { ctrlKey: true })).toBe(true)
    expect(await clickLink(pages, { shiftKey: true })).toBe(true)
    expect(screen.getByRole('heading', { level: 2, name: 'Colors' })).toBeTruthy()
    expect(query().section).toBe('colors')
  })
})
