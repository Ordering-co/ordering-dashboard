import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  getBuilderThemeSchema: vi.fn(),
  getBuilderTheme: vi.fn(),
  saveBuilderThemeDraft: vi.fn(),
  publishBuilderTheme: vi.fn(),
  discardBuilderThemeDraft: vi.fn(),
  resetBuilderTheme: vi.fn(),
  renameBuilderTheme: vi.fn(),
  resolveBuilderTheme: vi.fn(),
  uploadBuilderThemeImage: vi.fn(),
  listBuilderThemes: vi.fn(),
  listBuilderThemePresets: vi.fn(),
  createBuilderTheme: vi.fn(),
  activateBuilderTheme: vi.fn(),
  deleteBuilderTheme: vi.fn()
}))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'http://api/v400/en/development' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'tok' }] }))
vi.mock('../builderApi', async () => {
  const actual = await vi.importActual('../builderApi')
  const wrapped = Object.fromEntries(Object.keys(api).map(name => [name, (...args) => api[name](...args)]))
  return { ...actual, ...wrapped }
})

import { BuilderThemeEditor, countThemeEdits } from '../BuilderThemeEditor'
import { BuilderProductThemes } from '../BuilderProductThemes'

const ok = (result) => ({ error: false, status: 200, result, errorCodes: [] })
const fail = (status, errorCodes, extra = {}) => ({ error: true, status, result: ['x'], errorCodes, ...extra })
const theme = (extra = {}) => ({
  id: 10,
  name: 'Summer',
  active: true,
  version: 2,
  preset: null,
  has_draft: false,
  values: { tokens: { color: { primary: '#FF5500' } } },
  draft_values: null,
  resolved: { tokens: { color: { primary: '#FF5500' } } },
  ...extra
})

const renderEditor = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<BuilderThemeEditor UIComponent={UIComponent} productId={45} themeId={10} {...props} />)
  await waitFor(() => expect(ui.current.themeState.loading).toBe(false))
  return ui
}

describe('BuilderThemeEditor controller', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.getBuilderThemeSchema.mockResolvedValue(ok({ schema: { editor: { sections: [] }, components: {} } }))
    api.getBuilderTheme.mockResolvedValue(ok(theme()))
  })

  it('loads the schema and the theme, and edits the published values without a draft', async () => {
    const ui = await renderEditor()
    expect(api.getBuilderThemeSchema).toHaveBeenCalledWith(expect.anything(), 'tok', 45)
    expect(api.getBuilderTheme).toHaveBeenCalledWith(expect.anything(), 'tok', 45, 10)
    expect(ui.current.schemaState.schema.editor).toEqual({ sections: [] })
    expect(ui.current.current).toEqual({ tokens: { color: { primary: '#FF5500' } } })
  })

  it('resolves the theme a moment after the last change, the theme’s own without changes', async () => {
    api.getBuilderTheme.mockResolvedValue(ok(theme({ sources: { 'tokens.color.primary': 'own' } })))
    api.resolveBuilderTheme.mockResolvedValue(ok({ resolved: { tokens: { color: { primary: '#00AA00' } } }, sources: { 'tokens.color.primary': 'own' } }))
    const ui = await renderEditor()
    expect(ui.current.resolution).toEqual({ resolved: { tokens: { color: { primary: '#FF5500' } } }, sources: { 'tokens.color.primary': 'own' }, aliases: {}, loading: false, error: false })
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00CC00'))
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00AA00'))
    expect(api.resolveBuilderTheme).not.toHaveBeenCalled()
    await waitFor(() => expect(ui.current.resolution.resolved.tokens.color.primary).toBe('#00AA00'))
    expect(api.resolveBuilderTheme).toHaveBeenCalledTimes(1)
    expect(api.resolveBuilderTheme).toHaveBeenCalledWith(expect.anything(), 'tok', 45, 10, { tokens: { color: { primary: '#00AA00' } } })
  })

  it('keeps changes until they are saved, and drops one that goes back to the saved value', async () => {
    const ui = await renderEditor()
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00AA00'))
    act(() => ui.current.setValue(['components', 'button', 'colors', 'primary', 'on'], '{color.on_primary}'))
    expect(ui.current.edits).toEqual({
      tokens: { color: { primary: '#00AA00' } },
      components: { button: { colors: { primary: { on: '{color.on_primary}' } } } }
    })
    expect(ui.current.editCount).toBe(2)

    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#FF5500'))
    expect(ui.current.edits).toEqual({ components: { button: { colors: { primary: { on: '{color.on_primary}' } } } } })
    expect(api.saveBuilderThemeDraft).not.toHaveBeenCalled()
  })

  it('sends the changes to the draft and takes the answer as the theme', async () => {
    api.saveBuilderThemeDraft.mockResolvedValueOnce(ok(theme({ has_draft: true, draft_values: { tokens: { color: { primary: '#00AA00' } } } })))
    const ui = await renderEditor()
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00AA00'))
    let answer
    await act(async () => { answer = await ui.current.saveDraft() })
    expect(api.saveBuilderThemeDraft).toHaveBeenCalledWith(expect.anything(), 'tok', 45, 10, { tokens: { color: { primary: '#00AA00' } } })
    expect(answer).toEqual({ ok: true, errorCodes: [], errors: [] })
    expect(ui.current.edits).toEqual({})
    expect(ui.current.current).toEqual({ tokens: { color: { primary: '#00AA00' } } })
  })

  it('saves a theme shown converted with no changes, and nothing else without them', async () => {
    api.getBuilderTheme.mockResolvedValue(ok(theme({ upgraded_from: '26.1.0', schema_version: '27.0.0' })))
    api.saveBuilderThemeDraft.mockResolvedValueOnce(ok(theme({ has_draft: true, upgraded_from: null })))
    const ui = await renderEditor()
    await act(async () => { await ui.current.saveDraft() })
    expect(api.saveBuilderThemeDraft).toHaveBeenCalledWith(expect.anything(), 'tok', 45, 10, {})
    expect(ui.current.themeState.theme.upgraded_from).toBeNull()
    let answer
    await act(async () => { answer = await ui.current.saveDraft() })
    expect(answer).toEqual({ ok: true, errorCodes: [], errors: [] })
    expect(api.saveBuilderThemeDraft).toHaveBeenCalledTimes(1)
  })

  it('sends null to take a default back', async () => {
    api.saveBuilderThemeDraft.mockResolvedValueOnce(ok(theme()))
    const ui = await renderEditor()
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], null))
    await act(async () => { await ui.current.saveDraft() })
    expect(api.saveBuilderThemeDraft.mock.calls[0][4]).toEqual({ tokens: { color: { primary: null } } })
  })

  it('marks the values the API refuses and keeps the changes', async () => {
    const errors = [{ path: 'components.button.base.radius', code: 'components.button.base.radius.invalid' }]
    api.saveBuilderThemeDraft.mockResolvedValueOnce(fail(400, ['theme.invalid'], { errors }))
    const ui = await renderEditor()
    act(() => ui.current.setValue(['components', 'button', 'base', 'radius'], 4))
    let answer
    await act(async () => { answer = await ui.current.saveDraft() })
    expect(answer).toEqual({ ok: false, errorCodes: ['theme.invalid'], errors })
    expect(ui.current.fieldErrors).toEqual({ 'components.button.base.radius': 'components.button.base.radius.invalid' })
    expect(ui.current.editCount).toBe(1)

    act(() => ui.current.setValue(['components', 'button', 'base', 'radius'], '{radius.full}'))
    expect(ui.current.fieldErrors).toEqual({})
  })

  it('saves what is pending before publishing, and stops if saving fails', async () => {
    api.saveBuilderThemeDraft.mockResolvedValueOnce(ok(theme({ has_draft: true })))
    api.publishBuilderTheme.mockResolvedValueOnce(ok(theme()))
    const ui = await renderEditor()
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00AA00'))
    await act(async () => { await ui.current.publish() })
    expect(api.saveBuilderThemeDraft).toHaveBeenCalledTimes(1)
    expect(api.publishBuilderTheme).toHaveBeenCalledWith(expect.anything(), 'tok', 45, 10)

    api.saveBuilderThemeDraft.mockResolvedValueOnce(fail(400, ['theme.invalid'], { errors: [] }))
    act(() => ui.current.setValue(['tokens', 'color', 'primary'], 'nope'))
    await act(async () => { await ui.current.publish() })
    expect(api.publishBuilderTheme).toHaveBeenCalledTimes(1)
  })

  it('resets the sections in one call, more than one call takes in turns, and renames keeping the changes', async () => {
    api.resetBuilderTheme.mockResolvedValue(ok(theme()))
    api.renameBuilderTheme.mockResolvedValueOnce(ok(theme({ name: 'Night' })))
    const ui = await renderEditor()
    await act(async () => { await ui.current.resetToPreset(['components.button.base.radius', 'components.input.base.radius']) })
    expect(api.resetBuilderTheme.mock.calls.map(call => call[4])).toEqual([['components.button.base.radius', 'components.input.base.radius']])
    api.resetBuilderTheme.mockClear()
    const many = Array.from({ length: 501 }, (_, index) => `visibility.key_${index}`)
    await act(async () => { await ui.current.resetToPreset(many) })
    expect(api.resetBuilderTheme.mock.calls.map(call => call[4].length)).toEqual([500, 1])

    act(() => ui.current.setValue(['tokens', 'color', 'primary'], '#00AA00'))
    await act(async () => { await ui.current.rename('Night') })
    expect(ui.current.themeState.theme.name).toBe('Night')
    expect(ui.current.editCount).toBe(1)
  })

  it('sets an uploaded image as a change', async () => {
    api.uploadBuilderThemeImage.mockResolvedValueOnce(ok({ url: 'https://cdn/logo.png' }))
    const ui = await renderEditor()
    const file = new File(['x'], 'logo.png')
    await act(async () => { await ui.current.uploadImage('logo', file) })
    expect(api.uploadBuilderThemeImage.mock.calls[0].slice(4)).toEqual(['logo', file])
    expect(ui.current.edits).toEqual({ images: { logo: 'https://cdn/logo.png' } })
  })

  it('answers what a refused image broke', async () => {
    api.uploadBuilderThemeImage.mockResolvedValueOnce({ error: true, errorCodes: ['file.too_large'], maxBytes: 5000000 })
    const ui = await renderEditor()
    let answer
    await act(async () => { answer = await ui.current.uploadImage('logo', new File(['x'], 'logo.png')) })
    expect(answer).toEqual({ ok: false, errorCodes: ['file.too_large'], limits: { formats: undefined, maxBytes: 5000000, maxSide: undefined, maxPixels: undefined } })
    expect(ui.current.edits).toEqual({})
  })

  it('counts a border, a shadow or a typography style as one change', () => {
    expect(countThemeEdits({
      tokens: { typography: { h1: { size: 30, line: 38, weight: 600 } }, shadow: { sm: { x: 0, y: 1, blur: 4, color: '#000000', opacity: 0.1 } } },
      components: { button: { appearances: { outline: { border: { width: '{border.thick}', color: '{ink}', style: 'dashed' } } } } },
      visibility: { 'menu.wallet': true }
    })).toBe(4)
  })
})

describe('BuilderProductThemes controller', () => {
  beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset())
    api.listBuilderThemes.mockResolvedValue(ok([theme()]))
  })

  const renderList = async () => {
    const ui = { current: null }
    const UIComponent = (uiProps) => { ui.current = uiProps; return null }
    render(<BuilderProductThemes UIComponent={UIComponent} productId={45} />)
    await waitFor(() => expect(ui.current.themesState.loading).toBe(false))
    return ui
  }

  it('creates a theme and reads the list again', async () => {
    api.createBuilderTheme.mockResolvedValueOnce(ok(theme({ id: 11, active: false })))
    const ui = await renderList()
    let answer
    await act(async () => { answer = await ui.current.createTheme({ name: 'Night', source: 'blank' }) })
    expect(api.createBuilderTheme).toHaveBeenCalledWith(expect.anything(), 'tok', 45, { name: 'Night', source: 'blank' })
    expect(answer.ok).toBe(true)
    expect(answer.theme.id).toBe(11)
    expect(api.listBuilderThemes).toHaveBeenCalledTimes(2)
  })

  it('answers the refusal codes', async () => {
    api.deleteBuilderTheme.mockResolvedValueOnce(fail(400, ['theme.active']))
    const ui = await renderList()
    let answer
    await act(async () => { answer = await ui.current.deleteTheme(10) })
    expect(answer).toEqual({ ok: false, errorCodes: ['theme.active'], theme: null })
  })

  it('reads the presets once', async () => {
    api.listBuilderThemePresets.mockResolvedValue(ok([]))
    const ui = await renderList()
    await act(async () => { await ui.current.getPresets() })
    await act(async () => { await ui.current.getPresets() })
    expect(api.listBuilderThemePresets).toHaveBeenCalledTimes(1)
    expect(ui.current.presetsState).toEqual({ loading: false, loaded: true, presets: [], error: false })
  })
})
