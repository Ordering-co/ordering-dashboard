import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, showToast: vi.fn() }))

vi.mock('../../../../../index', () => {
  const passThrough = ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />
  return {
    BuilderAppSettings: passThrough,
    BuilderAppConstants: passThrough,
    BuilderAppCredentials: passThrough,
    ToastType: { Success: 'SUCCESS', Error: 'ERROR' },
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useToast: () => [{}, { showToast: state.showToast }]
  }
})
// redesign B2: the tab bodies are on Product pieces; the legacy styles and SideBar are no longer mocked

import { BuilderChecksPanel } from '../BuilderProductDetail/BuilderChecksPanel'
import { BuilderAppGeneral } from '../BuilderProductDetail/BuilderAppGeneral'
import { BuilderAppColors, BuilderAppFiles } from '../BuilderAppSettings'
import { BuilderAppConstantsList } from '../BuilderAppConstants'
import { BuilderAppCredentialsForm } from '../BuilderAppCredentials'

const render = (ui, props = {}) => {
  state.props = props
  return renderWithProviders(ui)
}

beforeEach(() => state.showToast.mockReset())

describe('BuilderChecksPanel', () => {
  const checks = {
    errors: 1,
    warnings: 1,
    platforms: {
      ios: { problems: [{ code: 'missing_file', level: 'warning', subject: { name: 'Icon iOS', group: 'resources_icons' } }] },
      android: { problems: [{ code: 'undefined_variable', level: 'error' }, { code: 'source_not_scanned', level: 'info' }] }
    }
  }

  it('sums up who fixes what and links the customer’s problems to their tab', () => {
    const onGoToTab = vi.fn()
    render(<BuilderChecksPanel checksState={{ loading: false, checks, error: false }} onGoToTab={onGoToTab} />)
    expect(screen.getByText('1 for you to complete · 1 for Ordering to review')).toBeTruthy()
    expect(screen.getByText('Upload Icon iOS')).toBeTruthy()
    expect(screen.getByText('Ordering is reviewing an issue in the base. It doesn’t stop your builds.')).toBeTruthy()
    // One Fix: only the customer's problem has one
    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    expect(onGoToTab).toHaveBeenCalledWith('files', 'resources_icons')
  })

  it('collapses', () => {
    render(<BuilderChecksPanel checksState={{ loading: false, checks, error: false }} onGoToTab={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Before the next build/ }))
    expect(screen.queryByText('Upload Icon iOS')).toBeNull()
  })

  it('says when nothing is missing, and offers a retry when the check fails', () => {
    const { unmount } = render(<BuilderChecksPanel checksState={{ loading: false, checks: { platforms: {} }, error: false }} />)
    expect(screen.getByText('Nothing is missing for the next build')).toBeTruthy()
    unmount()
    const reloadChecks = vi.fn()
    render(<BuilderChecksPanel checksState={{ loading: false, checks: null, error: true }} reloadChecks={reloadChecks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reloadChecks).toHaveBeenCalled()
  })

  // redesign B2: on Product pieces, with main's states, disclosure and actions
  it('draws the panel with Product pieces and keeps the disclosure state', () => {
    render(<BuilderChecksPanel checksState={{ loading: false, checks, error: false }} onGoToTab={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: /Before the next build/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('aria-controls')).toBe('builder-checks-body')
    expect(document.getElementById('builder-checks-body')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fix' }).classList.contains('odc-btn')).toBe(true)
    expect(screen.getByText('To do').closest('.odc-badge')).toBeTruthy()
    expect(screen.getByText('Ordering').closest('.odc-badge')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Show')).toBeTruthy()
  })

  it('says it is checking while the first check loads, and nothing when there is no check', () => {
    const { container, unmount } = render(<BuilderChecksPanel checksState={{ loading: true, checks: null, error: false }} />)
    expect(screen.getByText('Checking what the next build needs…')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    unmount()
    const empty = render(<BuilderChecksPanel checksState={{ loading: false, checks: null, error: false }} />)
    expect(empty.container.textContent).toBe('')
  })

  it('offers the retry as a Product button', () => {
    render(<BuilderChecksPanel checksState={{ loading: false, checks: null, error: true }} reloadChecks={vi.fn()} />)
    expect(screen.getByText('We couldn’t check what the next build needs')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' }).classList.contains('odc-btn')).toBe(true)
  })
})

describe('BuilderAppGeneral', () => {
  const app = {
    id: 35,
    name: 'Drivers',
    description: null,
    version: '0.0.1',
    package: 'com.brand.drivers',
    base: { name: 'Driver 26', platforms: ['ios', 'android'] },
    platforms: [{ platform: 'android', version: '0.0.2' }]
  }
  const renderGeneral = (overrides = {}) => {
    const props = {
      app,
      updateApp: vi.fn(async () => ({ ok: true, errorCodes: [] })),
      updatePlatform: vi.fn(async () => ({ ok: true, errorCodes: [] })),
      formatDate: () => '',
      ...overrides
    }
    render(<BuilderAppGeneral {...props} />)
    return props
  }

  it('checks the version and package before sending, and sends only what changed', async () => {
    const { updateApp } = renderGeneral()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(screen.getByText('Use a version like 1.2.0.')).toBeTruthy()
    expect(updateApp).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.0' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(updateApp).toHaveBeenCalledWith({ version: '1.0.0' })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. It applies on the next build.')
  })

  it('shows the API’s rejection next to its field', async () => {
    renderGeneral({ updateApp: vi.fn(async () => ({ ok: false, errorCodes: ['package.regex'] })) })
    fireEvent.change(screen.getByLabelText('Name in the stores'), { target: { value: 'Repartidores' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(screen.getByText('Use a reverse domain like com.brand.app.')).toBeTruthy()
  })

  it('edits a platform: an emptied field goes back to the app value as null', async () => {
    const { updatePlatform } = renderGeneral()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Android' }))
    // redesign B2: P/Sheet, named by its title
    const panel = screen.getByRole('dialog', { name: 'Android values' })
    expect(within(panel).getByLabelText('Version').value).toBe('0.0.2')
    expect(within(panel).getByLabelText('Name in the stores').placeholder).toBe('Drivers')
    fireEvent.click(within(panel).getByRole('button', { name: 'Use app value' }))
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Save' })) })
    expect(updatePlatform).toHaveBeenCalledWith('android', { version: null })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // redesign B2: on Product pieces, with main's behaviour
  it('draws the form and the platforms with Product pieces', async () => {
    renderGeneral()
    expect(screen.getByRole('form', { name: 'App' })).toBeTruthy()
    expect(screen.getByLabelText('Version').closest('.odc-field')).toBeTruthy()
    expect(screen.getByLabelText('Description').tagName).toBe('TEXTAREA')
    expect(screen.getByText('Like 1.2.0')).toBeTruthy()
    const table = screen.getByRole('table', { name: 'Platforms' })
    expect(table.classList.contains('odc-table')).toBe(true)
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('Uses app values')).toBeTruthy()
    expect(within(table).getByRole('button', { name: 'Edit iOS' }).classList.contains('odc-btn')).toBe(true)
    fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.0.0' } })
    const discard = screen.getByRole('button', { name: 'Discard' })
    expect(discard.classList.contains('odc-btn')).toBe(true)
    fireEvent.click(discard)
    expect(screen.getByLabelText('Version').value).toBe('0.0.1')
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('says a save failed that no field explains, and disables Save while saving', async () => {
    let finish
    const updateApp = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderGeneral({ updateApp })
    fireEvent.change(screen.getByLabelText('Name in the stores'), { target: { value: 'Repartidores' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save changes' })) })
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
    await act(async () => { finish({ ok: false, errorCodes: [] }) })
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t save it. Try again.')
    expect(state.showToast).not.toHaveBeenCalled()
  })

  it('closes a platform without a request when nothing changed, and Cancel drops the edits', async () => {
    const { updatePlatform } = renderGeneral()
    fireEvent.click(screen.getByRole('button', { name: 'Edit iOS' }))
    let panel = screen.getByRole('dialog', { name: 'iOS values' })
    // a platform without values of its own inherits each one; the help says so
    expect(within(panel).getAllByText('Uses the app value')).toHaveLength(4)
    expect(within(panel).queryByRole('button', { name: 'Use app value' })).toBeNull()
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Save' })) })
    expect(updatePlatform).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit iOS' }))
    panel = screen.getByRole('dialog', { name: 'iOS values' })
    fireEvent.change(within(panel).getByLabelText('Version'), { target: { value: '9' } })
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Save' })) })
    expect(within(panel).getByText('Use a version like 1.2.0.')).toBeTruthy()
    expect(updatePlatform).not.toHaveBeenCalled()
    // redesign B2 (coordinator, as the create panel of #430): Cancel with a change asks first; Discard closes
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'iOS values' })).toBeNull())
    expect(updatePlatform).not.toHaveBeenCalled()
  })

  // redesign B2 (coordinator, as the create panel of #430): main's SideBar never closed on an outside click, so the sheet
  // asks before it drops a platform's changes (Escape, the scrim, the X, Cancel); it closes at once with none
  it('asks before dropping a platform’s changes, and «Keep editing» keeps them', async () => {
    renderGeneral()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Android' }))
    const panel = screen.getByRole('dialog', { name: 'Android values' })
    fireEvent.change(within(panel).getByLabelText('Package'), { target: { value: 'com.brand.android' } })
    fireEvent.keyDown(within(panel).getByLabelText('Package'), { key: 'Escape' })
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(within(screen.getByRole('dialog', { name: 'Android values' })).getByLabelText('Package').value).toBe('com.brand.android')
    fireEvent.click(document.querySelector('.odc-overlay-backdrop'))
    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy()
  })

  // review of #433: a saved value with a trailing space or line is not a change
  it('closes at once a platform whose saved value ends in a space', async () => {
    renderGeneral({ app: { ...app, platforms: [{ platform: 'android', version: '0.0.2', name: 'Drivers Android\n' }] } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Android' }))
    fireEvent.keyDown(within(screen.getByRole('dialog', { name: 'Android values' })).getByLabelText('Name in the stores'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Android values' })).toBeNull())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('closes a platform’s sheet at once when nothing changed', async () => {
    renderGeneral()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Android' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Android values' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Android values' })).toBeNull())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('shows the API’s rejection of a platform save in the panel and keeps it open', async () => {
    renderGeneral({ updatePlatform: vi.fn(async () => ({ ok: false, errorCodes: [] })) })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Android' }))
    const panel = screen.getByRole('dialog', { name: 'Android values' })
    fireEvent.change(within(panel).getByLabelText('Package'), { target: { value: 'com.brand.android' } })
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Save' })) })
    expect(within(panel).getByText('We couldn’t save it. Try again.')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Android values' })).toBeTruthy()
  })
})

describe('BuilderAppColors and BuilderAppFiles', () => {
  const color = { id: 1, group: 'colors', kind: 'color', name: 'Primary', value: '#2C7BE5', required: true, customized: false }
  const custom = { id: 2, group: 'colors', kind: 'color', name: 'Accent', value: '#FFF', required: false, customized: true }
  const icon = { id: 3, group: 'resources_icons', kind: 'file', name: 'Icon iOS', platform: 'ios', required: true, customized: false, file_url: null, file_rules: { extension: 'png', width: 1024, height: 1024 } }
  const json = { id: 4, group: 'files', kind: 'file', name: 'google-services.json', platform: 'android', required: false, customized: true, file_url: 'https://files/x', file_rules: { extension: 'json' } }

  const settingsProps = (overrides = {}) => ({
    settingsState: { loading: false, error: false, settings: [color, custom, icon, json] },
    savingId: null,
    saveValue: vi.fn(async (id, value) => ({ setting: { id, value }, errorCodes: [] })),
    uploadFile: vi.fn(async () => ({ setting: null, errorCodes: ['file.dimensions'] })),
    resetSetting: vi.fn(async (id) => ({ setting: { id }, errorCodes: [] })),
    reloadSettings: vi.fn(),
    ...overrides
  })

  it('shows only colors, and keeps a bad hex from the API', async () => {
    const props = settingsProps()
    render(<BuilderAppColors />, props)
    expect(screen.queryByText('Icon iOS')).toBeNull()
    const input = screen.getByLabelText('Primary')
    fireEvent.change(input, { target: { value: '#12' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByText('Use a hex color like #1E6BD6.')).toBeTruthy()
    expect(props.saveValue).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '#1E6BD6' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(props.saveValue).toHaveBeenCalledWith(1, '#1E6BD6')
  })

  it('restores a customized color to the base value', async () => {
    const props = settingsProps()
    render(<BuilderAppColors />, props)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore base value' })) })
    expect(props.resetSetting).toHaveBeenCalledWith(2)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Accent is back to the base value')
  })

  it('shows one group of files at a time, with rules and the upload error', async () => {
    const props = settingsProps()
    render(<BuilderAppFiles />, props)
    expect(screen.getByRole('button', { name: 'Icons' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('PNG · 1024 × 1024 px')).toBeTruthy()
    expect(screen.getByText('No file yet. Required.')).toBeTruthy()
    const file = new File(['x'], 'icon.png', { type: 'image/png' })
    await act(async () => { fireEvent.change(screen.getByLabelText('Upload Icon iOS'), { target: { files: [file] } }) })
    expect(props.uploadFile).toHaveBeenCalledWith(3, file)
    expect(screen.getByText('The image must be 1024 × 1024 px.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Google files' }))
    expect(screen.getByText('google-services.json')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restore base file' })).toBeTruthy()
  })

  it('opens the group a check pointed to', () => {
    render(<BuilderAppFiles focusGroup='files' />, settingsProps())
    expect(screen.getByRole('button', { name: 'Google files' }).getAttribute('aria-pressed')).toBe('true')
  })

  // redesign B2: on Product pieces, with main's behaviour
  it('edits a color with the picker and the text, Enter saves and Cancel puts it back', async () => {
    const props = settingsProps()
    render(<BuilderAppColors />, props)
    const input = screen.getByLabelText('Primary')
    expect(input.closest('.odc-field')).toBeTruthy()
    expect(screen.getByText('Base value')).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
    const picker = screen.getByLabelText('Pick Primary')
    expect(picker.value).toBe('#2c7be5')
    expect(screen.getByLabelText('Pick Accent').value).toBe('#ffffff')
    fireEvent.input(picker, { target: { value: '#aabbcc' } })
    expect(input.value).toBe('#AABBCC')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(input.value).toBe('#2C7BE5')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.change(input, { target: { value: '#000' } })
    expect(screen.getByRole('button', { name: 'Save' }).classList.contains('odc-btn')).toBe(true)
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(props.saveValue).toHaveBeenCalledWith(1, '#000')
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. It applies on the next build.')
  })

  it('disables Save and Restore while the row saves', () => {
    render(<BuilderAppColors />, settingsProps({ savingId: 2 }))
    expect(screen.getByRole('button', { name: 'Restore base value' }).disabled).toBe(true)
  })

  it('says a restore failed', async () => {
    render(<BuilderAppColors />, settingsProps({ resetSetting: vi.fn(async () => ({ setting: null, errorCodes: [] })) }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore base value' })) })
    expect(state.showToast).toHaveBeenCalledWith('ERROR', 'We couldn’t save it. Try again.')
  })

  it('loads with skeletons, fails with a retry and says when there is nothing', () => {
    const reloadSettings = vi.fn()
    const { container, unmount } = render(<BuilderAppColors />, settingsProps({ settingsState: { loading: true, error: false, settings: [] } }))
    expect(container.querySelector('[aria-busy="true"] .odc-skeleton')).toBeTruthy()
    unmount()
    const failed = render(<BuilderAppFiles />, settingsProps({ reloadSettings, settingsState: { loading: false, error: true, settings: [] } }))
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t load these settings')
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy()
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry.classList.contains('odc-btn')).toBe(true)
    fireEvent.click(retry)
    expect(reloadSettings).toHaveBeenCalled()
    failed.unmount()
    render(<BuilderAppColors />, settingsProps({ settingsState: { loading: false, error: false, settings: [icon] } }))
    expect(screen.getByRole('heading', { name: 'This base has nothing to edit here' })).toBeTruthy()
  })

  it('uploads a file through the hidden input, shows the preview and restores the base file', async () => {
    const props = settingsProps({ uploadFile: vi.fn(async (id) => ({ setting: { id }, errorCodes: [] })) })
    render(<BuilderAppFiles focusGroup='files' />, props)
    const replace = screen.getByRole('button', { name: 'Replace' })
    expect(replace.classList.contains('odc-btn')).toBe(true)
    const input = screen.getByLabelText('Upload google-services.json')
    expect(input.getAttribute('type')).toBe('file')
    expect(input.getAttribute('accept')).toBe('.json')
    const click = vi.spyOn(input, 'click')
    fireEvent.click(replace)
    expect(click).toHaveBeenCalled()
    const preview = screen.getByAltText('Preview of google-services.json')
    fireEvent.error(preview)
    expect(screen.getByText('No preview for this file')).toBeTruthy()
    expect(screen.getByText('Your file')).toBeTruthy()
    const file = new File(['{}'], 'google-services.json', { type: 'application/json' })
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
    expect(props.uploadFile).toHaveBeenCalledWith(4, file)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. It applies on the next build.')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore base file' })) })
    expect(props.resetSetting).toHaveBeenCalledWith(4)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'google-services.json is back to the base file')
  })
})

describe('BuilderAppConstantsList', () => {
  const constants = [
    { id: 1, name: 'Google Maps API key', type: 'string', value: '', required: true, customized: false },
    { id: 2, name: 'Show tutorials', type: 'boolean', value: '0', required: false, customized: false },
    { id: 3, name: 'Extra', type: 'json', value: '{}', required: false, customized: true }
  ]
  const constantsProps = () => ({
    constantsState: { loading: false, error: false, constants },
    savingId: null,
    saveConstant: vi.fn(async (id, value) => ({ constant: { id, value }, errorCodes: [] })),
    resetConstant: vi.fn(async (id) => ({ constant: { id }, errorCodes: [] })),
    reloadConstants: vi.fn()
  })

  it('switches a boolean right away, as 1 or 0', async () => {
    const props = constantsProps()
    render(<BuilderAppConstantsList />, props)
    await act(async () => { fireEvent.click(screen.getByRole('switch')) })
    expect(props.saveConstant).toHaveBeenCalledWith(2, '1')
  })

  it('checks a JSON value before sending it', async () => {
    const props = constantsProps()
    render(<BuilderAppConstantsList />, props)
    fireEvent.change(screen.getByLabelText('Extra'), { target: { value: '{bad' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByText('Enter valid JSON.')).toBeTruthy()
    expect(props.saveConstant).not.toHaveBeenCalled()
  })

  it('saves a text constant', async () => {
    const props = constantsProps()
    render(<BuilderAppConstantsList />, props)
    fireEvent.change(screen.getByLabelText('Google Maps API key'), { target: { value: ' AIza ' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(props.saveConstant).toHaveBeenCalledWith(1, 'AIza')
  })

  // redesign B2: on Product pieces, with main's behaviour
  it('draws the boolean as P/Switch, named by the constant and disabled while it saves', () => {
    const props = { ...constantsProps(), savingId: 2 }
    render(<BuilderAppConstantsList />, props)
    const toggle = screen.getByRole('switch', { name: 'Show tutorials' })
    expect(toggle.classList.contains('odc-switch')).toBe(true)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(toggle.disabled).toBe(true)
    expect(screen.getByText('Off')).toBeTruthy()
    fireEvent.click(toggle)
    expect(props.saveConstant).not.toHaveBeenCalled()
  })

  it('checks integers and decimals, saves on Enter, and Cancel puts the value back', async () => {
    const props = constantsProps()
    props.constantsState.constants = [
      { id: 5, name: 'Max items', type: 'integer', value: '3', required: false, customized: false },
      { id: 6, name: 'Rate', type: 'decimal', value: '1.5', required: false, customized: false }
    ]
    render(<BuilderAppConstantsList />, props)
    const max = screen.getByLabelText('Max items')
    expect(max.closest('.odc-field')).toBeTruthy()
    expect(max.getAttribute('inputmode')).toBe('numeric')
    fireEvent.change(max, { target: { value: '2.5' } })
    await act(async () => { fireEvent.keyDown(max, { key: 'Enter' }) })
    expect(screen.getByText('Enter a whole number.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(max.value).toBe('3')
    const rate = screen.getByLabelText('Rate')
    fireEvent.change(rate, { target: { value: 'x' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
    expect(screen.getByText('Enter a number.')).toBeTruthy()
    fireEvent.change(rate, { target: { value: '2.25' } })
    await act(async () => { fireEvent.keyDown(rate, { key: 'Enter' }) })
    expect(props.saveConstant).toHaveBeenCalledWith(6, '2.25')
  })

  it('restores a customized constant, shows the source and the required placeholder', async () => {
    const props = constantsProps()
    render(<BuilderAppConstantsList />, props)
    expect(screen.getByText('Not set')).toBeTruthy()
    expect(screen.getByLabelText('Google Maps API key').placeholder).toBe('Required')
    expect(screen.getByLabelText('Extra').tagName).toBe('TEXTAREA')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restore base value' })) })
    expect(props.resetConstant).toHaveBeenCalledWith(3)
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Extra is back to the base value')
  })

  it('loads with skeletons, fails with a retry and says when there is nothing', () => {
    const props = constantsProps()
    const { container, unmount } = render(<BuilderAppConstantsList />, { ...props, constantsState: { loading: true, error: false, constants: [] } })
    expect(container.querySelector('[aria-busy="true"] .odc-skeleton')).toBeTruthy()
    unmount()
    const failed = render(<BuilderAppConstantsList />, { ...props, constantsState: { loading: false, error: true, constants: [] } })
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t load the constants')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadConstants).toHaveBeenCalled()
    failed.unmount()
    render(<BuilderAppConstantsList />, { ...props, constantsState: { loading: false, error: false, constants: [] } })
    expect(screen.getByRole('heading', { name: 'This base has nothing to edit here' })).toBeTruthy()
  })
})

describe('BuilderAppCredentialsForm', () => {
  const credentials = {
    ios: { team_id: 'A1B2', itc_team_id: null, api_key_id: null, api_key_issuer_id: null, has_api_key_file: false, complete: false },
    android: { key_alias: 'drivers', has_key_password: true, has_store_password: false, has_store_file: true, has_playstore_credential_file: false, complete: false }
  }
  const credentialsProps = () => ({
    credentialsState: { loading: false, error: false, credentials },
    savingPlatform: null,
    saveCredentials: vi.fn(async () => ({ credentials: {}, errorCodes: [] })),
    reloadCredentials: vi.fn()
  })

  it('shows what is set without ever showing a secret', () => {
    render(<BuilderAppCredentialsForm />, credentialsProps())
    const android = screen.getByRole('form', { name: 'Android · Signing' })
    expect(within(android).getAllByText('Configured')).toHaveLength(2)
    expect(within(android).getByText('Not set')).toBeTruthy()
    expect(within(android).getByLabelText('Key alias').value).toBe('drivers')
  })

  describe('default keystore', () => {
    const withAndroid = (android) => {
      const props = credentialsProps()
      props.credentialsState = { loading: false, error: false, credentials: { android: { key_alias: null, has_key_password: false, has_store_password: false, has_store_file: false, has_playstore_credential_file: false, complete: false, ...android } } }
      return props
    }
    const form = () => screen.getByRole('form', { name: 'Android · Signing' })
    const toggle = () => within(form()).getByRole('switch', { name: 'Use the default keystore' })
    const save = () => within(form()).getByRole('button', { name: 'Save credentials' })

    it('is not offered while the API has none', () => {
      render(<BuilderAppCredentialsForm />, withAndroid({}))
      expect(within(form()).queryByRole('switch')).toBeNull()
      expect(within(form()).getByLabelText('Key alias')).toBeTruthy()
    })

    it('turns on with one click when the app has no keystore, and saves only the choice', async () => {
      const props = withAndroid({ default_keystore_available: true })
      render(<BuilderAppCredentialsForm />, props)
      expect(toggle().getAttribute('aria-checked')).toBe('false')
      fireEvent.change(within(form()).getByLabelText('Key alias'), { target: { value: 'typed' } })
      fireEvent.click(toggle())
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      expect(within(form()).queryByLabelText('Key alias')).toBeNull()
      expect(within(form()).queryByText('Keystore file (.jks or .keystore)')).toBeNull()
      expect(within(form()).getByText('Play Store credentials (.json)')).toBeTruthy()
      expect(within(form()).getByText('The app is signed with the default keystore. Turn this off to use your own.')).toBeTruthy()
      await act(async () => { fireEvent.click(save()) })
      expect(props.saveCredentials).toHaveBeenCalledWith('android', { use_default_keystore: '1' })
    })

    it('asks before replacing the app’s own keystore', async () => {
      const props = withAndroid({ default_keystore_available: true, key_alias: 'mine', has_store_file: true })
      render(<BuilderAppCredentialsForm />, props)
      fireEvent.click(toggle())
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Replace your keystore with the default one?')).toBeTruthy()
      expect(within(dialog).queryByRole('link')).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(toggle().getAttribute('aria-checked')).toBe('false')
      expect(save().disabled).toBe(true)
      fireEvent.click(toggle())
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use the default keystore' }))
      await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('true'))
      await act(async () => { fireEvent.click(save()) })
      expect(props.saveCredentials).toHaveBeenCalledWith('android', { use_default_keystore: '1' })
    })

    it('asks before leaving a saved default keystore, with the guide to create one', async () => {
      const props = withAndroid({ default_keystore_available: true, uses_default_keystore: true, key_alias: 'ordering', has_key_password: true, has_store_password: true, has_store_file: true, complete: true })
      render(<BuilderAppCredentialsForm />, props)
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      expect(within(form()).queryByLabelText('Key alias')).toBeNull()
      expect(save().disabled).toBe(true)
      fireEvent.click(toggle())
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Use your own keystore instead?')).toBeTruthy()
      expect(within(dialog).getByText(/the store will reject updates signed with a different one/)).toBeTruthy()
      const guide = within(dialog).getByRole('link', { name: /How to create a keystore \(Google guide\)/ })
      expect(guide.getAttribute('href')).toBe('https://developer.android.com/studio/publish/app-signing#generate-key')
      expect(guide.getAttribute('target')).toBe('_blank')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      expect(save().disabled).toBe(true)
      expect(props.saveCredentials).not.toHaveBeenCalled()
    })

    it('does not ask when the default keystore was turned on but not saved yet', () => {
      render(<BuilderAppCredentialsForm />, withAndroid({ default_keystore_available: true }))
      fireEvent.click(toggle())
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      fireEvent.click(toggle())
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(toggle().getAttribute('aria-checked')).toBe('false')
      expect(save().disabled).toBe(true)
    })

    it('hides the default’s values and sends the app’s own when turned off', async () => {
      const props = withAndroid({ default_keystore_available: true, uses_default_keystore: true, key_alias: 'ordering', has_key_password: true, has_store_password: true, has_store_file: true, complete: true })
      render(<BuilderAppCredentialsForm />, props)
      fireEvent.click(toggle())
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use your own keystore' }))
      await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('false'))
      expect(within(form()).getByLabelText('Key alias').value).toBe('')
      expect(within(form()).queryByText('Configured')).toBeNull()
      fireEvent.change(within(form()).getByLabelText('Key alias'), { target: { value: 'mine' } })
      await act(async () => { fireEvent.click(save()) })
      expect(props.saveCredentials).toHaveBeenCalledWith('android', { use_default_keystore: '0', key_alias: 'mine' })
    })

    it('says when the default keystore can’t be used', async () => {
      const props = withAndroid({ default_keystore_available: true })
      props.saveCredentials = vi.fn(async () => ({ credentials: null, errorCodes: ['credentials.default_keystore_unavailable'] }))
      render(<BuilderAppCredentialsForm />, props)
      fireEvent.click(toggle())
      await act(async () => { fireEvent.click(save()) })
      expect(within(form()).getByRole('alert').textContent).toContain('The default keystore isn’t available right now.')
    })
  })

  it('sends only the fields that changed', async () => {
    const props = credentialsProps()
    render(<BuilderAppCredentialsForm />, props)
    const android = screen.getByRole('form', { name: 'Android · Signing' })
    const save = within(android).getByRole('button', { name: 'Save credentials' })
    expect(save.disabled).toBe(true)
    fireEvent.click(within(android).getByRole('button', { name: 'Set' }))
    fireEvent.change(within(android).getByLabelText('Store password'), { target: { value: 'secret' } })
    await act(async () => { fireEvent.click(save) })
    expect(props.saveCredentials).toHaveBeenCalledWith('android', { store_password: 'secret' })
    expect(state.showToast).toHaveBeenCalledWith('SUCCESS', 'Saved. Used to sign the next build.')
  })

  it('names the field the API rejected', async () => {
    const props = credentialsProps()
    props.saveCredentials = vi.fn(async () => ({ credentials: null, errorCodes: ['api_key_file.extensions'] }))
    render(<BuilderAppCredentialsForm />, props)
    const ios = screen.getByRole('form', { name: 'iOS · App Store Connect' })
    fireEvent.change(within(ios).getByLabelText('API key ID'), { target: { value: 'K1' } })
    await act(async () => { fireEvent.click(within(ios).getByRole('button', { name: 'Save credentials' })) })
    expect(within(ios).getByRole('alert').textContent).toBe('API key file (.p8): this type of file isn’t accepted.')
  })

  // redesign B2: on Product pieces, with main's behaviour
  it('draws each platform with Product pieces: badge, fields, guide and Save', () => {
    render(<BuilderAppCredentialsForm />, { ...credentialsProps(), guides: { ios_credentials: 'https://guide/ios' } })
    const ios = screen.getByRole('form', { name: 'iOS · App Store Connect' })
    expect(within(ios).getByText('Incomplete').closest('.odc-badge')).toBeTruthy()
    expect(within(ios).getByLabelText('Team ID').closest('.odc-field')).toBeTruthy()
    expect(within(ios).getByText('Optional')).toBeTruthy()
    const guide = within(ios).getByRole('link', { name: /How to get these/ })
    expect(guide.getAttribute('target')).toBe('_blank')
    expect(within(ios).getByRole('button', { name: 'Save credentials' }).classList.contains('odc-btn')).toBe(true)
    const android = screen.getByRole('form', { name: 'Android · Signing' })
    expect(within(android).queryByRole('link')).toBeNull()
  })

  it('reveals an empty password field on Set, focused, and picks a file through the hidden input', async () => {
    const props = credentialsProps()
    render(<BuilderAppCredentialsForm />, props)
    const android = screen.getByRole('form', { name: 'Android · Signing' })
    const replace = within(android).getAllByRole('button', { name: 'Replace' })
    expect(replace).toHaveLength(2)
    expect(replace[0].classList.contains('odc-btn')).toBe(true)
    fireEvent.click(replace[0])
    const password = within(android).getByLabelText('Key password')
    expect(password.getAttribute('type')).toBe('password')
    expect(password.value).toBe('')
    expect(document.activeElement).toBe(password)
    fireEvent.change(password, { target: { value: 'pw' } })
    const upload = within(android).getByLabelText('Play Store credentials (.json)')
    expect(upload.getAttribute('accept')).toBe('.json')
    const file = new File(['{}'], 'play.json', { type: 'application/json' })
    fireEvent.change(upload, { target: { files: [file] } })
    expect(within(android).getByText('play.json')).toBeTruthy()
    await act(async () => { fireEvent.click(within(android).getByRole('button', { name: 'Save credentials' })) })
    expect(props.saveCredentials).toHaveBeenCalledWith('android', { key_password: 'pw', playstore_credential_file: file })
    // the saved form drops its changes: the password field closes again
    await waitFor(() => expect(within(android).queryByLabelText('Key password')).toBeNull())
  })

  it('loads with a skeleton, fails with a retry and says when there is nothing', () => {
    const props = credentialsProps()
    const { container, unmount } = render(<BuilderAppCredentialsForm />, { ...props, credentialsState: { loading: true, error: false, credentials: null } })
    expect(container.querySelector('[aria-busy="true"] .odc-skeleton')).toBeTruthy()
    unmount()
    const failed = render(<BuilderAppCredentialsForm />, { ...props, credentialsState: { loading: false, error: true, credentials: null } })
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t load the credentials')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadCredentials).toHaveBeenCalled()
    failed.unmount()
    render(<BuilderAppCredentialsForm />, { ...props, credentialsState: { loading: false, error: false, credentials: {} } })
    expect(screen.getByRole('heading', { name: 'This base has nothing to edit here' })).toBeTruthy()
  })
})
