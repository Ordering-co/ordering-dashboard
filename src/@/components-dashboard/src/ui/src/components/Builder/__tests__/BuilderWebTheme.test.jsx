import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
// redesign B3a: the themes list, the create panel and the editor shell no longer import `../../../styles`, `../../Shared`
// nor `../../Shared/SideBar`: their mocks went, and the assertions follow the Product markup (alertdialog, dialog, radio, menuitem).
// The schema editor inside is on Product pieces too since B3b, unmocked.

import { BuilderThemeEditorView, BuilderWebThemes } from '../BuilderWebTheme'
import { CreateThemePanel } from '../BuilderWebTheme/CreateThemePanel'

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

// redesign B3a: «Reset to preset» is a P/Menu: its items are menuitems in a popup that opens on a real press
const chooseReset = async (name) => {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reset to preset' }))
  await click(within(await screen.findByRole('menu')).getByRole('menuitem', { name }))
}

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
    // redesign B3a: P/ConfirmDialog (alertdialog)
    const dialog = await screen.findByRole('alertdialog', { name: 'Activate Summer 2026?' })
    expect(within(dialog).getByText(/Its unpublished changes stay in the editor/)).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(state.list.activateTheme).toHaveBeenCalledWith(10)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Summer 2026 is active. Your website shows it within 5 minutes.')
  })

  it('deletes an inactive theme after confirming', async () => {
    renderList()
    await click(screen.getByRole('button', { name: 'Delete Summer 2026' }))
    // redesign B3a: P/ConfirmDialog (alertdialog)
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Summer 2026?' })
    expect(within(dialog).getByText('You can’t undo this.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(state.list.deleteTheme).toHaveBeenCalledWith(10)
  })

  // review of B3a: the dialog stays mounted while it fades out; a second press then must not send the request again
  it('deletes once when Delete is pressed twice', async () => {
    renderList()
    await click(screen.getByRole('button', { name: 'Delete Summer 2026' }))
    const button = within(await screen.findByRole('alertdialog', { name: 'Delete Summer 2026?' })).getByRole('button', { name: 'Delete' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(state.list.deleteTheme).toHaveBeenCalledTimes(1))
  })

  // review of B3a: nothing closes while a theme is created, so Cancel says it (disabled) instead of doing nothing
  it('disables Cancel while it creates', () => {
    renderWithProviders(
      <CreateThemePanel
        hasActive
        initialSource='current'
        presetsState={{ loading: false, loaded: true, presets: [], error: false }}
        getPresets={vi.fn()}
        createState={{ loading: true }}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(within(screen.getByRole('dialog', { name: 'New theme' })).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('stops creating at 5 themes', () => {
    renderList({ themesState: { loading: false, error: false, themes: [v1, summer, { ...summer, id: 11 }, { ...summer, id: 12 }, { ...summer, id: 13 }] } })
    const create = screen.getByRole('button', { name: /New theme/ })
    expect(create.disabled).toBe(true)
    expect(screen.getByText('You already have 5 themes. Delete one to create another.')).toBeTruthy()
    // The reason is read with the disabled button
    expect(document.getElementById(create.getAttribute('aria-describedby')).textContent).toBe('You already have 5 themes. Delete one to create another.')
  })

  it('asks for a name before creating, and opens the new theme', async () => {
    const { onEditTheme } = renderList()
    await click(screen.getByRole('button', { name: /New theme/ }))
    // redesign B3a: a P/Sheet (dialog) named by its title; the sources are P/RadioGroup radios, checked by aria-checked
    const panel = screen.getByRole('dialog', { name: 'New theme' })
    expect(state.list.getPresets).toHaveBeenCalled()
    expect(within(panel).getByText('There are no presets for this kind of website yet.')).toBeTruthy()
    expect(within(panel).getByRole('radio', { name: 'Your current theme' }).getAttribute('aria-checked')).toBe('true')

    await click(within(panel).getByRole('button', { name: 'Create and edit' }))
    expect(state.list.createTheme).not.toHaveBeenCalled()
    expect(within(panel).getByRole('alert').textContent).toBe('Enter a name.')

    // redesign B3a: the label carries P/TextField's required mark, as main's input was `required`
    fireEvent.change(within(panel).getByLabelText(/^Name/), { target: { value: '  Night menu ' } })
    fireEvent.click(within(panel).getByRole('radio', { name: 'From scratch' }))
    await click(within(panel).getByRole('button', { name: 'Create and edit' }))
    expect(state.list.createTheme).toHaveBeenCalledWith({ name: 'Night menu', source: 'blank', presetId: null })
    expect(onEditTheme).toHaveBeenCalledWith(11)
  })

  it('says when the limit was reached meanwhile', async () => {
    renderList({ createTheme: vi.fn(async () => ({ ok: false, errorCodes: ['theme.limit'], theme: null })) })
    await click(screen.getByRole('button', { name: /New theme/ }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Night' } }) // redesign B3a: the required mark
    await click(screen.getByRole('button', { name: 'Create and edit' }))
    expect(screen.getByRole('alert').textContent).toBe('You already have 5 themes. Delete one to create another.')
  })
})

// redesign B3a: the themes list and the create panel on Product pieces, with every state of main
describe('Saved themes on Product pieces', () => {
  beforeEach(() => { state.showToast.mockReset() })

  it('shows a skeleton while the themes load', () => {
    renderList({ themesState: { loading: true, error: false, themes: [] } })
    const busy = document.querySelector('[aria-busy="true"]')
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })

  it('announces a failed load and tries again', async () => {
    renderList({ themesState: { loading: false, error: true, themes: [] } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'We couldn’t load the themes' })).toBeTruthy()
    expect(within(alert).getByText('Check your connection and try again.')).toBeTruthy()
    await click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(state.list.reloadThemes).toHaveBeenCalled()
  })

  it('draws the rows with Product badges and buttons, and the notice below', () => {
    renderList({ themesState: { loading: false, error: false, themes: [v1, { ...summer, upgraded_from: '26.1.0' }] } })
    const card = screen.getByRole('region', { name: 'Saved themes' })
    expect(within(card).getByText('Active').closest('.odc-badge').dataset.family).toBe('done')
    expect(within(card).getByText('Unpublished changes').closest('.odc-badge').dataset.family).toBe('pending')
    expect(within(card).getByText('Converted from 26.1.0').closest('.odc-bt-converted')).toBeTruthy()
    const remove = within(card).getByRole('button', { name: 'Delete Summer 2026' })
    expect(remove.classList.contains('odc-btn')).toBe(true)
    expect(remove.getAttribute('title')).toBe('Delete')
    expect(screen.getByRole('button', { name: /New theme/ }).classList.contains('odc-btn')).toBe(true)
    expect(screen.getByText('Activating a theme changes your website for everyone')).toBeTruthy()
    expect(screen.getByText(/Customers see it within 5 minutes/)).toBeTruthy()
  })

  it('says no theme is saved yet', () => {
    renderList({ themesState: { loading: false, error: false, themes: [] } })
    expect(screen.getByText('This website has no saved themes yet. Create one to change how it looks.')).toBeTruthy()
    expect(screen.getByText('0 of 5')).toBeTruthy()
  })

  it('locks the actions while a theme activates, and says which one', () => {
    renderList({ themeAction: { type: 'activate', themeId: 10 } })
    const activate = screen.getByRole('button', { name: 'Activate: Summer 2026' })
    expect(activate.textContent).toBe('Activating…')
    expect(activate.disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Delete Summer 2026' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /New theme/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Create a new theme from this one' }).disabled).toBe(true)
  })

  it('activates a theme without a draft with its own text, and says when it failed', async () => {
    renderList({
      themesState: { loading: false, error: false, themes: [v1, { ...summer, has_draft: false }] },
      activateTheme: vi.fn(async () => ({ ok: false, errorCodes: [] }))
    })
    await click(screen.getByRole('button', { name: 'Activate: Summer 2026' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Activate Summer 2026?' })
    expect(within(dialog).getByText('Your customers see it within 5 minutes, instead of the current theme.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t activate it. Try again.')
  })

  it('says an active theme can’t be deleted', async () => {
    renderList({ deleteTheme: vi.fn(async () => ({ ok: false, errorCodes: ['theme.active'] })) })
    await click(screen.getByRole('button', { name: 'Delete Summer 2026' }))
    await click(within(await screen.findByRole('alertdialog', { name: 'Delete Summer 2026?' })).getByRole('button', { name: 'Delete' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'Activate another theme before deleting this one.')
  })

  it('starts a new theme from the previous version one, or from a preset with its preview', async () => {
    const presets = [{ id: 7, name: 'Bold', version: 2, preview: 'https://cdn.test/bold.png' }, { id: 8, name: 'Plain', version: 1, preview: null }]
    renderList({ presetsState: { loading: false, loaded: true, presets, error: false } })
    await click(screen.getByRole('button', { name: 'Create a new theme from this one' }))
    const panel = screen.getByRole('dialog', { name: 'New theme' })
    expect(within(panel).getByRole('radio', { name: 'Your current theme' }).getAttribute('aria-checked')).toBe('true')
    const bold = within(panel).getByRole('radio', { name: 'Bold' })
    expect(bold.querySelector('img').getAttribute('src')).toBe('https://cdn.test/bold.png')
    expect(bold.textContent).toContain('Version 2')
    expect(within(panel).getByText('0/100')).toBeTruthy()
    fireEvent.click(bold)
    expect(bold.getAttribute('aria-checked')).toBe('true')
    expect(within(panel).getByRole('radio', { name: 'Your current theme' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.change(within(panel).getByLabelText(/^Name/), { target: { value: 'Bold menu' } })
    expect(within(panel).getByText('9/100')).toBeTruthy()
    await click(within(panel).getByRole('button', { name: 'Create and edit' }))
    expect(state.list.createTheme).toHaveBeenCalledWith({ name: 'Bold menu', source: 'preset', presetId: 7 })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Bold menu was created')
  })

  it('offers no current theme without an active one, and says when the presets are loading or failed', async () => {
    renderList({
      themesState: { loading: false, error: false, themes: [summer] },
      presetsState: { loading: true, loaded: false, presets: [], error: false }
    })
    await click(screen.getByRole('button', { name: /New theme/ }))
    const panel = screen.getByRole('dialog', { name: 'New theme' })
    expect(within(panel).queryByRole('radio', { name: 'Your current theme' })).toBeNull()
    expect(within(panel).getByRole('radio', { name: 'From scratch' }).getAttribute('aria-checked')).toBe('true')
    expect(panel.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    cleanup()
    renderList({ presetsState: { loading: false, loaded: false, presets: [], error: true } })
    await click(screen.getByRole('button', { name: /New theme/ }))
    expect(within(screen.getByRole('dialog', { name: 'New theme' })).getByText('We couldn’t load the presets.').getAttribute('role')).toBe('alert')
  })

  it.each([
    [['preset.not_found'], 'That preset is no longer available. Choose another option.'],
    [['server'], 'We couldn’t create the theme. Try again.']
  ])('says why creating failed (%s)', async (errorCodes, text) => {
    renderList({ createTheme: vi.fn(async () => ({ ok: false, errorCodes, theme: null })) })
    await click(screen.getByRole('button', { name: /New theme/ }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Night' } })
    await click(screen.getByRole('button', { name: 'Create and edit' }))
    expect(screen.getByRole('alert').textContent).toBe(text)
  })

  it('marks the name the API refused', async () => {
    renderList({ createTheme: vi.fn(async () => ({ ok: false, errorCodes: ['name.max'], theme: null })) })
    await click(screen.getByRole('button', { name: /New theme/ }))
    const name = screen.getByLabelText(/^Name/)
    fireEvent.change(name, { target: { value: 'Night' } })
    await click(screen.getByRole('button', { name: 'Create and edit' }))
    expect(screen.getByRole('alert').textContent).toBe('Use 100 characters or fewer.')
    expect(name.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(name, { target: { value: 'Night 2' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // main's SideBar never closed on an outside click (and Escape only from 1000px), so a typed name was never lost by accident
  describe('closing the create panel with a name typed', () => {
    const openWithName = async () => {
      renderList()
      await click(screen.getByRole('button', { name: /New theme/ }))
      const panel = screen.getByRole('dialog', { name: 'New theme' })
      fireEvent.change(within(panel).getByLabelText(/^Name/), { target: { value: 'Night menu' } })
      return panel
    }

    it('asks on Escape, and «Keep editing» keeps the name', async () => {
      const panel = await openWithName()
      fireEvent.keyDown(within(panel).getByLabelText(/^Name/), { key: 'Escape' })
      const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
      fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(within(screen.getByRole('dialog', { name: 'New theme' })).getByLabelText(/^Name/).value).toBe('Night menu')
    })

    it('asks on a click on the scrim and on Cancel, and «Discard» closes', async () => {
      const panel = await openWithName()
      fireEvent.click(document.querySelector('.odc-overlay-backdrop'))
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
      fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New theme' })).toBeNull())
    })

    it('closes at once when nothing is typed', async () => {
      renderList()
      await click(screen.getByRole('button', { name: /New theme/ }))
      fireEvent.click(within(screen.getByRole('dialog', { name: 'New theme' })).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New theme' })).toBeNull())
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('closes nothing while it creates', async () => {
      const panel = await openWithName()
      state.list.createTheme.mockImplementation(() => new Promise(() => {}))
      await click(within(panel).getByRole('button', { name: 'Create and edit' }))
      fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
      await act(async () => {})
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(screen.getByRole('dialog', { name: 'New theme' })).toBeTruthy()
      expect(state.list.createTheme).toHaveBeenCalledTimes(1)
    })
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
    // redesign B3a: P/ConfirmDialog (alertdialog); its cancel is «Stay», as main's
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    expect(within(dialog).getByRole('button', { name: 'Stay' })).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Leave' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('discards the draft after confirming', async () => {
    renderEditor({ theme: editorTheme({ has_draft: true }) })
    await click(screen.getByRole('button', { name: 'Discard draft' }))
    await click(within(await screen.findByRole('alertdialog', { name: 'Discard the draft?' })).getByRole('button', { name: 'Discard draft' }))
    expect(state.editor.discardDraft).toHaveBeenCalled()
  })

  it('resets the section open to the preset, a component with its platforms', async () => {
    renderEditor()
    // redesign B3a: menuitems of P/Menu and a P/ConfirmDialog (alertdialog)
    await chooseReset('Only this section')
    await click(within(await screen.findByRole('alertdialog', { name: 'Reset this section to the preset?' })).getByRole('button', { name: 'Reset' }))
    expect(state.editor.resetToPreset).toHaveBeenCalledWith(['tokens.color', 'tokens.opacity.scrim'])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await click(within(screen.getByRole('navigation', { name: 'Theme sections' })).getByRole('link', { name: 'Components' }))
    await chooseReset('Only this section')
    await click(within(await screen.findByRole('alertdialog', { name: 'Reset this section to the preset?' })).getByRole('button', { name: 'Reset' }))
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
    // redesign B3a: menuitems of P/Menu and a P/ConfirmDialog (alertdialog)
    await chooseReset('The whole theme')
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset the whole theme to the preset?' })
    expect(within(dialog).getByText('The draft takes the values of Classic. Nothing changes on your website until you publish.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(state.editor.resetToPreset).toHaveBeenCalledWith([])
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

// redesign B3a: the editor shell on Product pieces, with every state of main
describe('Theme editor on Product pieces', () => {
  beforeEach(() => {
    state.showToast.mockReset()
    window.history.replaceState(null, '', '/builder/45?tab=theme&theme=10')
  })

  it('shows a skeleton while the theme or the schema load', () => {
    renderEditor({ themeState: { loading: true, error: false, notFound: false, theme: null } })
    const busy = document.querySelector('[aria-busy="true"]')
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
  })

  it('says a theme doesn’t exist, with only the way back', async () => {
    const { onBack } = renderEditor({ themeState: { loading: false, error: true, notFound: true, theme: null } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'This theme doesn’t exist' })).toBeTruthy()
    expect(within(alert).getByText('It may have been deleted.')).toBeTruthy()
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull()
    await click(within(alert).getByRole('button', { name: 'Back to themes' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('announces a failed load and tries again', async () => {
    renderEditor({ themeState: { loading: false, error: true, notFound: false, theme: null } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'We couldn’t load this theme' })).toBeTruthy()
    await click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(state.editor.reload).toHaveBeenCalled()
  })

  it('sends a theme of the previous editor back to the list', async () => {
    const { onBack } = renderEditor({ theme: editorTheme({ version: 1 }) })
    expect(screen.getByRole('heading', { name: 'This theme was made with the previous editor' })).toBeTruthy()
    expect(screen.getByText('Create a new theme from it to edit it here.')).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Back to themes' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('draws the header and the save bar with Product pieces', () => {
    renderEditor({ editCount: 1, edits: { tokens: { color: { primary: '#00AA00' } } } })
    expect(screen.getByText('Not active').closest('.odc-badge').dataset.family).toBe('cancel')
    expect(screen.getByText('Unpublished changes').closest('.odc-badge').dataset.family).toBe('pending')
    expect(screen.getByText('Based on Classic v3 · This theme isn’t active, so publishing doesn’t change your website until you activate it.')).toBeTruthy()
    const bar = screen.getByRole('region', { name: 'Save and publish' })
    expect(within(bar).getByRole('button', { name: 'Publish' }).classList.contains('odc-btn')).toBe(true)
    // With changes not saved, the preset can't be applied yet: the trigger says why
    const reset = within(bar).getByRole('button', { name: 'Reset to preset' })
    expect(reset.disabled).toBe(true)
    expect(reset.getAttribute('title')).toBe('Save or discard your changes first.')
    expect(within(bar).getByRole('button', { name: 'Discard draft' })).toBeTruthy()
  })

  it('says when the draft was saved, and an active theme’s own texts', async () => {
    renderEditor({ theme: editorTheme({ active: true, has_draft: true }) })
    expect(screen.getByText('Active').closest('.odc-badge').dataset.family).toBe('done')
    expect(screen.getByRole('status').textContent).toBe('No unsaved changes · Draft saved 2026-10-09 10:42:00')
    // Publish asks nothing, as main
    await click(screen.getByRole('button', { name: 'Publish' }))
    expect(state.editor.publish).toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Published. Your website shows it within 5 minutes.')
  })

  it('renames the theme, and leaves the rename with Escape', async () => {
    renderEditor()
    await click(screen.getByRole('button', { name: 'Rename theme' }))
    let input = screen.getByRole('textbox', { name: 'Theme name' })
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox', { name: 'Theme name' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Summer 2026' })).toBeTruthy()

    await click(screen.getByRole('button', { name: 'Rename theme' }))
    input = screen.getByRole('textbox', { name: 'Theme name' })
    fireEvent.change(input, { target: { value: '  ' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(state.editor.rename).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Enter a name.')
    fireEvent.change(input, { target: { value: ' Winter ' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(state.editor.rename).toHaveBeenCalledWith('Winter')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Renamed to Winter')
  })

  it('says why a rename was refused, and shows it saving', async () => {
    renderEditor({ rename: vi.fn(async () => ({ ok: false, errorCodes: ['name.max'] })) })
    await click(screen.getByRole('button', { name: 'Rename theme' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Theme name' }), { target: { value: 'Winter' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toBe('Use 100 characters or fewer.')
    cleanup()
    renderEditor({ editorAction: 'rename' })
    await click(screen.getByRole('button', { name: 'Rename theme' }))
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
  })

  it('warns before the page unloads with changes not saved', () => {
    renderEditor({ editCount: 1, edits: { tokens: { color: { primary: '#00AA00' } } } })
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('says when saving or publishing failed, or discarding', async () => {
    renderEditor({
      theme: editorTheme({ has_draft: true }),
      editCount: 1,
      edits: { tokens: { color: { primary: '#00AA00' } } },
      saveDraft: vi.fn(async () => ({ ok: false, errorCodes: [] })),
      publish: vi.fn(async () => ({ ok: false, errorCodes: [] })),
      discardDraft: vi.fn(async () => ({ ok: false, errorCodes: [] }))
    })
    await click(screen.getByRole('button', { name: 'Save draft' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t save it. Try again.')
    await click(screen.getByRole('button', { name: 'Publish' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t publish it. Try again.')
    await click(screen.getByRole('button', { name: 'Discard draft' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard the draft?' })
    expect(within(dialog).getByText('The theme goes back to what you last published. Changes you haven’t saved are lost too.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Discard draft' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t discard the draft. Try again.')
  })
})

describe('Themes of an app with themes (has_themes)', () => {
  const app = { id: 46, name: 'Burger Town app', kind: 'app', product_type: 'marketplace_app', has_themes: true }
  const spring = { ...summer, id: 12, name: 'Spring', active: true, has_draft: false }
  const newThemePanel = () => screen.getByRole('dialog', { name: 'New theme' })

  beforeEach(() => { state.showToast.mockReset() })

  it('says the app, not the website, and that customers see it the next time they open the app', async () => {
    renderList({ product: app, themesState: { loading: false, error: false, themes: [spring, summer] } })
    expect(screen.getByText('Activating a theme changes your app for everyone')).toBeTruthy()
    expect(screen.queryByText(/website/)).toBeNull()
    await click(screen.getByRole('button', { name: 'Activate: Summer 2026' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Activate Summer 2026?' })
    expect(within(dialog).getByText('Your customers see what you published of it the next time they open the app. Its unpublished changes stay in the editor.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Activate' }))
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Summer 2026 is active. Your customers see it the next time they open the app.')
  })

  it('starts with no themes, like a website: the empty state and a new theme from scratch', async () => {
    renderList({ product: app, themesState: { loading: false, error: false, themes: [] } })
    expect(screen.getByText('This app has no saved themes yet. Create one to change how it looks.')).toBeTruthy()
    expect(screen.getByText('0 of 5')).toBeTruthy()
    await click(screen.getByRole('button', { name: /New theme/ }))
    const panel = newThemePanel()
    expect(within(panel).queryByRole('radio', { name: 'Your current theme' })).toBeNull()
    expect(within(panel).getByRole('radio', { name: 'From scratch' }).getAttribute('aria-checked')).toBe('true')
    expect(within(panel).getByText('The standard look of this kind of app.')).toBeTruthy()
  })

  it('copies its active theme of this version, said of the app', async () => {
    renderList({ product: app, themesState: { loading: false, error: false, themes: [spring] } })
    await click(screen.getByRole('button', { name: /New theme/ }))
    const panel = newThemePanel()
    expect(within(panel).getByRole('radio', { name: 'Your current theme' }).getAttribute('aria-checked')).toBe('true')
    expect(within(panel).getByText('Copies the colors, fonts and rounding your app uses now.')).toBeTruthy()
    expect(within(panel).getByText('There are no presets for this kind of app yet.')).toBeTruthy()
  })

  it('doesn’t offer to copy an active theme of the previous version, which only a website converts', async () => {
    renderList({ product: app })
    expect(screen.queryByRole('button', { name: 'Create a new theme from this one' })).toBeNull()
    await click(screen.getByRole('button', { name: /New theme/ }))
    const panel = newThemePanel()
    expect(within(panel).queryByRole('radio', { name: 'Your current theme' })).toBeNull()
    expect(within(panel).getByRole('radio', { name: 'From scratch' }).getAttribute('aria-checked')).toBe('true')
  })

  it('says when the active theme couldn’t be copied', async () => {
    renderList({ product: app, themesState: { loading: false, error: false, themes: [spring] }, createTheme: vi.fn(async () => ({ ok: false, errorCodes: ['theme.no_schema'], theme: null })) })
    await click(screen.getByRole('button', { name: /New theme/ }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Night' } })
    await click(screen.getByRole('button', { name: 'Create and edit' }))
    expect(screen.getByRole('alert').textContent).toBe('Your current theme can’t be copied. Start from scratch or from a preset.')
  })

  it('says the app in the editor', async () => {
    renderEditor({ product: app, editCount: 1, edits: { tokens: { color: { primary: '#00AA00' } } }, theme: editorTheme({ active: true }) })
    expect(screen.getByText(/Your app uses this theme: publishing changes it the next time your customers open the app\./)).toBeTruthy()
    await click(screen.getByRole('button', { name: 'Publish' }))
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Published. Your customers see it the next time they open the app.')
  })

  it('says a preset this version of the app no longer takes can’t be applied', async () => {
    renderEditor({ product: app, resetToPreset: vi.fn(async () => ({ ok: false, errorCodes: ['preset.incompatible'], errors: [] })) })
    await chooseReset('The whole theme')
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset the whole theme to the preset?' })
    expect(within(dialog).getByText('The draft takes the values of Classic. Nothing changes in your app until you publish.')).toBeTruthy()
    await click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'This preset was made for an earlier version of the app, so it can’t be applied. The draft didn’t change.')
  })

  it('says when the app’s schema isn’t in the new format yet', () => {
    renderEditor({ product: app, schema: { tokens: { color: { primary: ['color', '#2C7BE5'] } } } })
    expect(screen.getByText('The editor for this app isn’t ready yet')).toBeTruthy()
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
