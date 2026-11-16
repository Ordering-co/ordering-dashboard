/* eslint-disable import/first */
// redesign stores 5.11 (E3): the store's payout account on Product pieces. Pinned here: G4-27 (a failed load is an error
// with «Try again» and offers neither to create nor to associate), the create form in sight (main needed a card click first) with
// its inline validation and inline API error (no modal Alert), the associate search, the read-only view with every payout datum
// hidden (decision 7), the in-place edit with its save bar / leave guard / error, the owner's read-only notice, and the dissociate
// confirmation (decision 6). The controller is a stub: the props are its state and the callbacks are spies.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ api: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  BusinessPaymentAccount: ({ UIComponent, ...rest }) => <UIComponent {...rest} {...mocks.api} />
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { BusinessPaymentAccount } from '../index'

const STRIPE = {
  gateway: 'stripe',
  name: 'Stripe',
  cycle: 'weekly',
  cycle_day: 1,
  cycle_time: '09:00',
  data_template: [
    { key: 'secret_key', name: 'Secret key', required: true, type: 'password' },
    { key: 'account_label', name: 'Account label', required: false, type: 'text' }
  ]
}
const PAYPAL = {
  gateway: 'paypal',
  name: 'PayPal',
  cycle: 'monthly',
  cycle_day: 15,
  data_template: [{ key: 'email', name: 'PayPal email', required: true, type: 'text' }]
}
const SECRET = 'mock_01_xxxxxxxxxgXYZ'
const ACCOUNT = { id: 5, paymethod: 'stripe', name: 'Main payouts', enabled: true, data: { secret_key: SECRET, account_label: '' } }
const EXISTING = [
  { id: 6, paymethod: 'paypal', name: 'PayPal EU' },
  { id: 7, paymethod: 'stripe', name: '' }
]

const baseApi = () => ({
  isAdmin: true,
  isBusinessOwner: false,
  accountState: { loading: false, error: null, account: null },
  methodsState: { loading: false, error: null, methods: [STRIPE, PAYPAL] },
  allAccountsState: { loading: false, error: null, accounts: [] },
  actionState: { loading: false, error: null },
  createAccount: vi.fn(async () => ({ error: false, result: { id: 9 } })),
  updateAccount: vi.fn(async () => ({ error: false, result: {} })),
  associateAccount: vi.fn(async () => ({ error: false, result: {} })),
  dissociateAccount: vi.fn(async () => ({ error: false, result: {} })),
  getAccount: vi.fn(),
  getMethods: vi.fn()
})

// `api` overrides the controller's props; `host` is the leave-guard host
const draw = (api = {}, host = null, props = {}) => {
  mocks.api = { ...baseApi(), ...api }
  const view = render(
    <LeaveGuardContext.Provider value={host}>
      <BusinessPaymentAccount businessId={7} {...props} />
    </LeaveGuardContext.Provider>
  )
  return { api: mocks.api, ...view }
}

const withAccount = (extra = {}) => ({
  accountState: { loading: false, error: null, account: ACCOUNT },
  allAccountsState: { loading: false, error: null, accounts: [ACCOUNT, ...EXISTING] },
  ...extra
})
const withExisting = (extra = {}) => ({
  allAccountsState: { loading: false, error: null, accounts: EXISTING },
  ...extra
})

// a payout field's <input> (the «Show» button shares the field's label)
const field = (name) => screen.getAllByLabelText(name).find(node => node.tagName === 'INPUT')
const button = (name) => screen.getByRole('button', { name })

beforeEach(() => { mocks.api = {} })
afterEach(() => cleanup())

describe('BusinessPaymentAccount · states', () => {
  it('shows skeleton rows in a busy status named Loading while the account or the methods load', () => {
    draw({ accountState: { loading: true, error: null, account: null } })
    const status = screen.getByRole('status', { name: 'Loading' })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    cleanup()
    draw({ methodsState: { loading: true, error: null, methods: [] } })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  })

  it('G4-27: a failed load is a danger notice with Try again, and NO create form, NO «no account» text, NO associate', async () => {
    const { api } = draw({
      accountState: { loading: false, error: ['Server down'], account: null },
      allAccountsState: { loading: false, error: null, accounts: EXISTING }
    })
    expect(screen.getByText("We couldn't load the payment account.")).toBeInTheDocument()
    expect(screen.queryByText("This business doesn't have a payment account yet.")).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('form')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create Payment Account' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Associate Account' })).toBeNull()
    expect(screen.queryByText('Associate existing account')).toBeNull()
    await userEvent.click(button('Try again'))
    expect(api.getAccount).toHaveBeenCalledTimes(1)
  })

  it('the section title is an h3', () => {
    draw()
    expect(screen.getByRole('heading', { level: 3, name: 'Business payment account' })).toBeInTheDocument()
  })
})

describe('BusinessPaymentAccount · no account', () => {
  it('an owner sees the create form at once and no segmented control', () => {
    draw({ isAdmin: false, isBusinessOwner: true, ...withExisting() })
    expect(screen.getByText("This business doesn't have a payment account yet.")).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: /Payment method/ })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /account/i })).toBeNull()
    expect(screen.queryByText('Associate existing account')).toBeNull()
  })

  it('an admin without existing accounts gets only the create form', () => {
    draw()
    expect(screen.getByRole('radiogroup', { name: /Payment method/ })).toBeInTheDocument()
    expect(screen.queryByText('Associate existing account')).toBeNull()
  })

  it('an admin with existing accounts chooses Create (default) or Associate, with the active description below', async () => {
    draw(withExisting())
    expect(screen.getByRole('radiogroup', { name: /Payment method/ })).toBeInTheDocument()
    expect(screen.getByText('Set up a new payment account with a payment method')).toBeInTheDocument()
    expect(screen.queryByText('Link an existing payment account to this business')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Associate existing account' }))
    expect(screen.getByText('Link an existing payment account to this business')).toBeInTheDocument()
    expect(screen.queryByText('Set up a new payment account with a payment method')).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: /Payment method/ })).toBeNull()
    expect(screen.getByRole('radiogroup', { name: 'Select account' })).toBeInTheDocument()
  })

  it('lists one option per method with its payment cycle', () => {
    draw()
    const group = screen.getByRole('radiogroup', { name: /Payment method/ })
    expect(within(group).getByRole('radio', { name: 'Stripe' })).toHaveAccessibleDescription('Weekly - Monday (09:00)')
    expect(within(group).getByRole('radio', { name: 'PayPal' })).toHaveAccessibleDescription('Monthly - Day 15')
  })

  it('a methods load error is a danger notice with Try again that reloads the methods', async () => {
    const { api } = draw({ methodsState: { loading: false, error: ['no methods'], methods: [] } })
    expect(screen.getByText("We couldn't load the payment methods.")).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    await userEvent.click(button('Try again'))
    expect(api.getMethods).toHaveBeenCalledTimes(1)
    expect(api.getAccount).not.toHaveBeenCalled()
  })
})

describe('BusinessPaymentAccount · create', () => {
  it('shows the name and one hidden, required-marked field per template entry once a method is picked', async () => {
    draw()
    expect(screen.queryByLabelText('Account name')).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: 'Stripe' }))
    expect(screen.getByRole('textbox', { name: 'Account name' })).toHaveAttribute('placeholder', 'e.g., Main Business Account')
    expect(field(/Secret key/)).toHaveAttribute('type', 'password')
    expect(field(/Secret key/)).toHaveAttribute('aria-required', 'true')
    expect(field(/Account label/)).toHaveAttribute('type', 'password')
    expect(field(/Account label/)).not.toHaveAttribute('aria-required')
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
  })

  it('without a method, Create says so in line and sends nothing', async () => {
    const { api } = draw()
    await userEvent.click(button('Create Payment Account'))
    expect(await screen.findByText('Payment method is required')).toBeInTheDocument()
    expect(api.createAccount).not.toHaveBeenCalled()
  })

  it('missing required fields show their own error, focus the first, and send nothing', async () => {
    const { api } = draw()
    await userEvent.click(screen.getByRole('radio', { name: 'Stripe' }))
    await userEvent.click(button('Create Payment Account'))
    expect(await screen.findByText('Secret key is required')).toBeInTheDocument()
    expect(api.createAccount).not.toHaveBeenCalled()
    await waitFor(() => expect(field(/Secret key/)).toHaveFocus())
    expect(field(/Secret key/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Account label is required')).toBeNull()
  })

  it('sends { paymethod, name, data } like main, and shows an API error in line (no modal)', async () => {
    const createAccount = vi.fn(async () => ({ error: true, result: ['Invalid key'] }))
    draw({ createAccount })
    await userEvent.click(screen.getByRole('radio', { name: 'Stripe' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), 'Main payouts')
    await userEvent.type(field(/Secret key/), 'sk_test_123')
    await userEvent.click(button('Create Payment Account'))
    expect(createAccount).toHaveBeenCalledTimes(1)
    expect(createAccount).toHaveBeenCalledWith({ paymethod: 'stripe', name: 'Main payouts', data: { secret_key: 'sk_test_123' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid key')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('an empty name and no data are sent as undefined (as main)', async () => {
    const createAccount = vi.fn(async () => ({ error: false, result: {} }))
    draw({ createAccount, methodsState: { loading: false, error: null, methods: [{ gateway: 'cash', name: 'Cash', cycle: 'monthly', cycle_day: 1, data_template: [] }] } })
    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    await userEvent.click(button('Create Payment Account'))
    expect(createAccount).toHaveBeenCalledWith({ paymethod: 'cash', name: undefined, data: undefined })
  })

  it('changing the method clears the data typed for the other one', async () => {
    const createAccount = vi.fn(async () => ({ error: false, result: {} }))
    draw({ createAccount })
    await userEvent.click(screen.getByRole('radio', { name: 'Stripe' }))
    await userEvent.type(field(/Secret key/), 'sk_test_123')
    await userEvent.click(screen.getByRole('radio', { name: 'PayPal' }))
    await userEvent.type(field(/PayPal email/), 'ops@example.com')
    await userEvent.click(button('Create Payment Account'))
    expect(createAccount).toHaveBeenCalledWith({ paymethod: 'paypal', name: undefined, data: { email: 'ops@example.com' } })
  })
})

describe('BusinessPaymentAccount · associate', () => {
  const openAssociate = async (extra = {}) => {
    const view = draw(withExisting(extra))
    await userEvent.click(screen.getByRole('button', { name: 'Associate existing account' }))
    return view
  }

  it('lists the accounts by name (else «gateway #id»), Associate is disabled until one is picked, then sends Number(id)', async () => {
    const { api } = await openAssociate()
    const group = screen.getByRole('radiogroup', { name: 'Select account' })
    expect(within(group).getByRole('radio', { name: 'PayPal EU' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: 'stripe #7' })).toBeInTheDocument()
    expect(button('Associate Account')).toBeDisabled()
    await userEvent.click(within(group).getByRole('radio', { name: 'PayPal EU' }))
    expect(button('Associate Account')).toBeEnabled()
    await userEvent.click(button('Associate Account'))
    expect(api.associateAccount).toHaveBeenCalledTimes(1)
    expect(api.associateAccount).toHaveBeenCalledWith(6)
  })

  it('the search filters by the same label, and says No results when nothing matches', async () => {
    await openAssociate()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'paypal')
    expect(screen.getByRole('radio', { name: 'PayPal EU' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'stripe #7' })).toBeNull()
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzz')
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('an API error shows in line', async () => {
    await openAssociate({ associateAccount: vi.fn(async () => ({ error: true, result: ['Already used'] })) })
    await userEvent.click(screen.getByRole('radio', { name: 'PayPal EU' }))
    await userEvent.click(button('Associate Account'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Already used')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('BusinessPaymentAccount · the account (read view)', () => {
  it('lists method, cycle, name and status, and every datum is a hidden read-only field (the value is not in the text)', () => {
    const { container } = draw(withAccount())
    const rows = container.querySelector('dl')
    expect(rows).not.toBeNull()
    const text = rows.textContent
    expect(text).toContain('Payment method')
    expect(text).toContain('Stripe')
    expect(text).toContain('Payment cycle')
    expect(text).toContain('Weekly - Monday (09:00)')
    expect(text).toContain('Main payouts')
    expect(text).toContain('Enabled')
    expect(container.textContent).not.toContain(SECRET)
    const inputs = container.querySelectorAll('input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toHaveAttribute('type', 'password')
    expect(inputs[0]).toHaveAttribute('readonly')
    expect(inputs[0].value).toBe(SECRET)
    // the empty datum is a plain dash, not a field
    expect(within(rows).getByText('Account label').closest('div')).toHaveTextContent('-')
  })

  it('Show reveals the value of a datum', async () => {
    draw(withAccount())
    await userEvent.click(button(/Show/))
    expect(screen.getByDisplayValue(SECRET)).toHaveAttribute('type', 'text')
  })

  it('without a template the data entries are labelled by key', () => {
    draw(withAccount({
      accountState: { loading: false, error: null, account: { ...ACCOUNT, paymethod: 'custom', data: { token: 'abc-123' } } }
    }))
    expect(screen.getByText('token')).toBeInTheDocument()
    expect(screen.getByText('custom')).toBeInTheDocument()
    expect(screen.queryByText('Payment cycle')).toBeNull()
  })

  it('a disabled account says Disabled', () => {
    draw(withAccount({ accountState: { loading: false, error: null, account: { ...ACCOUNT, enabled: false } } }))
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('an owner reads it with the notice and has neither Edit nor Dissociate', () => {
    draw(withAccount({ isAdmin: false, isBusinessOwner: true }))
    expect(screen.getByText('Your payment account details are read-only. Contact an administrator to make changes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dissociate' })).toBeNull()
  })

  it('an admin has Dissociate and Edit', () => {
    draw(withAccount())
    expect(button('Dissociate')).toBeInTheDocument()
    expect(button('Edit')).toBeInTheDocument()
  })
})

describe('BusinessPaymentAccount · edit in place', () => {
  const edit = async (api = {}, host = null) => {
    const view = draw(withAccount(api), host)
    await userEvent.click(button('Edit'))
    return view
  }

  it('swaps the read rows for fields, a switch and a Cancel; no save bar until something changes', async () => {
    await edit()
    expect(screen.getByRole('textbox', { name: 'Account name' })).toHaveValue('Main payouts')
    expect(field(/Secret key/)).not.toHaveAttribute('readonly')
    expect(screen.getByRole('switch', { name: 'Enabled' })).toBeChecked()
    expect(button('Cancel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Save changes' })).toBeNull()
  })

  it('counts the changed items by name in the save bar', async () => {
    await edit()
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), ' 2')
    await userEvent.click(screen.getByRole('switch', { name: 'Enabled' }))
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(within(bar).getByText(/2 unsaved changes/)).toBeInTheDocument()
    expect(within(bar).getByText(/Account name, Enabled/)).toBeInTheDocument()
  })

  it('Save sends name, data and enabled together (as main) and leaves edit', async () => {
    const { api } = await edit()
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), ' 2')
    await userEvent.click(button('Save'))
    expect(api.updateAccount).toHaveBeenCalledTimes(1)
    expect(api.updateAccount).toHaveBeenCalledWith(5, {
      name: 'Main payouts 2',
      data: { secret_key: SECRET, account_label: '' },
      enabled: true
    })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Account name' })).toBeNull())
    expect(button('Edit')).toBeInTheDocument()
  })

  it('a required field emptied shows its error and sends nothing', async () => {
    const { api } = await edit()
    await userEvent.clear(field(/Secret key/))
    await userEvent.click(button('Save'))
    expect(await screen.findByText('Secret key is required')).toBeInTheDocument()
    expect(api.updateAccount).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Account name' })).toBeInTheDocument()
  })

  it('a failed Save shows the message in the bar with Try again and stays in edit', async () => {
    const updateAccount = vi.fn(async () => ({ error: true, result: ['Bad key'] }))
    await edit({ updateAccount })
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), ' 2')
    await userEvent.click(button('Save'))
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(await within(bar).findByRole('alert')).toHaveTextContent('Bad key')
    expect(screen.getByRole('textbox', { name: 'Account name' })).toHaveValue('Main payouts 2')
    await userEvent.click(within(bar).getByRole('button', { name: 'Try again' }))
    expect(updateAccount).toHaveBeenCalledTimes(2)
  })

  // redesign bugs C: the controller refuses every save that is not level 0's, so Edit is not offered to them
  it('a level other than 0 / 2 gets the admin view without Edit, and keeps Dissociate', () => {
    draw(withAccount({ isAdmin: false, isBusinessOwner: false }))
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(button('Dissociate')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Account name' })).toBeNull()
  })

  it('Discard in the bar resets the draft and leaves edit; Cancel does the same without a bar', async () => {
    await edit()
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), ' 2')
    await userEvent.click(button('Discard'))
    expect(screen.queryByRole('textbox', { name: 'Account name' })).toBeNull()
    await userEvent.click(button('Edit'))
    expect(screen.getByRole('textbox', { name: 'Account name' })).toHaveValue('Main payouts')
    await userEvent.click(button('Cancel'))
    expect(screen.queryByRole('textbox', { name: 'Account name' })).toBeNull()
    expect(button('Edit')).toBeInTheDocument()
  })

  it('registers a leave guard that is dirty only while there are unsaved changes', async () => {
    const entries = []
    const host = { register: (entry) => { entries.push(entry); return () => {} }, requestLeave: vi.fn() }
    await edit({}, host)
    expect(entries).toHaveLength(1)
    expect(entries[0].current.isDirty()).toBe(false)
    await userEvent.type(screen.getByRole('textbox', { name: 'Account name' }), ' 2')
    expect(entries[0].current.isDirty()).toBe(true)
    expect(entries[0].current.count()).toBe(1)
    await userEvent.click(button('Discard'))
    expect(entries[0].current.isDirty()).toBe(false)
  })
})

describe('BusinessPaymentAccount · dissociate', () => {
  it('opens a confirmation that names the account and the consequence, and does not dissociate yet', async () => {
    const { api } = draw(withAccount())
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Dissociate Main payouts?' })
    expect(within(dialog).getByText('This store stops using this account for its payouts. The account is kept and can be associated again.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Dissociate account' })).toHaveAttribute('data-variant', 'danger')
    expect(api.dissociateAccount).not.toHaveBeenCalled()
  })

  // redesign stores 5.18 (F5 of 5.11): with the store's name, the body says which store stops using the account
  it('names the store in the body when the section gives its name', async () => {
    draw(withAccount(), null, { businessName: 'Fast Bite Centro' })
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Dissociate Main payouts?' })
    expect(within(dialog).getByText('Fast Bite Centro stops using this account for its payouts. The account is kept and can be associated again.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/^This store stops/)).toBeNull()
  })

  it('keeps «This store» when the name is missing or blank', async () => {
    draw(withAccount(), null, { businessName: '  ' })
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Dissociate Main payouts?' })
    expect(within(dialog).getByText('This store stops using this account for its payouts. The account is kept and can be associated again.')).toBeInTheDocument()
  })

  it('names the method when the account has no name', async () => {
    draw(withAccount({ accountState: { loading: false, error: null, account: { ...ACCOUNT, name: '' } } }))
    await userEvent.click(button('Dissociate'))
    expect(await screen.findByRole('alertdialog', { name: 'Dissociate Stripe?' })).toBeInTheDocument()
  })

  it('Cancel closes without dissociating', async () => {
    const { api } = draw(withAccount())
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(api.dissociateAccount).not.toHaveBeenCalled()
  })

  it('confirming calls dissociateAccount once', async () => {
    const { api } = draw(withAccount())
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dissociate account' }))
    expect(api.dissociateAccount).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failure shows the error in line, not in a modal', async () => {
    draw(withAccount({ dissociateAccount: vi.fn(async () => ({ error: true, result: ['Has open payouts'] })) }))
    await userEvent.click(button('Dissociate'))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dissociate account' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(await screen.findByRole('alert')).toHaveTextContent('Has open payouts')
  })
})

// review 5.11 F6: the control that had the focus goes away after these actions; the focus never falls to <body>
describe('BusinessPaymentAccount · focus', () => {
  const title = () => screen.getByRole('heading', { level: 3, name: 'Business payment account' })

  it('Edit focuses the first field; Cancel and a good Save give the focus to the title', async () => {
    const user = userEvent.setup()
    draw(withAccount())
    await user.click(button('Edit'))
    await waitFor(() => expect(document.activeElement).toBe(field('Account name')))
    await user.click(button('Cancel'))
    await waitFor(() => expect(document.activeElement).toBe(title()))
    await user.click(button('Edit'))
    await user.type(field('Account name'), ' 2')
    await user.click(button('Save'))
    await waitFor(() => expect(document.activeElement).toBe(title()))
  })

  it('a good dissociate gives the focus to the title', async () => {
    const user = userEvent.setup()
    draw(withAccount())
    await user.click(button('Dissociate'))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Dissociate account' }))
    await waitFor(() => expect(document.activeElement).toBe(title()))
  })

  it('Try again after a failed load gives the focus to the title', async () => {
    const user = userEvent.setup()
    const { rerender } = draw({ accountState: { loading: false, error: ['Server down'], account: null } })
    await user.click(button('Try again'))
    // as the controller does: loading, then loaded
    const again = (accountState) => {
      mocks.api = { ...mocks.api, accountState }
      rerender(
        <LeaveGuardContext.Provider value={null}>
          <BusinessPaymentAccount businessId={7} />
        </LeaveGuardContext.Provider>
      )
    }
    again({ loading: true, error: null, account: null })
    again({ loading: false, error: null, account: null })
    await waitFor(() => expect(document.activeElement).toBe(title()))
  })
})
