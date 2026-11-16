/* eslint-disable import/first */
// redesign my-products B3 (; D3, D5, D6; M-MP-01, 02, 03, 09, 12): the four «App» sections of the editor: General, Constants,
// Credentials and Files. Covered: General saves like main (`updateProductApp(changes)`), says «Saved», and on an error shows the
// notice and KEEPS what was typed (main wiped it, M-MP-01); Save is off without changes or with an emptied field. Constants autosave
// after 750 ms with the spaces stripped (M-MP-11), a checkbox saves at once with a boolean, and an error shows in the field and keeps
// the text (M-MP-02). Credentials: the two passwords are hidden P/SecretFields, the labels are translated keys (M-MP-09), and when one
// platform fails only the other one is cleared (M-MP-12). Files: the first file (index 0) is updated and nothing is written at -1;
// a failure toasts and the file stays selected (M-MP-03). R1-02: after a save the focus is never left on <body> (a «Saved» line, or the
// control that started it). R1-01: the legacy file drop zone has no minimum width. The controller (BuildApps) is a stand-in: its calls
// are mocks.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockToast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useToast: () => [{}, { showToast: mockToast.showToast }],
  ToastType: { Success: 'success', Error: 'error', Info: 'info' },
  useUtils: () => [{ optimizeImage: (src) => src }],
  useApi: () => [{ root: 'https://api.example.test' }]
}))
// The business select is a legacy piece (its own tests cover it): a stand-in with two options and «none».
vi.mock('../../OrderingWebsite/SelectBusiness', () => ({
  SelectBusiness: ({ defaultValue, onChange, showNoOption }) => (
    <select aria-label='Business' data-testid='select-business' value={defaultValue ?? ''} onChange={(event) => onChange(event.target.value)}>
      {showNoOption && <option value='none'>none</option>}
      <option value='burger'>burger</option>
      <option value='pizza'>pizza</option>
    </select>
  )
}))

import { GeneralSection } from '../GeneralSection'
import { ConstantsSection } from '../ConstantsSection'
import { CredentialsSection } from '../CredentialsSection'
import { FilesSection } from '../FilesSection'

beforeEach(() => {
  mockToast.showToast.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const settle = async () => { await act(async () => { await Promise.resolve() }) }
const clickSave = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
  await settle()
}

// ── General ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('GeneralSection', () => {
  const app = { id: 1, name: 'Customer', package: 'com.acme.app', version: '1.0.0', description: 'Hello' }
  const mountGeneral = (props = {}) => {
    const updateProductApp = props.updateProductApp ?? vi.fn().mockResolvedValue({ error: false, result: { version: '2.0.0' } })
    const updateAppValues = props.updateAppValues ?? vi.fn()
    renderWithProviders(<GeneralSection app={props.app ?? app} updateProductApp={updateProductApp} updateAppValues={updateAppValues} />)
    return { updateProductApp, updateAppValues }
  }
  const version = () => screen.getByLabelText('Version', { selector: 'input' })

  it('paints the four fields from the app, with the same names, and no title of its own', () => {
    mountGeneral()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByLabelText('Name', { selector: 'input' })).toHaveValue('Customer')
    expect(screen.getByLabelText('Name', { selector: 'input' })).toHaveAttribute('name', 'name')
    expect(screen.getByLabelText('Package', { selector: 'input' })).toHaveAttribute('name', 'package')
    expect(version()).toHaveAttribute('name', 'version')
    expect(version()).toHaveAttribute('placeholder', '0.0.0')
    expect(screen.getByLabelText('Description', { selector: 'textarea' })).toHaveAttribute('name', 'description')
    expect(screen.getByLabelText('Description', { selector: 'textarea' })).toHaveValue('Hello')
  })

  it('saves what changed with updateProductApp, hands the result to updateAppValues and says Saved for 3 s', async () => {
    // fila 48: a fully manual clock, like the 750 ms debounce below: `shouldAdvanceTime` also moves the fake clock with real
    // time, so on a loaded machine the 3 s «Saved» window could close before the «Saved» checks. Nothing here needs real time.
    vi.useFakeTimers()
    const { updateProductApp, updateAppValues } = mountGeneral()
    fireEvent.change(version(), { target: { value: '2.0.0' } })
    await clickSave()
    expect(updateProductApp).toHaveBeenCalledTimes(1)
    expect(updateProductApp).toHaveBeenCalledWith({ version: '2.0.0' })
    expect(updateAppValues).toHaveBeenCalledWith({ version: '2.0.0' })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status')).not.toHaveTextContent('Saved')
  })

  it('M-MP-01: with an error it shows the notice and KEEPS what was typed (main wiped it)', async () => {
    const updateProductApp = vi.fn().mockResolvedValue({ error: true, result: ['Bad version'] })
    const { updateAppValues } = mountGeneral({ updateProductApp })
    fireEvent.change(version(), { target: { value: 'abc' } })
    await clickSave()
    expect(screen.getByText("We couldn't save your changes. Bad version")).toBeInTheDocument()
    expect(version()).toHaveValue('abc')
    expect(updateAppValues).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).toBeNull()
    // the typed value is still a change: Save is on and a retry sends it again
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('M-MP-01: a request that throws shows the same notice with the error message and keeps the text', async () => {
    const updateProductApp = vi.fn().mockRejectedValue(new Error('Network down'))
    mountGeneral({ updateProductApp })
    fireEvent.change(version(), { target: { value: '9.9.9' } })
    await clickSave()
    expect(screen.getByText("We couldn't save your changes. Network down")).toBeInTheDocument()
    expect(version()).toHaveValue('9.9.9')
  })

  it('Save is off without changes and with a changed field left empty', async () => {
    mountGeneral()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(version(), { target: { value: '2.0.0' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Name', { selector: 'input' }), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

// ── Constants ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('ConstantsSection', () => {
  const baseConstants = [
    { id: 1, code: 'api_url', name: 'Api url', type: 'string', value: '' },
    { id: 2, code: 'dark_mode', name: 'Dark mode', type: 'boolean', value: '0' },
    { id: 3, code: 'extra', name: 'Extra', type: 'json', value: '{}' },
    { id: 4, code: 'business_slug', name: 'Business', type: 'string', value: 'burger' }
  ]
  const mountConstants = (props = {}) => {
    const app = props.app ?? { id: 1, baseConstants }
    const updateBaseContants = props.updateBaseContants ?? vi.fn().mockResolvedValue({ error: false, result: { id: 1, value: 'abc' } })
    const updateAppValues = props.updateAppValues ?? vi.fn()
    const rendered = renderWithProviders(
      <ConstantsSection
        app={app}
        updateBaseContants={updateBaseContants}
        updateAppValues={updateAppValues}
        businessesList={{ loading: false, businesses: [{ slug: 'burger', name: 'Burger' }] }}
      />
    )
    return { app, updateBaseContants, updateAppValues, unmount: rendered.unmount }
  }
  const apiUrl = () => screen.getByLabelText('Api url', { selector: 'input' })

  it('paints nothing without constants', () => {
    const { container } = renderWithProviders(<ConstantsSection app={{ id: 1 }} updateBaseContants={vi.fn()} updateAppValues={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('maps each type to its control, as main does', () => {
    mountConstants()
    expect(apiUrl()).toHaveAttribute('type', 'text')
    expect(screen.getByRole('checkbox', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('Extra', { selector: 'textarea' })).toHaveAttribute('rows', '3')
    expect(screen.getByTestId('select-business')).toHaveValue('burger')
  })

  it('waits 750 ms and saves once with the spaces stripped (M-MP-11 stays)', async () => {
    // FL-1: a fully manual clock. `shouldAdvanceTime` also moves the fake clock with real time, so on a loaded machine
    // the 750 ms debounce could fire before the «not called at 749 ms» check. Nothing here needs real time (fireEvent + act only).
    vi.useFakeTimers()
    const { updateBaseContants } = mountConstants()
    fireEvent.change(apiUrl(), { target: { value: 'a b c' } })
    expect(apiUrl()).toHaveValue('abc')
    await act(async () => { vi.advanceTimersByTime(749) })
    expect(updateBaseContants).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1) })
    await settle()
    expect(updateBaseContants).toHaveBeenCalledTimes(1)
    expect(updateBaseContants).toHaveBeenCalledWith({ id: 1, body: { value: 'abc' } })
    expect(mockToast.showToast).toHaveBeenCalledWith('success', 'Correctly saved constant')
  })

  it('on success updates that constant without mutating the list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { app, updateAppValues } = mountConstants()
    fireEvent.change(apiUrl(), { target: { value: 'abc' } })
    await act(async () => { vi.advanceTimersByTime(750) })
    await settle()
    expect(updateAppValues).toHaveBeenCalledTimes(1)
    const [{ baseConstants: next }] = updateAppValues.mock.calls[0]
    expect(next).not.toBe(app.baseConstants)
    expect(next[0]).toMatchObject({ id: 1, code: 'api_url', value: 'abc' })
    expect(next).toHaveLength(baseConstants.length)
    expect(app.baseConstants[0].value).toBe('')
  })

  it('M-MP-02: with an error the field shows it and keeps what was typed; typing again clears it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const updateBaseContants = vi.fn().mockResolvedValue({ error: true, result: ['Bad value'] })
    const { updateAppValues } = mountConstants({ updateBaseContants })
    fireEvent.change(apiUrl(), { target: { value: 'abc' } })
    await act(async () => { vi.advanceTimersByTime(750) })
    await settle()
    expect(screen.getByRole('alert')).toHaveTextContent('Bad value')
    expect(apiUrl()).toHaveValue('abc')
    expect(updateAppValues).not.toHaveBeenCalled()
    expect(mockToast.showToast).not.toHaveBeenCalled()
    fireEvent.change(apiUrl(), { target: { value: 'abcd' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a json constant keeps its spaces (only the text ids lose them)', async () => {
    vi.useFakeTimers()
    const { updateBaseContants } = mountConstants()
    const extra = screen.getByLabelText('Extra', { selector: 'textarea' })
    fireEvent.change(extra, { target: { value: '{ "title": "My store" }' } })
    expect(extra).toHaveValue('{ "title": "My store" }')
    await act(async () => { vi.advanceTimersByTime(750) })
    await settle()
    expect(updateBaseContants).toHaveBeenCalledWith({ id: 3, body: { value: '{ "title": "My store" }' } })
  })

  it('leaving before 750 ms still saves what was typed last', async () => {
    vi.useFakeTimers()
    const { updateBaseContants, unmount } = mountConstants()
    fireEvent.change(apiUrl(), { target: { value: 'https://api.test' } })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(updateBaseContants).not.toHaveBeenCalled()
    unmount()
    await settle()
    expect(updateBaseContants).toHaveBeenCalledTimes(1)
    expect(updateBaseContants).toHaveBeenCalledWith({ id: 1, body: { value: 'https://api.test' } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(updateBaseContants).toHaveBeenCalledTimes(1)
  })

  it('the save on leave still hands the saved constant to the editor (another section is open now)', async () => {
    vi.useFakeTimers()
    const updateBaseContants = vi.fn().mockResolvedValue({ error: false, result: { id: 1, value: 'https://api.test' } })
    const { updateAppValues, unmount } = mountConstants({ updateBaseContants })
    fireEvent.change(apiUrl(), { target: { value: 'https://api.test' } })
    unmount()
    await settle()
    await settle()
    expect(updateAppValues).toHaveBeenCalledTimes(1)
    const [{ baseConstants: next }] = updateAppValues.mock.calls[0]
    expect(next[0]).toMatchObject({ id: 1, value: 'https://api.test' })
  })

  it('M-MP-15: while a save is in flight the text field stays enabled, typing appends, and the next save waits and sends the full value', async () => {
    vi.useFakeTimers()
    let release
    const firstSave = new Promise(resolve => { release = resolve })
    const updateBaseContants = vi.fn()
      .mockReturnValueOnce(firstSave)
      .mockResolvedValue({ error: false, result: { id: 1, value: 'abcd' } })
    const { updateAppValues } = mountConstants({ updateBaseContants })

    fireEvent.change(apiUrl(), { target: { value: 'ab' } })
    await act(async () => { vi.advanceTimersByTime(750) })
    expect(updateBaseContants).toHaveBeenCalledTimes(1)
    expect(updateBaseContants).toHaveBeenLastCalledWith({ id: 1, body: { value: 'ab' } })

    // the first request has not answered: the field is still enabled and what is typed is kept
    expect(apiUrl()).toBeEnabled()
    fireEvent.change(apiUrl(), { target: { value: apiUrl().value + 'cd' } })
    expect(apiUrl()).toHaveValue('abcd')
    await act(async () => { vi.advanceTimersByTime(750) })
    // one save at a time: the second one waits for the first
    expect(updateBaseContants).toHaveBeenCalledTimes(1)

    await act(async () => { release({ error: false, result: { id: 1, value: 'ab' } }) })
    await settle()
    await settle()
    // the answer of the first save did not take back what was typed, and the second sent the full value
    expect(apiUrl()).toHaveValue('abcd')
    expect(updateBaseContants).toHaveBeenCalledTimes(2)
    expect(updateBaseContants).toHaveBeenLastCalledWith({ id: 1, body: { value: 'abcd' } })
    expect(updateAppValues).toHaveBeenCalledTimes(2)
    expect(updateAppValues.mock.calls[0][0].baseConstants[0]).toMatchObject({ id: 1, value: 'ab' })
    expect(updateAppValues.mock.calls[1][0].baseConstants[0]).toMatchObject({ id: 1, value: 'abcd' })
    expect(apiUrl()).toBeEnabled()
  })

  it('the checkbox saves at once with a boolean, from the stored string', async () => {
    const updateBaseContants = vi.fn().mockResolvedValue({ error: false, result: { id: 2, value: true } })
    mountConstants({ updateBaseContants })
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Dark mode' })) })
    await settle()
    expect(updateBaseContants).toHaveBeenCalledTimes(1)
    expect(updateBaseContants).toHaveBeenCalledWith({ id: 2, body: { value: true } })
    expect(screen.getByRole('checkbox', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the business select saves at once and «none» becomes null', async () => {
    const updateBaseContants = vi.fn().mockResolvedValue({ error: false, result: { id: 4, value: null } })
    mountConstants({ updateBaseContants })
    await act(async () => { fireEvent.change(screen.getByTestId('select-business'), { target: { value: 'none' } }) })
    await settle()
    expect(updateBaseContants).toHaveBeenCalledWith({ id: 4, body: { value: null } })
  })
})

// ── Credentials ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('CredentialsSection', () => {
  const app = {
    id: 1,
    base: { platforms: ['ios', 'android'] },
    ios_credentials: { team_id: 'T1' },
    android_credentials: { key_alias: 'alias-1', key_password: 'a-very-long-password' }
  }
  const mountCredentials = (props = {}) => {
    const updateProductAppCredentials = props.updateProductAppCredentials ?? vi.fn().mockResolvedValue({ error: false, result: {} })
    const updateAppValues = props.updateAppValues ?? vi.fn()
    renderWithProviders(<CredentialsSection app={app} updateProductAppCredentials={updateProductAppCredentials} updateAppValues={updateAppValues} />)
    return { updateProductAppCredentials, updateAppValues }
  }
  const input = (label) => screen.getByLabelText(label, { selector: 'input' })

  it('paints iOS and Android with an h3 each and the translated labels of the map (M-MP-09)', () => {
    mountCredentials()
    expect(screen.getByRole('heading', { level: 3, name: 'iOS' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Android' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    ;['Team id', 'ITC team id', 'Api key id', 'Api key issuer id', 'Key alias', 'Key password', 'Store password'].forEach(label => {
      expect(input(label)).toBeInTheDocument()
    })
    ;['Api key file', 'Store file', 'Play Store credential file'].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
    expect(input('Team id')).toHaveValue('T1')
    expect(input('Team id')).toHaveAttribute('name', 'team_id')
    // the accepted formats are a hint, not part of the label
    expect(screen.getByText('.p8, .txt').closest('.odc-figure')).not.toBeNull()
    expect(screen.queryByText(/\(\.p8,\.txt\)/)).toBeNull()
  })

  describe('default keystore', () => {
    const mountWith = (values, updateProductAppCredentials = vi.fn().mockResolvedValue({ error: false, result: {} })) => {
      const updateAppValues = vi.fn()
      renderWithProviders(<CredentialsSection app={{ ...app, ...values }} updateProductAppCredentials={updateProductAppCredentials} updateAppValues={updateAppValues} />)
      return { updateProductAppCredentials, updateAppValues }
    }
    const toggle = () => screen.getByRole('switch', { name: 'Use the default keystore' })

    it('is not offered while the API has none', () => {
      mountWith({})
      expect(screen.queryByRole('switch')).toBeNull()
    })

    it('turns on with one click when the app has no keystore, and saves only the choice', async () => {
      const { updateProductAppCredentials, updateAppValues } = mountWith(
        { android_default_keystore_available: true },
        vi.fn().mockResolvedValue({ error: false, result: { key_alias: 'ordering', store_file: 'apps/app_1/credentials/android/store_file.jks', uses_default_keystore: true } })
      )
      expect(toggle()).toHaveAttribute('aria-checked', 'false')
      fireEvent.change(input('Key alias'), { target: { value: 'typed' } })
      fireEvent.click(toggle())
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(toggle()).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByLabelText('Key alias', { selector: 'input' })).toBeNull()
      expect(screen.queryByText('Store file')).toBeNull()
      expect(screen.getByText('Play Store credential file')).toBeInTheDocument()
      await clickSave()
      expect(updateProductAppCredentials).toHaveBeenCalledTimes(1)
      const [{ body, platform }] = updateProductAppCredentials.mock.calls[0]
      expect(platform).toBe('android')
      expect([...body.entries()]).toEqual([['use_default_keystore', '1']])
      expect(updateAppValues).toHaveBeenCalledWith({ android_credentials: expect.objectContaining({ uses_default_keystore: true }) })
    })

    it('asks before replacing the app’s own keystore', async () => {
      mountWith({ android_default_keystore_available: true, android_credentials: { key_alias: 'mine', store_file: 'apps/app_1/credentials/android/store_file.jks' } })
      fireEvent.click(toggle())
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Replace your keystore with the default one?')).toBeInTheDocument()
      expect(within(dialog).queryByRole('link')).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(toggle()).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      fireEvent.click(toggle())
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use the default keystore' }))
      await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'true'))
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })

    it('asks before leaving a saved default keystore, with the guide to create one', async () => {
      const { updateProductAppCredentials } = mountWith({
        android_default_keystore_available: true,
        android_credentials: { key_alias: 'ordering', store_file: 'apps/app_1/credentials/android/store_file.jks', uses_default_keystore: true }
      })
      expect(toggle()).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByLabelText('Key alias', { selector: 'input' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      fireEvent.click(toggle())
      const dialog = screen.getByRole('alertdialog')
      expect(within(dialog).getByText('Use your own keystore instead?')).toBeInTheDocument()
      const guide = within(dialog).getByRole('link', { name: /How to create a keystore \(Google guide\)/ })
      expect(guide).toHaveAttribute('href', 'https://developer.android.com/studio/publish/app-signing#generate-key')
      expect(guide).toHaveAttribute('target', '_blank')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(toggle()).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      expect(updateProductAppCredentials).not.toHaveBeenCalled()
    })

    it('does not ask when the default keystore was turned on but not saved yet', () => {
      mountWith({ android_default_keystore_available: true })
      fireEvent.click(toggle())
      expect(toggle()).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(toggle())
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(toggle()).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })

    it('hides the default’s values and sends the app’s own when turned off', async () => {
      const { updateProductAppCredentials } = mountWith({
        android_default_keystore_available: true,
        android_credentials: { key_alias: 'ordering', store_file: 'apps/app_1/credentials/android/store_file.jks', uses_default_keystore: true }
      })
      fireEvent.click(toggle())
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use your own keystore' }))
      await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'false'))
      expect(input('Key alias')).toHaveValue('')
      fireEvent.change(input('Key alias'), { target: { value: 'mine' } })
      await clickSave()
      const [{ body }] = updateProductAppCredentials.mock.calls[0]
      expect(Object.fromEntries(body.entries())).toEqual({ use_default_keystore: '0', key_alias: 'mine' })
    })
  })

  it('D5: key_password and store_password are hidden by default and Show reads them', async () => {
    const user = userEvent.setup()
    mountCredentials()
    expect(input('Key password')).toHaveAttribute('type', 'password')
    expect(input('Store password')).toHaveAttribute('type', 'password')
    expect(input('Key alias')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /Show.*Key password/ }))
    expect(input('Key password')).toHaveAttribute('type', 'text')
    expect(input('Key password')).toHaveValue('a-very-long-password')
    expect(input('Store password')).toHaveAttribute('type', 'password')
    expect(screen.getByText(/Ends in/)).toHaveTextContent('Ends in …word')
  })

  it('Save is off until something changes; it sends one request per platform with changes, as FormData', async () => {
    const { updateProductAppCredentials, updateAppValues } = mountCredentials({
      updateProductAppCredentials: vi.fn().mockResolvedValue({ error: false, result: { team_id: 'new' } })
    })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(input('Team id'), { target: { value: 'n e w' } })
    expect(input('Team id')).toHaveValue('new')
    await clickSave()
    expect(updateProductAppCredentials).toHaveBeenCalledTimes(1)
    const [{ body, platform }] = updateProductAppCredentials.mock.calls[0]
    expect(platform).toBe('ios')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('team_id')).toBe('new')
    expect(updateAppValues).toHaveBeenCalledWith({ ios_credentials: { team_id: 'new' } })
    expect(mockToast.showToast).toHaveBeenCalledWith('success', 'Credentials saved successfully')
    expect(app.ios_credentials).toEqual({ team_id: 'T1' })
  })

  it('the two passwords are sent as typed, spaces included; the ids still lose them', async () => {
    const { updateProductAppCredentials } = mountCredentials()
    fireEvent.change(input('Key password'), { target: { value: ' my key pass ' } })
    fireEvent.change(input('Store password'), { target: { value: 'store pass' } })
    fireEvent.change(input('Key alias'), { target: { value: 'my alias' } })
    expect(input('Key password')).toHaveValue(' my key pass ')
    await clickSave()
    const [{ body, platform }] = updateProductAppCredentials.mock.calls[0]
    expect(platform).toBe('android')
    expect(body.get('key_password')).toBe(' my key pass ')
    expect(body.get('store_password')).toBe('store pass')
    expect(body.get('key_alias')).toBe('myalias')
  })

  it('M-MP-12: when iOS fails and Android goes well, Android is cleared and iOS keeps what was typed', async () => {
    const updateProductAppCredentials = vi.fn(async ({ platform }) => (
      platform === 'ios'
        ? { error: true, result: ['Bad team'] }
        : { error: false, result: { key_alias: 'saved-alias' } }
    ))
    const { updateAppValues } = mountCredentials({ updateProductAppCredentials })
    fireEvent.change(input('Team id'), { target: { value: 'typed-ios' } })
    fireEvent.change(input('Key alias'), { target: { value: 'typed-android' } })
    await clickSave()
    expect(updateProductAppCredentials).toHaveBeenCalledTimes(2)
    expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Bad team')
    expect(updateAppValues).toHaveBeenCalledWith({ android_credentials: { key_alias: 'saved-alias', key_password: 'a-very-long-password' } })
    expect(input('Team id')).toHaveValue('typed-ios')
    // Android went back to what the app holds (its changes were cleared)
    expect(input('Key alias')).toHaveValue('alias-1')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

// ── Files ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('FilesSection', () => {
  const baseActions = [
    { id: 10, name: 'Google services', group: 'files', source_path: 'old-a.json', file_rules: { extension: 'json', max_size: 2048 } },
    { id: 11, name: 'Firebase', group: 'files', source_path: 'old-b.json', file_rules: { extension: 'json', max_size: 2048 } },
    { id: 12, name: 'Logo', group: 'general_images', source_path: 'logo.png' }
  ]
  const app = { id: 1, baseActions }
  const mountFiles = (props = {}) => {
    const updateBaseActions = props.updateBaseActions ?? vi.fn().mockResolvedValue({ error: false, result: { id: 10, source_path: 'new.json' } })
    const updateAppValues = props.updateAppValues ?? vi.fn()
    renderWithProviders(<FilesSection app={app} updateBaseActions={updateBaseActions} updateAppValues={updateAppValues} />)
    return { updateBaseActions, updateAppValues }
  }
  const fileInput = (name) => document.querySelector(`input[type="file"][name="${name}"]`)
  const pick = async (name, file) => { await act(async () => { await userEvent.upload(fileInput(name), file) }) }
  const json = (name) => new File(['{}'], name, { type: 'application/json' })

  it('paints nothing without files', () => {
    const { container } = renderWithProviders(<FilesSection app={{ id: 1, baseActions: [baseActions[2]] }} updateBaseActions={vi.fn()} updateAppValues={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('one input per file of the group, with the extension as a hint and the current file', () => {
    mountFiles()
    expect(fileInput('Google services')).toHaveAttribute('accept', '.json')
    expect(fileInput('Firebase')).not.toBeNull()
    expect(fileInput('Logo')).toBeNull()
    expect(screen.getAllByText('.json')).toHaveLength(2)
    expect(screen.getByText('old-a.json')).toBeInTheDocument()
  })

  it('M-MP-03: the file at index 0 is updated, nothing is written at -1, and the list is not mutated', async () => {
    const { updateBaseActions, updateAppValues } = mountFiles()
    await pick('Google services', json('new.json'))
    await clickSave()
    expect(updateBaseActions).toHaveBeenCalledTimes(1)
    const [{ id, body }] = updateBaseActions.mock.calls[0]
    expect(id).toBe('10')
    expect(body.get('source_file').name).toBe('new.json')
    expect(updateAppValues).toHaveBeenCalledTimes(1)
    const [{ baseActions: next }] = updateAppValues.mock.calls[0]
    expect(next).toHaveLength(3)
    expect(next[0]).toMatchObject({ id: 10, source_path: 'new.json', name: 'Google services' })
    expect(next[1]).toEqual(baseActions[1])
    expect(next[2]).toEqual(baseActions[2])
    expect(next[-1]).toBeUndefined()
    expect(baseActions[0].source_path).toBe('old-a.json')
    expect(mockToast.showToast).toHaveBeenCalledWith('success', 'Correctly saved files')
  })

  it('M-MP-03: when one fails it toasts the message and that file stays selected (only the saved one is cleared)', async () => {
    const updateBaseActions = vi.fn(async ({ id }) => (
      id === '10'
        ? { error: false, result: { id: 10, source_path: 'new-a.json' } }
        : { error: true, result: ['Bad file'] }
    ))
    const { updateAppValues } = mountFiles({ updateBaseActions })
    await pick('Google services', json('new-a.json'))
    await pick('Firebase', json('new-b.json'))
    await clickSave()
    expect(updateBaseActions).toHaveBeenCalledTimes(2)
    expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Bad file')
    expect(updateAppValues).toHaveBeenCalledTimes(1)
    expect(updateAppValues.mock.calls[0][0].baseActions[0].source_path).toBe('new-a.json')
    expect(updateAppValues.mock.calls[0][0].baseActions[1].source_path).toBe('old-b.json')
    // the failed one is still a change: Save stays on, and a retry sends only that file
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    updateBaseActions.mockClear()
    await clickSave()
    expect(updateBaseActions).toHaveBeenCalledTimes(1)
    expect(updateBaseActions.mock.calls[0][0].id).toBe('11')
  })

  it('all failing: error toast, no updateAppValues, the selection stays', async () => {
    const updateBaseActions = vi.fn().mockResolvedValue({ error: true, result: ['Too big'] })
    const { updateAppValues } = mountFiles({ updateBaseActions })
    await pick('Google services', json('new.json'))
    await clickSave()
    expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Too big')
    expect(updateAppValues).not.toHaveBeenCalled()
    expect(within(document.body).getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

// ── R1-02 · the focus does not fall on <body> after saving ───────────────────────────────────────────────────────────────────────
// A browser drops the focus on <body> when the control that has it becomes disabled (jsdom keeps it on the disabled control), so each
// request below does the same while it runs: it blurs whatever has the focus, before React disables it (the button, the field).
describe('R1-02: the focus after a save', () => {
  const dropFocus = () => { document.activeElement?.blur?.() }
  const saveButton = () => screen.getByRole('button', { name: 'Save' })
  const focusSave = () => { act(() => { saveButton().focus() }) }
  const lastRequest = (result) => vi.fn(async () => { dropFocus(); return result })
  const failingRequest = (result) => vi.fn(async () => { dropFocus(); throw result })

  describe('General', () => {
    const app = { id: 1, name: 'Customer', package: 'com.acme.app', version: '1.0.0', description: 'Hello' }
    const mount = (updateProductApp) => {
      renderWithProviders(<GeneralSection app={app} updateProductApp={updateProductApp} updateAppValues={vi.fn()} />)
    }
    const version = () => screen.getByLabelText('Version', { selector: 'input' })

    it('after a good Save the focus is on the «Saved» line, which is a status and can take it', async () => {
      mount(lastRequest({ error: false, result: { version: '2.0.0' } }))
      fireEvent.change(version(), { target: { value: '2.0.0' } })
      focusSave()
      await clickSave()
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Saved')
      expect(status).toHaveAttribute('tabindex', '-1')
      await waitFor(() => expect(status).toHaveFocus())
      expect(saveButton()).toBeDisabled()
    })

    // redesign my-products R1-02: a failed save sends the focus to the notice, so a screen reader reads why
    it('after a failed Save the focus is on the notice; Save still has changes to send', async () => {
      mount(lastRequest({ error: true, result: ['Bad version'] }))
      fireEvent.change(version(), { target: { value: 'abc' } })
      focusSave()
      await clickSave()
      const notice = screen.getByText("We couldn't save your changes. Bad version").closest('[tabindex="-1"]')
      await waitFor(() => expect(notice).toHaveFocus())
      expect(saveButton()).not.toBeDisabled()
    })

    it('a request that throws sends the focus to the notice too', async () => {
      mount(failingRequest(new Error('Network down')))
      fireEvent.change(version(), { target: { value: '9.9.9' } })
      focusSave()
      await clickSave()
      const notice = screen.getByText("We couldn't save your changes. Network down").closest('[tabindex="-1"]')
      await waitFor(() => expect(notice).toHaveFocus())
    })

    it('when Save cannot take the focus back after an error, the focus goes to the notice', async () => {
      const request = vi.fn(async () => {
        dropFocus()
        // the owner empties a field while it saves: Save is off when the answer arrives
        fireEvent.change(screen.getByLabelText('Name', { selector: 'input' }), { target: { value: '' } })
        return { error: true, result: ['Bad version'] }
      })
      mount(request)
      fireEvent.change(version(), { target: { value: 'abc' } })
      focusSave()
      await clickSave()
      expect(saveButton()).toBeDisabled()
      const notice = screen.getByText("We couldn't save your changes. Bad version").closest('[tabindex="-1"]')
      expect(notice).not.toBeNull()
      await waitFor(() => expect(notice).toHaveFocus())
    })

    it('focus the owner moved somewhere else while it saved is not taken away', async () => {
      const request = vi.fn(async () => {
        screen.getByLabelText('Name', { selector: 'input' }).focus()
        return { error: false, result: { version: '2.0.0' } }
      })
      mount(request)
      fireEvent.change(version(), { target: { value: '2.0.0' } })
      focusSave()
      await clickSave()
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
      expect(screen.getByLabelText('Name', { selector: 'input' })).toHaveFocus()
    })
  })

  describe('Credentials', () => {
    const app = { id: 1, base: { platforms: ['ios', 'android'] }, ios_credentials: { team_id: 'T1' }, android_credentials: {} }
    const mount = (updateProductAppCredentials) => {
      renderWithProviders(<CredentialsSection app={app} updateProductAppCredentials={updateProductAppCredentials} updateAppValues={vi.fn()} />)
    }
    const teamId = () => screen.getByLabelText('Team id', { selector: 'input' })

    it('after a good Save the focus is on the «Saved» line and the toast still fires', async () => {
      mount(lastRequest({ error: false, result: { team_id: 'new' } }))
      fireEvent.change(teamId(), { target: { value: 'new' } })
      focusSave()
      await clickSave()
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Saved')
      expect(status).toHaveAttribute('tabindex', '-1')
      await waitFor(() => expect(status).toHaveFocus())
      expect(mockToast.showToast).toHaveBeenCalledWith('success', 'Credentials saved successfully')
    })

    it('after a failure the focus is on the notice that says why, and the toast still fires', async () => {
      mount(lastRequest({ error: true, result: ['Bad team'] }))
      fireEvent.change(teamId(), { target: { value: 'typed' } })
      focusSave()
      await clickSave()
      expect(screen.getByText("We couldn't save your changes. Bad team")).toBeInTheDocument()
      expect(screen.queryByText('Saved')).toBeNull()
      expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Bad team')
      const notice = screen.getByText("We couldn't save your changes. Bad team").closest('[tabindex="-1"]')
      await waitFor(() => expect(notice).toHaveFocus())
    })
  })

  describe('Files', () => {
    const baseActions = [
      { id: 10, name: 'Google services', group: 'files', source_path: 'old-a.json', file_rules: { extension: 'json', max_size: 2048 } }
    ]
    const mount = (updateBaseActions) => {
      renderWithProviders(<FilesSection app={{ id: 1, baseActions }} updateBaseActions={updateBaseActions} updateAppValues={vi.fn()} />)
    }
    const pick = async () => {
      const input = document.querySelector('input[type="file"][name="Google services"]')
      await act(async () => { await userEvent.upload(input, new File(['{}'], 'new.json', { type: 'application/json' })) })
    }

    it('after a good Save the focus is on the «Saved» line and the toast still fires', async () => {
      mount(lastRequest({ error: false, result: { id: 10, source_path: 'new.json' } }))
      await pick()
      focusSave()
      await clickSave()
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Saved')
      expect(status).toHaveAttribute('tabindex', '-1')
      await waitFor(() => expect(status).toHaveFocus())
      expect(mockToast.showToast).toHaveBeenCalledWith('success', 'Correctly saved files')
    })

    it('after a failure the focus is on the notice that says why, and the toast still fires', async () => {
      mount(lastRequest({ error: true, result: ['Too big'] }))
      await pick()
      focusSave()
      await clickSave()
      expect(screen.getByText("We couldn't save your changes. Too big")).toBeInTheDocument()
      expect(screen.queryByText('Saved')).toBeNull()
      expect(mockToast.showToast).toHaveBeenCalledWith('error', 'Too big')
      const notice = screen.getByText("We couldn't save your changes. Too big").closest('[tabindex="-1"]')
      await waitFor(() => expect(notice).toHaveFocus())
    })
  })

  describe('Constants (they save by themselves and are disabled while they do)', () => {
    const baseConstants = [
      { id: 1, code: 'api_url', name: 'Api url', type: 'string', value: '' },
      { id: 2, code: 'dark_mode', name: 'Dark mode', type: 'boolean', value: '0' }
    ]
    const mount = (updateBaseContants) => {
      renderWithProviders(<ConstantsSection app={{ id: 1, baseConstants }} updateBaseContants={updateBaseContants} updateAppValues={vi.fn()} />)
    }
    const apiUrl = () => screen.getByLabelText('Api url', { selector: 'input' })

    it('after the autosave of a text the focus is back on the field being edited, with what was typed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mount(lastRequest({ error: false, result: { id: 1, value: 'abc' } }))
      act(() => { apiUrl().focus() })
      fireEvent.change(apiUrl(), { target: { value: 'abc' } })
      await act(async () => { vi.advanceTimersByTime(750) })
      await settle()
      await act(async () => { vi.advanceTimersByTime(10) })
      expect(apiUrl()).toBeEnabled()
      expect(apiUrl()).toHaveValue('abc')
      expect(apiUrl()).toHaveFocus()
    })

    it('after a failed autosave the focus is back on the field, which shows the error', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mount(lastRequest({ error: true, result: ['Bad value'] }))
      act(() => { apiUrl().focus() })
      fireEvent.change(apiUrl(), { target: { value: 'abc' } })
      await act(async () => { vi.advanceTimersByTime(750) })
      await settle()
      await act(async () => { vi.advanceTimersByTime(10) })
      expect(screen.getByRole('alert')).toHaveTextContent('Bad value')
      expect(apiUrl()).toHaveFocus()
    })

    it('after the checkbox saves at once the focus is back on the checkbox', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mount(lastRequest({ error: false, result: { id: 2, value: true } }))
      const checkbox = screen.getByRole('checkbox', { name: 'Dark mode' })
      act(() => { checkbox.focus() })
      await act(async () => { fireEvent.click(checkbox) })
      await settle()
      // useKeepFocus tries at 0 ms and, while the checkbox is still disabled, retries every 50 ms (3 times). With
      // `shouldAdvanceTime` the 0 ms try can run before React re-enables it on a loaded runner, so 10 ms missed the retry: cover them all.
      await act(async () => { vi.advanceTimersByTime(200) })
      expect(screen.getByRole('checkbox', { name: 'Dark mode' })).toHaveFocus()
    })
  })
})

// ── R1-01 · nothing in these sections forces the page wider than a phone ─────────────────────────────────────────────────────────
// The legacy InputFile (`BasicAppSettings/styles.js`) gives its drop zone a 350 px input plus padding, ~394 px, which does not fit a
// 358 px field at 390. jsdom has no layout, so this only checks that the override is in the sheet; the width at 390 is measured in the
// browser (review R1-01).
describe('R1-01: the legacy file drop zone does not impose a minimum width', () => {
  const css = readFileSync(resolve('src/@/components-dashboard/src/ui/src/components/MyProducts/AppEditor/app-sections.css'), 'utf8')
  const ruleOf = (selector) => {
    const match = css.match(new RegExp(`${selector.replace(/[.#[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
    return match ? match[1] : ''
  }

  it('.odc-aps .drop-container can shrink to its column (stable class, not a styled-components hash)', () => {
    const rule = ruleOf('.odc-aps .drop-container')
    expect(rule).toMatch(/min-inline-size:\s*0\b/)
    expect(rule).toMatch(/inline-size:\s*100%/)
    expect(rule).toMatch(/max-inline-size:\s*100%/)
    expect(rule).toMatch(/box-sizing:\s*border-box/)
  })

  it('the path of the current file breaks anywhere instead of pushing the page', () => {
    expect(ruleOf('.odc-aps #current-file')).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('the override uses no hashed class', () => {
    expect(css).not.toMatch(/\.sc-[a-zA-Z0-9]+/)
  })
})
