/* eslint-disable import/first */
// redesign stores 5.11: Stripe Connect on ProviderPanel (decision B-1). The OAuth window is the controller's `onConnect`,
// mocked here: it is never opened for real. Its answer enters the draft (unsaved changes) and Save stores it; the four keys are read-only,
// the two tokens hidden (decision 7), only the keys of the mode in use show, and the platform fees (level 0) are fields of the business
// that reach `onSave` as `changes.extra` (B-2).
import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const mocks = vi.hoisted(() => ({ level: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: mocks.level } }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'acme' }],
  useToast: () => [{}, { showToast: () => {} }]
}))

import { PaymethodOptionStripeConnect } from '../../PaymethodOptionStripeConnect'

const ORDER_TYPES = [{ value: 1, text: 'Delivery' }, { value: 2, text: 'Pickup' }]
const SITES = [{ id: 10, name: 'Web' }]

const LIVE = { token: 'mock_01_xxxxxxxxxxxxAAAA', publishable: 'mock_02_xxxxxxxxxxxxBBBB', user: 'acct_live', refresh_token: 'rt_live_000000000000CCCC' }
const TEST = { token: 'mock_03_xxxxxxxxxxxxDDDD', publishable: 'mock_04_xxxxxxxxxxxxEEEE', user: 'acct_test', refresh_token: 'rt_test_000000000000FFFF' }

const record = (extra = {}) => ({
  id: 41,
  paymethod_id: 31,
  enabled: true,
  sandbox: false,
  data: { ...LIVE },
  data_sandbox: {},
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const setup = (props = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onConnect = vi.fn()
  renderWithProviders(
    <PaymethodOptionStripeConnect
      paymethod={{ id: 31, gateway: 'stripe_connect', name: 'Stripe connect', data_template: null }}
      businessPaymethod={record()}
      gatewayName='Stripe connect'
      storeName='Burger Hub'
      sites={SITES}
      devices={[]}
      orderTypes={ORDER_TYPES}
      onSave={onSave}
      onConnect={onConnect}
      business={{ id: 7, fixed_usage_fee: 0, percentage_usage_fee: '14' }}
      {...props}
    />,
    { theme }
  )
  return { user, onSave, onConnect }
}

// a secret's Show button is also named through the field's label, so only the input counts
const input = (name) => screen.getAllByLabelText(name).find(node => node.tagName === 'INPUT')
const connectButton = () => screen.getByRole('button', { name: /Connect with stripe/i })

beforeEach(() => {
  mocks.level = 0
})

describe('PaymethodOptionStripeConnect on ProviderPanel', () => {
  it('offers General, Channels and Order type with the indices of main, and never connects on its own', async () => {
    const onTabChange = vi.fn()
    const { user, onConnect } = setup({ onTabChange })
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Channels', 'Order type'])
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('shows the keys of the mode in use, read-only, with the two tokens hidden (decision 7)', () => {
    setup()
    expect(input('Access token ID')).toHaveAttribute('type', 'password')
    expect(input('Refresh token')).toHaveAttribute('type', 'password')
    expect(input('Publishable key')).toHaveAttribute('type', 'text')
    expect(input('User ID')).toHaveDisplayValue('acct_live')
    for (const name of ['Access token ID', 'Publishable key', 'User ID', 'Refresh token']) {
      expect(input(name)).toHaveAttribute('readonly')
    }
    expect(screen.queryByText(LIVE.token)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Live credentials' })).not.toBeInTheDocument()
  })

  it('a record in sandbox shows its sandbox keys (main always drew `data`)', () => {
    setup({ businessPaymethod: record({ sandbox: true, data: {}, data_sandbox: { ...TEST } }) })
    expect(input('User ID')).toHaveDisplayValue('acct_test')
  })

  it('the OAuth answer fills the draft and Save stores it, as main stored it with its Save', async () => {
    const { user, onSave, onConnect } = setup()
    const fresh = { ...LIVE, user: 'acct_new' }
    onConnect.mockResolvedValue({ ok: true, sandbox: false, data: fresh })
    await user.click(connectButton())
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    expect(input('User ID')).toHaveDisplayValue('acct_new')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: fresh })
  })

  it('a test-mode answer on a live, enabled gateway asks before switching to sandbox (decision 6)', async () => {
    const { user, onSave, onConnect } = setup()
    onConnect.mockResolvedValue({ ok: true, sandbox: true, data: TEST })
    await user.click(connectButton())
    // the mode and the four keys of the sandbox
    await screen.findByText('5 unsaved changes')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(onSave).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Use sandbox' }))
    expect(onSave).toHaveBeenCalledWith({ sandbox: true, data_sandbox: TEST })
  })

  it('a blocked window says so, and nothing changes', async () => {
    const { user, onConnect } = setup()
    onConnect.mockResolvedValue({ ok: false, reason: 'blocked' })
    await user.click(connectButton())
    expect(await screen.findByText(/blocked the Stripe window/)).toBeInTheDocument()
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()
  })

  it('a window closed without an answer says nothing', async () => {
    const { user, onConnect } = setup()
    onConnect.mockResolvedValue({ ok: false, reason: 'closed' })
    await user.click(connectButton())
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/blocked the Stripe window|did not connect/)).not.toBeInTheDocument()
  })

  it('level 0: the fees are numbers of the business, saved alone (G4-09) as changes.extra', async () => {
    const { user, onSave } = setup()
    const fixed = input('Fixed fee')
    expect(fixed).toHaveDisplayValue('0')
    expect(input('Percentage fee')).toHaveDisplayValue('14')
    await user.clear(fixed)
    await user.type(fixed, '2.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ extra: { fixed_usage_fee: '2.5' } })
  })

  it('a percentage above 100 is a notice that does not block the save', async () => {
    const { user, onSave } = setup()
    const percentage = input('Percentage fee')
    await user.clear(percentage)
    await user.type(percentage, '140')
    await user.tab()
    expect(screen.getByText(/Usually between 0 and 100/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ extra: { percentage_usage_fee: '140' } })
  })

  it('a business owner sees no fees, as main', () => {
    mocks.level = 2
    setup()
    expect(screen.queryByLabelText('Fixed fee')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Percentage fee')).not.toBeInTheDocument()
  })

  it('R2: a failed save is said in the bar, with the reason, and the draft stays', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: ['The payment method was saved, but the fees were not.', 'Invalid fee'] })
    const { user } = setup({ onSave })
    const fixed = input('Fixed fee')
    await user.clear(fixed)
    await user.type(fixed, '3')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/saved, but the fees were not\. Invalid fee/)).toBeInTheDocument()
    expect(input('Fixed fee')).toHaveDisplayValue('3')
  })

  // review 5.11 F2: the gateway part was stored, the fees were not: only the fees stay unsaved, a retry sends only them and Discard
  // takes back only them
  it('a partial save keeps only the fees as changes', async () => {
    const onSave = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['The payment method was saved, but the fees were not.'], unsaved: ['extra'] })
      .mockResolvedValueOnce({ ok: false, error: ['Still failing'], unsaved: ['extra'] })
    const { user } = setup({ onSave })
    const fixed = input('Fixed fee')
    await user.clear(fixed)
    await user.type(fixed, '3')
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    await user.click(screen.getByRole('checkbox', { name: 'Pickup' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenLastCalledWith({ allowed_order_types: [1], extra: { fixed_usage_fee: '3' } })
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onSave).toHaveBeenLastCalledWith({ extra: { fixed_usage_fee: '3' } })
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByRole('checkbox', { name: 'Pickup' })).not.toBeChecked()
    await user.click(screen.getByRole('tab', { name: 'General' }))
    expect(input('Fixed fee')).toHaveDisplayValue('0')
  })

  // review 5.11 F3: the first window's flow ends as «closed» when Connect is pressed again; the second is still waiting
  it('a second Connect keeps waiting for the second window', async () => {
    const { user, onConnect } = setup()
    let finishFirst
    let finishSecond
    onConnect
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve }))
    await user.click(connectButton())
    await user.click(connectButton())
    await act(async () => { finishFirst({ ok: false, reason: 'closed' }) })
    expect(screen.getByText(/Finish in the Stripe window/)).toBeInTheDocument()
    expect(connectButton()).toHaveAttribute('aria-busy', 'true')
    finishSecond({ ok: true, sandbox: false, data: { ...LIVE, user: 'acct_second' } })
    expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
    expect(connectButton()).not.toHaveAttribute('aria-busy')
  })
})
