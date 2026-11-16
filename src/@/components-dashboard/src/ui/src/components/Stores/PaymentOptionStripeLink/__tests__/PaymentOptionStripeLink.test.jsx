/* eslint-disable import/first */
// redesign stores 5.10a: Stripe Link on ProviderPanel. The controller is mocked to hand the props to the UI (the real one loads
// and saves the business configs); this spec checks what the form configures: tabs, the Stripe / Twilio notice, the four keys, and the Twilio
// configs that close General and save by themselves (a secret when it is left, a select when it changes), never through the save bar.
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../../../../index', async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useSession: () => [{ user: { level: 0 } }],
    useConfig: () => [{ configs: {} }],
    useApi: () => [{ project: 'acme' }],
    useToast: () => [{}, { showToast: mocks.showToast }],
    ToastType: { Error: 'error', Success: 'success', Info: 'info' },
    PaymentOptionStripeLink: ({ UIComponent, ...props }) => ReactModule.createElement(UIComponent, props)
  }
})

import { PaymentOptionStripeLink } from '../index'

const ORDER_TYPES = [
  { value: 1, text: 'Delivery' },
  { value: 2, text: 'Pickup' }
]
const SITES = [{ id: 10, name: 'Web' }]

const record = (extra = {}) => ({
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: { publishable: 'pk_live_1', secret: 'sk_live_1' },
  data_sandbox: { publishable: 'pk_test_1', secret: 'sk_test_1' },
  allowed_order_types: [1, 2],
  sites: [],
  devices: [],
  ...extra
})

const CONFIGS = [
  { id: 101, key: 'allow_text_messages_sms', name: 'Text messages by SMS', type: 2, value: 'no', options: [{ value: 'no', text: 'No' }, { value: 'yes', text: 'Yes' }] },
  { id: 102, key: 'twilio_token', name: 'Twilio token', type: 7, value: 'old-token' },
  { id: 103, key: 'allow_text_messages_whatsapp', name: 'Twilio WhatsApp secret', type: 7, value: 'old-wa' },
  { id: 104, key: 'something_else', name: 'Not for this form', type: 7, value: 'x' }
]

const setup = (props = {}) => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  const onTabChange = vi.fn()
  const handleUpdateConfigs = vi.fn()
  const form = (extra = {}) => (
    <PaymentOptionStripeLink
      paymethod={{ id: 1, gateway: 'stripe_link', name: 'Stripe link', data_template: null }}
      businessPaymethod={record()}
      gatewayName='Stripe link'
      storeName='Burger Hub'
      sites={SITES}
      devices={[]}
      orderTypes={ORDER_TYPES}
      business={{ id: 7 }}
      configsState={{ loading: false, error: null, configs: CONFIGS }}
      actionState={{ loading: false, error: null }}
      handleUpdateConfigs={handleUpdateConfigs}
      onSave={onSave}
      onTabChange={onTabChange}
      {...props}
      {...extra}
    />
  )
  const { rerender } = renderWithProviders(form(), { theme })
  return { user, onSave, onTabChange, handleUpdateConfigs, rerenderWith: extra => rerender(form(extra)) }
}

// the Show button of a secret is also named through the field's label, so only the input counts
const input = (scope, name) => within(scope).getAllByLabelText(name).find(node => node.tagName === 'INPUT')
const live = () => screen.getByRole('group', { name: 'Live credentials' })
const sandbox = () => screen.getByRole('group', { name: 'Sandbox credentials' })
const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const replaceText = async (user, node, text) => {
  await user.clear(node)
  if (text) await user.type(node, text)
}

beforeEach(() => {
  mocks.showToast.mockClear()
})

describe('tabs', () => {
  it('offers General (0), Channels (1) and Order type (2) with the indices of main', async () => {
    const { user, onTabChange } = setup()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Channels', 'Order type'])
    await user.click(screen.getByRole('tab', { name: 'Channels' }))
    expect(onTabChange).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(onTabChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('tab', { name: 'General' }))
    expect(onTabChange).toHaveBeenLastCalledWith(0)
  })

  it('drops Channels when the store has no sites, and honours initialTab', () => {
    setup({ sites: [], initialTab: 2 })
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Order type'])
    expect(screen.getByRole('tab', { name: 'Order type' })).toHaveAttribute('aria-selected', 'true')
  })

  it('has no legacy shell: no title with a menu, no X, no tabs of its own', () => {
    setup()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })
})

describe('General: notice and keys', () => {
  it('shows the Stripe and Twilio notice at the top of General only', async () => {
    const { user } = setup()
    const notice = screen.getByText('Stripe and Twilio keys are required to use this Payment Method')
    expect(follows(notice, screen.getByRole('button', { name: 'Sandbox' }))).toBe(true)
    expect(follows(notice, live())).toBe(true)
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.queryByText('Stripe and Twilio keys are required to use this Payment Method')).not.toBeInTheDocument()
  })

  it('draws a publishable and a secret key per mode, the secrets hidden', () => {
    setup()
    expect(input(live(), 'Publishable key')).toHaveValue('pk_live_1')
    expect(input(live(), 'Publishable key')).toHaveAttribute('type', 'text')
    expect(input(live(), 'Secret key')).toHaveValue('sk_live_1')
    expect(input(live(), 'Secret key')).toHaveAttribute('type', 'password')
    expect(input(sandbox(), 'Publishable key')).toHaveValue('pk_test_1')
    expect(input(sandbox(), 'Publishable key')).toHaveAttribute('type', 'text')
    expect(input(sandbox(), 'Secret key')).toHaveValue('sk_test_1')
    expect(input(sandbox(), 'Secret key')).toHaveAttribute('type', 'password')
  })

  it('G4-04: two saves in a row each send the full data object', async () => {
    const { user, onSave } = setup()
    await replaceText(user, input(live(), 'Secret key'), 'sk_live_2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenNthCalledWith(1, { data: { publishable: 'pk_live_1', secret: 'sk_live_2' } })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    await replaceText(user, input(live(), 'Publishable key'), 'pk_live_2')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenNthCalledWith(2, { data: { publishable: 'pk_live_2', secret: 'sk_live_2' } })
  })

  it('shows a failed save in the bar and keeps what was typed', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: ['Invalid API key'] })
    const { user } = setup({ onSave })
    await replaceText(user, input(sandbox(), 'Secret key'), 'sk_test_bad')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid API key')
    expect(input(sandbox(), 'Secret key')).toHaveValue('sk_test_bad')
  })
})

describe('General: the Twilio configs', () => {
  it('come after the keys, under the Twilio message, and only for the two text-message keys', () => {
    setup()
    const message = screen.getByText('*Enable these options after twilio configuration')
    expect(follows(input(sandbox(), 'Secret key'), message)).toBe(true)
    const token = input(document.body, 'Twilio WhatsApp secret')
    expect(follows(message, token)).toBe(true)
    expect(screen.getByText('Text messages by SMS')).toBeInTheDocument()
    expect(screen.queryByLabelText('Not for this form')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Twilio token')).not.toBeInTheDocument()
  })

  it('are not on the other tabs, and wait while they load', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('tab', { name: 'Order type' }))
    expect(screen.queryByText('*Enable these options after twilio configuration')).not.toBeInTheDocument()
    expect(screen.queryByText('Text messages by SMS')).not.toBeInTheDocument()
  })

  it('draw nothing but the message while loading', () => {
    setup({ configsState: { loading: true, error: null, configs: CONFIGS } })
    expect(screen.getByText('*Enable these options after twilio configuration')).toBeInTheDocument()
    expect(screen.queryByText('Text messages by SMS')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Twilio WhatsApp secret')).not.toBeInTheDocument()
  })

  it('a secret config is hidden, has Show, and is saved once when the field is left, never while typing', async () => {
    const { user, handleUpdateConfigs } = setup()
    const secret = input(document.body, 'Twilio WhatsApp secret')
    expect(secret).toHaveAttribute('type', 'password')
    expect(secret).toHaveValue('old-wa')
    expect(screen.getAllByRole('button', { name: /^Show/ }).length).toBeGreaterThan(0)
    await user.clear(secret)
    await user.type(secret, 'new-wa')
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
    await user.tab() // to its own Show: still inside the field
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
    await user.tab() // out of the field
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
    expect(handleUpdateConfigs).toHaveBeenCalledWith(103, { value: 'new-wa' })
    secret.focus()
    await user.tab()
    await user.tab()
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
  })

  // review 5.10a #1: Show / Hide take the focus from the input; that is not leaving the field
  it('pressing Show or Hide on a half-typed secret config does not save it', async () => {
    const { user, handleUpdateConfigs } = setup()
    const secret = input(document.body, 'Twilio WhatsApp secret')
    await user.clear(secret)
    await user.type(secret, 'AC12')
    const show = screen.getByRole('button', { name: 'Show Twilio WhatsApp secret' })
    await user.click(show)
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hide Twilio WhatsApp secret' }))
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
    await user.click(secret)
    await user.type(secret, '34')
    await user.click(document.body)
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
    expect(handleUpdateConfigs).toHaveBeenCalledWith(103, { value: 'AC1234' })
  })

  it('a secret config left as it was is not saved', async () => {
    const { user, handleUpdateConfigs } = setup()
    const secret = input(document.body, 'Twilio WhatsApp secret')
    await user.click(secret)
    await user.tab()
    await user.tab()
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
  })

  it('Enter leaves the secret config and saves it once', async () => {
    const { user, handleUpdateConfigs } = setup()
    const secret = input(document.body, 'Twilio WhatsApp secret')
    await user.type(secret, '2{Enter}')
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
    expect(handleUpdateConfigs).toHaveBeenCalledWith(103, { value: 'old-wa2' })
  })

  it('a select config is labelled, shows its value, and saves when the choice changes', async () => {
    const { user, handleUpdateConfigs } = setup()
    const trigger = screen.getByRole('button', { name: /Text messages by SMS/ })
    expect(trigger).toHaveTextContent('No')
    expect(handleUpdateConfigs).not.toHaveBeenCalled()
    await user.click(trigger)
    await user.click(await screen.findByText('Yes'))
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
    expect(handleUpdateConfigs).toHaveBeenCalledWith(101, { value: 'yes' })
  })

  // redesign bugs F row 33: the select keeps what was chosen; when the API refuses it, it goes back to the stored value
  it('a select config goes back to the stored value when its save fails', async () => {
    const { user, rerenderWith } = setup()
    const trigger = () => screen.getByRole('button', { name: /Text messages by SMS/ })
    await user.click(trigger())
    await user.click(await screen.findByText('Yes'))
    expect(trigger()).toHaveTextContent('Yes')
    rerenderWith({ actionState: { loading: false, error: ['Twilio refused the change'] } })
    expect(trigger()).toHaveTextContent('No')
  })

  it('a select config keeps the choice while no save has failed', async () => {
    const { user, rerenderWith } = setup()
    await user.click(screen.getByRole('button', { name: /Text messages by SMS/ }))
    await user.click(await screen.findByText('Yes'))
    rerenderWith({ actionState: { loading: true, error: null } })
    expect(screen.getByRole('button', { name: /Text messages by SMS/ })).toHaveTextContent('Yes')
  })

  it('do not count as changes of the save bar', async () => {
    const { user, handleUpdateConfigs } = setup()
    const secret = input(document.body, 'Twilio WhatsApp secret')
    await replaceText(user, secret, 'typed')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.click(document.body)
    expect(handleUpdateConfigs).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('a failed config save shows as an error toast', () => {
    setup({ actionState: { loading: false, error: ['Twilio refused the token'] } })
    expect(mocks.showToast).toHaveBeenCalledWith('error', 'Twilio refused the token')
  })
})
