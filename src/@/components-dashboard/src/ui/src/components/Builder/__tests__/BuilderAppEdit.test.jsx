import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
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
vi.mock('../../../styles', () => ({
  Button: ({ color, borderRadius, outline, ...props }) => <button {...props} />,
  IconButton: ({ color, ...props }) => <button {...props} />,
  Input: (props) => <input {...props} />,
  TextArea: (props) => <textarea {...props} />
}))
vi.mock('../../Shared/SideBar', () => ({
  SideBar: ({ children }) => <div role='dialog'>{children}</div>
}))

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
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByLabelText('Version').value).toBe('0.0.2')
    expect(within(panel).getByLabelText('Name in the stores').placeholder).toBe('Drivers')
    fireEvent.click(within(panel).getByRole('button', { name: 'Use app value' }))
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Save' })) })
    expect(updatePlatform).toHaveBeenCalledWith('android', { version: null })
    expect(screen.queryByRole('dialog')).toBeNull()
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
})
