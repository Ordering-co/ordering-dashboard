/* eslint-disable import/first */
// redesign settings D: EmailSetting inside the Settings hub (SettingsHubFormContext provider) draws the shared save bar,
// reports to the hub and stays mounted but inert while it saves. Without the provider it is the screen of today. The real
// controller drives the real UI; only the API call (`saveConfigRequest`) and the contexts are replaced.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  refreshConfigs: vi.fn(),
  showToast: vi.fn()
}))

const translate = (key, fallback) => fallback ?? key

vi.mock('../../../../../../index', async () => {
  const { SettingsList } = await import('../../../../../../components/SettingsList')
  return {
    useLanguage: () => [{ dictionary: {} }, translate],
    useConfig: () => [{ configs: {} }, { refreshConfigs: mocks.refreshConfigs }],
    SettingsList
  }
})

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ loading: false, token: 'token' }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{}] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ dictionary: {} }, translate] }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }, { refreshConfigs: mocks.refreshConfigs }]
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alertdialog' data-testid='legacy-alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null
}))

import { SettingsHubFormContext } from '../../SettingsHubForm/SettingsHubFormContext'
import { EmailSetting } from '../index'

const deferred = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, resolve: release }
}

const okSave = () => vi.fn(async (id, params) => ({ error: false, result: { id, value: params.value } }))

const categoryOf = () => ({
  id: 7,
  key: 'email_category',
  configs: [
    { id: 10, key: 'email_superadmin_states', name: 'Administrator emails', description: 'Statuses that email the administrator.', type: 3, value: '0|1', options: [{ value: '0' }, { value: '1' }, { value: '4' }] },
    { id: 11, key: 'email_business_states', name: 'Business emails', description: 'Statuses that email the business.', type: 3, value: '7', options: [{ value: '7' }, { value: '4' }] },
    { id: 12, key: 'email_customer_states', name: 'Customer emails', description: 'Statuses that email the customer.', type: 3, value: '', options: [{ value: '0' }] }
  ]
})

const renderEmail = ({ saveConfigRequest = okSave(), report = vi.fn(), hub, focus } = {}) => {
  const hubValue = hub === undefined ? { product: true, report } : hub
  const category = categoryOf()
  const view = renderWithProviders(
    <SettingsHubFormContext.Provider value={hubValue}>
      <EmailSetting category={category} saveConfigRequest={saveConfigRequest} focus={focus} isRemoveGeneralTitle onCloseSettingsList={() => null} />
    </SettingsHubFormContext.Provider>
  )
  return { ...view, saveConfigRequest, report }
}

const barOf = () => screen.queryByRole('group', { name: 'Save changes' })

const chooseLevel = async (name) => {
  await userEvent.click(screen.getByText('Administrator'))
  await userEvent.click(await screen.findByText(name))
}

beforeEach(() => {
  mocks.refreshConfigs.mockClear()
  mocks.showToast.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('EmailSetting inside the hub', () => {
  it('draws no bar until something changes, and never the legacy Save button', async () => {
    renderEmail()
    expect(barOf()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    expect(barOf()).toBeInTheDocument()
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(barOf()).getByText(/Administrator emails/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('saves through the same controller path from «Save changes»', async () => {
    const { saveConfigRequest } = renderEmail()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))
    expect(saveConfigRequest).toHaveBeenCalledWith(10, { key: 'email_superadmin_states', value: '0|1|4' })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'))
  })

  it('Discard gives the checkboxes their stored values back and removes the bar', async () => {
    renderEmail()
    const completed = screen.getByRole('checkbox', { name: 'Completed by admin' })
    const pending = screen.getByRole('checkbox', { name: 'Pending' })
    expect(completed).toBeChecked()
    await userEvent.click(completed)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await userEvent.click(pending)
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(barOf()).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Completed by admin' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Pending' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Preparation completed' })).not.toBeChecked()
  })

  it('stays mounted, inert and busy while saving, with no skeleton', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const view = renderEmail({ saveConfigRequest })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    const checkbox = screen.getByRole('checkbox', { name: 'Preparation completed' })
    const form = view.container.querySelector('.odc-hub-form')
    expect(form).toBeTruthy()
    expect(form).not.toHaveAttribute('inert')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(saveConfigRequest).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('checkbox', { name: 'Preparation completed' })).toBe(checkbox)
    expect(view.container.querySelector('.odc-hub-form')).toBe(form)
    expect(form).toHaveAttribute('inert')
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'true')

    await act(async () => { pending.resolve({ error: false, result: { id: 10, value: '0|1|4' } }) })
    await waitFor(() => expect(form).not.toHaveAttribute('inert'))
    expect(form).not.toHaveAttribute('aria-busy')
  })

  it('puts an API failure in the bar, keeps the change and opens no legacy alert', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['Invalid status'] }))
    renderEmail({ saveConfigRequest })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('We couldn\'t save your changes. Invalid status')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-alert')).toBeNull()
  })

  it('says how many were stored and which one failed when the second request fails', async () => {
    const saveConfigRequest = vi.fn(async (id, params) => (
      id === 10
        ? { error: false, result: { id, value: params.value } }
        : { error: true, result: ['Business statuses are locked'] }
    ))
    renderEmail({ saveConfigRequest })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    await chooseLevel('Business')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const alert = await within(barOf()).findByRole('alert')
    expect(alert).toHaveTextContent('Saved 1 of 2. Business emails failed: Business statuses are locked')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  })

  it('tells the hub the dirty and saving state of its category, and drops the report on unmount', async () => {
    const pending = deferred()
    const saveConfigRequest = vi.fn(() => pending.promise)
    const report = vi.fn()
    const view = renderEmail({ saveConfigRequest, report })
    expect(report).toHaveBeenLastCalledWith('email_category', { dirty: false, saving: false })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    expect(report).toHaveBeenLastCalledWith('email_category', { dirty: true, saving: false })

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(report).toHaveBeenLastCalledWith('email_category', { dirty: true, saving: true }))

    view.unmount()
    expect(report).toHaveBeenLastCalledWith('email_category', null)
  })
})

// `?focus=` (a search result) opens the level that holds the key, marks its row and puts the focus on its first control.
describe('EmailSetting with ?focus=', () => {
  it('opens the level of the key, marks its row and focuses its first checkbox', async () => {
    const { container } = renderEmail({ focus: 'email_business_states' })

    const row = container.querySelector('#settings-focus-email_business_states')
    expect(row).toBeTruthy()
    expect(screen.getByText('Business')).toBeInTheDocument()
    const first = within(row).getAllByRole('checkbox')[0]
    await waitFor(() => expect(first).toHaveFocus())
    // the administrator's rows are not on screen: the focused level is
    expect(screen.queryByRole('checkbox', { name: 'Completed by admin' })).toBeNull()
  })

  // review of batch S: a level is ~1600px tall; centred, its label, selector and focused checkbox were above the screen
  it('shows a level taller than the screen from its start', async () => {
    const scroll = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 1600, left: 0, right: 800, width: 800, height: 1600, x: 0, y: 0 })
    renderEmail({ focus: 'email_business_states' })
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'start' }))
    rect.mockRestore()
    Element.prototype.scrollIntoView = original
  })

  it('lands the focus once for each value of `focus`, not again after the form re-renders', async () => {
    const { container, rerender } = renderEmail({ focus: 'email_business_states' })
    const boxes = () => within(container.querySelector('#settings-focus-email_business_states')).getAllByRole('checkbox')
    await waitFor(() => expect(boxes()[0]).toHaveFocus())

    boxes()[1].focus()
    expect(boxes()[1]).toHaveFocus()
    rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report: vi.fn() }}>
        <EmailSetting category={categoryOf()} saveConfigRequest={okSave()} focus='email_business_states' isRemoveGeneralTitle onCloseSettingsList={() => null} />
      </SettingsHubFormContext.Provider>
    )
    expect(boxes()[1]).toHaveFocus()
  })

  it('switches to the level of a new `focus` while the section stays open (a second search result)', async () => {
    const { container, rerender } = renderEmail({ focus: 'email_business_states' })
    await waitFor(() => expect(container.querySelector('#settings-focus-email_business_states')).toBeTruthy())

    rerender(
      <SettingsHubFormContext.Provider value={{ product: true, report: vi.fn() }}>
        <EmailSetting category={categoryOf()} saveConfigRequest={okSave()} focus='email_customer_states' isRemoveGeneralTitle onCloseSettingsList={() => null} />
      </SettingsHubFormContext.Provider>
    )
    const row = await waitFor(() => {
      const found = container.querySelector('#settings-focus-email_customer_states')
      expect(found).toBeTruthy()
      return found
    })
    await waitFor(() => expect(within(row).getAllByRole('checkbox')[0]).toHaveFocus())
    expect(within(container.querySelector('.od-first-select-trigger')).getByText('Customer')).toBeInTheDocument()
  })

  it('keeps the administrator level and takes no focus when there is no `focus`', () => {
    renderEmail()
    expect(screen.getByRole('checkbox', { name: 'Completed by admin' })).not.toHaveFocus()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('EmailSetting without the hub', () => {
  it('keeps its own Save button and its Alert', async () => {
    const saveConfigRequest = vi.fn(async () => ({ error: true, result: ['Invalid status'] }))
    renderEmail({ hub: null, saveConfigRequest })
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Preparation completed' }))
    expect(barOf()).toBeNull()
    expect(screen.queryByText('1 unsaved change')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByTestId('legacy-alert')).toHaveTextContent('Invalid status')
  })
})
