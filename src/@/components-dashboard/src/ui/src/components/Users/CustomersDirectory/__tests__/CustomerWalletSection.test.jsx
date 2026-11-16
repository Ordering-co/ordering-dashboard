/* eslint-disable import/first */
// redesign UC-B5 (decisions 4 and 5, M-C1, M-C3, M-C4, M-C9, M-C16): the Wallet section of the customer panel.
// The wallet controller (K/UserWallet) and the customer helpers (customerData) are mocks: NOTHING here sends a request, so
// no wallet event is ever posted. What is pinned is what the section writes into the controller and when it calls it.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ mounts: [], controllers: {}, translations: {}, configsDecimals: undefined }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, text) => mocks.translations[key] ?? text],
  useUtils: () => [{
    parsePrice: value => `$${Number(value).toFixed(2)}`,
    parseDate: (value) => `on ${value}`
  }],
  // The real controller fetches; this one renders the UI it is given with the state the test chose
  UserWallet: ({ UIComponent, ...props }) => {
    mocks.mounts.push({ userId: props.userId, walletType: props.walletType })
    return <UIComponent {...props} {...mocks.controllers[props.walletType]} />
  }
}))
vi.mock('../customerData', () => ({
  customerName: (user, t) => [user?.name, user?.lastname].filter(Boolean).join(' ') || t('CUSTOMERS_NO_NAME', 'No name'),
  isCashWalletOn: configs => Boolean(configs?.addon_cash_wallet_and_refunds?.value),
  isPointsWalletOn: configs => Boolean(configs?.addon_points_and_levels?.value)
}))

import { CustomerWalletSection } from '../CustomerWalletSection'

const user = { id: 42, name: 'Grace', lastname: 'Okafor' }
const CASH_ONLY = { addon_cash_wallet_and_refunds: { value: '1' } }
const POINTS_ONLY = { addon_points_and_levels: { value: '1' } }
const BOTH = { ...CASH_ONLY, ...POINTS_ONLY }

const controller = (overrides = {}) => ({
  walletState: { loading: false, wallet: { id: 11, balance: 10, locked: false }, error: null },
  walletEventsState: { loading: false, events: [], error: null },
  walletUsers: [],
  actionState: { loading: false, error: null },
  handleChangeInput: vi.fn(),
  handleAddWalletMoney: vi.fn().mockResolvedValue({ ok: true, error: null }),
  handleReduceWalletMoney: vi.fn().mockResolvedValue({ ok: true, error: null }),
  refreshWallet: vi.fn(),
  ...overrides
})

const renderSection = (props = {}) => {
  const handlers = { onWalletChange: vi.fn(), onDirtyChange: vi.fn() }
  const view = render(<CustomerWalletSection user={user} configs={CASH_ONLY} wallet='cash' {...handlers} {...props} />)
  return { ...view, ...handlers }
}

beforeEach(() => {
  mocks.mounts = []
  mocks.translations = {}
  mocks.controllers = { cash: controller(), credit_point: controller({ walletState: { loading: false, wallet: { id: 12, balance: 20.37 }, error: null } }) }
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const amountField = () => screen.getByLabelText(/^Amount/)
const commentField = () => screen.getByLabelText(/^Comment/)
const choose = (user, name) => user.click(screen.getByRole('button', { name }))
const submitButton = name => within(screen.getByRole('form', { name: 'Adjust balance' })).getByRole('button', { name })

describe('which wallets are shown', () => {
  it('the cash add-on alone mounts the cash controller for this customer and shows no control', () => {
    renderSection()
    expect(mocks.mounts.every(mount => mount.userId === 42 && mount.walletType === 'cash')).toBe(true)
    expect(mocks.mounts.length).toBeGreaterThan(0)
    expect(screen.queryByRole('group', { name: 'Wallet' })).toBeNull()
  })

  it('the points add-on alone mounts the credit_point controller and shows no control', () => {
    renderSection({ configs: POINTS_ONLY, wallet: 'points' })
    expect(mocks.mounts.every(mount => mount.walletType === 'credit_point')).toBe(true)
    expect(screen.queryByRole('group', { name: 'Wallet' })).toBeNull()
  })

  it('one add-on wins over a wallet prop for the other: the cash-only section never mounts points', () => {
    renderSection({ configs: CASH_ONLY, wallet: 'points' })
    expect(mocks.mounts.every(mount => mount.walletType === 'cash')).toBe(true)
  })

  it('both add-ons: a segmented control «Cash» / «Points» that asks the parent to switch', async () => {
    const user = userEvent.setup()
    const { onWalletChange } = renderSection({ configs: BOTH })
    const group = screen.getByRole('group', { name: 'Wallet' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Cash', 'Points'])
    expect(within(group).getByRole('button', { name: 'Cash' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('button', { name: 'Points' }))
    expect(onWalletChange).toHaveBeenCalledWith('points')
  })

  it('the wallet prop chooses the wallet that is mounted', () => {
    const { rerender } = renderSection({ configs: BOTH, wallet: 'cash' })
    expect(mocks.mounts.every(mount => mount.walletType === 'cash')).toBe(true)
    mocks.mounts = []
    rerender(<CustomerWalletSection user={user} configs={BOTH} wallet='points' onWalletChange={vi.fn()} onDirtyChange={vi.fn()} />)
    expect(mocks.mounts.every(mount => mount.walletType === 'credit_point' && mount.userId === 42)).toBe(true)
    expect(screen.getByRole('group', { name: 'Wallet' })).toBeInTheDocument()
  })

  it('no add-on, no section', () => {
    const { container } = renderSection({ configs: {} })
    expect(container).toBeEmptyDOMElement()
    expect(mocks.mounts).toEqual([])
  })
})

describe('the balance', () => {
  const balanceText = () => document.querySelector('.cw-balance .odc-figure').textContent

  it('cash is a figure through parsePrice', () => {
    renderSection()
    expect(balanceText()).toBe('$10.00')
  })

  it('zero is $0.00, never «- $0.00» (M-C4)', () => {
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: { id: 11, balance: 0 }, error: null } })
    renderSection()
    expect(balanceText()).toBe('$0.00')
    expect(document.querySelector('.cw-balance').textContent).not.toMatch(/[-−]/)
  })

  it('a negative balance keeps a real minus sign', () => {
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: { id: 11, balance: -5 }, error: null } })
    renderSection()
    expect(balanceText()).toBe('−$5.00')
  })

  it('a balance the controller left as text is still read as a number', () => {
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: { id: 11, balance: '35' }, error: null } })
    renderSection()
    expect(balanceText()).toBe('$35.00')
  })

  it('points are a plain number labelled «Points» (M-C9)', () => {
    renderSection({ configs: POINTS_ONLY, wallet: 'points' })
    expect(balanceText()).toBe('20.37')
    expect(document.querySelector('.cw-balance').textContent).toContain('Points')
    expect(document.querySelector('.cw-balance').textContent).not.toContain('$')
  })

  it('loads as a skeleton, with no figure yet', () => {
    mocks.controllers.cash = controller({ walletState: { loading: true, wallet: {}, error: null } })
    renderSection()
    expect(document.querySelector('.cw-balance .odc-figure')).toBeNull()
    expect(document.querySelector('.cw-balance .odc-skeleton')).not.toBeNull()
    expect(screen.getByRole('status', { busy: true })).toBeInTheDocument()
  })

  it('a wallet that did not load says so and offers Retry through refreshWallet', async () => {
    const user = userEvent.setup()
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: {}, error: ['boom'] } })
    renderSection()
    expect(screen.getByText("The wallet didn't load.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.controllers.cash.refreshWallet).toHaveBeenCalledTimes(1)
  })

  it('a locked wallet says so and the whole form is disabled', () => {
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: { id: 11, balance: 10, locked: true }, error: null } })
    renderSection()
    expect(screen.getByText('This wallet is locked')).toBeInTheDocument()
    expect(amountField()).toBeDisabled()
    expect(commentField()).toBeDisabled()
    expect(submitButton('Adjust balance')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
  })
})

describe('the «Add points» intent (apply-list row 20)', () => {
  const pressed = name => screen.getByRole('button', { name }).getAttribute('aria-pressed')

  it('with an add intent the section opens in Add, the amount is focused, and the intent is consumed once', () => {
    const onIntentConsumed = vi.fn()
    renderSection({ configs: POINTS_ONLY, wallet: 'points', intent: { mode: 'add', id: 1 }, onIntentConsumed })
    expect(pressed('Add')).toBe('true')
    expect(amountField()).toHaveFocus()
    expect(onIntentConsumed).toHaveBeenCalledTimes(1)
  })

  it('an intent that arrives while Remove is chosen switches to Add, keeps what was typed, and focuses the amount', async () => {
    const user = userEvent.setup()
    const onIntentConsumed = vi.fn()
    const props = { user, configs: POINTS_ONLY, wallet: 'points', onWalletChange: vi.fn(), onDirtyChange: vi.fn() }
    const { rerender } = render(<CustomerWalletSection {...props} user={{ id: 42, name: 'Grace', lastname: 'Okafor' }} />)
    await choose(user, 'Remove')
    await user.type(amountField(), '7')
    expect(pressed('Remove')).toBe('true')
    commentField().focus()
    rerender(<CustomerWalletSection {...props} user={{ id: 42, name: 'Grace', lastname: 'Okafor' }} intent={{ mode: 'add', id: 2 }} onIntentConsumed={onIntentConsumed} />)
    expect(pressed('Add')).toBe('true')
    expect(amountField()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Add 7 points' })).toBeEnabled()
    expect(onIntentConsumed).toHaveBeenCalledTimes(1)
  })

  it('without an intent the section keeps its behaviour: Add chosen, nothing focused, nothing consumed', () => {
    const onIntentConsumed = vi.fn()
    renderSection({ configs: POINTS_ONLY, wallet: 'points', onIntentConsumed })
    expect(pressed('Add')).toBe('true')
    expect(amountField()).not.toHaveFocus()
    expect(onIntentConsumed).not.toHaveBeenCalled()
  })

  it('the same intent is not applied twice when the section renders again', async () => {
    const user = userEvent.setup()
    const intent = { mode: 'add', id: 3 }
    const props = { configs: POINTS_ONLY, wallet: 'points', onWalletChange: vi.fn(), onDirtyChange: vi.fn(), intent, onIntentConsumed: vi.fn() }
    const stable = { id: 42, name: 'Grace', lastname: 'Okafor' }
    const { rerender } = render(<CustomerWalletSection user={stable} {...props} />)
    await choose(user, 'Remove')
    rerender(<CustomerWalletSection user={stable} {...props} />)
    expect(pressed('Remove')).toBe('true')
  })
})

describe('the Adjust balance form', () => {
  it('the submit names the amount, in cash', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(amountField(), '25')
    expect(submitButton('Add $25.00')).toBeEnabled()
    await choose(user, 'Remove')
    expect(submitButton('Remove $25.00')).toBeEnabled()
  })

  it('the submit names the amount, in points, with the plural', async () => {
    const user = userEvent.setup()
    renderSection({ configs: POINTS_ONLY, wallet: 'points' })
    await user.type(amountField(), '5')
    expect(submitButton('Add 5 points')).toBeEnabled()
    await user.clear(amountField())
    await user.type(amountField(), '1')
    expect(submitButton('Add 1 point')).toBeEnabled()
    await choose(user, 'Remove')
    expect(submitButton('Remove 1 point')).toBeEnabled()
    await user.clear(amountField())
    await user.type(amountField(), '3')
    expect(submitButton('Remove 3 points')).toBeEnabled()
  })

  it('with no amount the submit is disabled and the reason is tied to it by aria-describedby', () => {
    renderSection()
    const submit = submitButton('Adjust balance')
    expect(submit).toBeDisabled()
    const reason = document.getElementById(submit.getAttribute('aria-describedby'))
    expect(reason).toHaveTextContent('Enter an amount greater than 0.')
  })

  it('zero is not an amount', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(amountField(), '0')
    expect(submitButton('Adjust balance')).toBeDisabled()
  })

  it('a customer without a wallet row cannot be adjusted (no event posted to /wallets/undefined)', async () => {
    const user = userEvent.setup()
    mocks.controllers.cash = controller({ walletState: { loading: false, wallet: {}, error: null } })
    renderSection()
    await user.type(amountField(), '5')
    const submit = submitButton('Add $5.00')
    expect(submit).toBeDisabled()
    expect(document.getElementById(submit.getAttribute('aria-describedby'))).toHaveTextContent('This customer has no wallet yet.')
  })

  it('writes the amount and the comment into the controller exactly as the old form did', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(amountField(), '12.5')
    await user.type(commentField(), 'Goodwill')
    const { handleChangeInput } = mocks.controllers.cash
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'amount', value: '12.5' } }, true)
    expect(handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'description', value: 'Goodwill' } }, true)
  })

  it('switching to Remove moves what was typed to the reduce side and empties the add side', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(amountField(), '25')
    await user.type(commentField(), 'Oops')
    const { handleChangeInput } = mocks.controllers.cash
    handleChangeInput.mockClear()
    await choose(user, 'Remove')
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'amount', value: '25' } }, false)
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'description', value: 'Oops' } }, false)
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'amount', value: '' } }, true)
    expect(handleChangeInput).toHaveBeenCalledWith({ target: { name: 'description', value: '' } }, true)
    expect(amountField()).toHaveValue('25')
    expect(commentField()).toHaveValue('Oops')
  })

  it('typing in Remove mode writes the reduce side', async () => {
    const user = userEvent.setup()
    renderSection()
    await choose(user, 'Remove')
    await user.type(amountField(), '3')
    expect(mocks.controllers.cash.handleChangeInput).toHaveBeenLastCalledWith({ target: { name: 'amount', value: '3' } }, false)
  })
})

describe('the confirmation (C8, decision 25)', () => {
  const open = async (user, name = 'Add $25.00') => {
    await user.type(amountField(), '25')
    await user.click(submitButton(name))
    return screen.findByRole('alertdialog')
  }

  it('nothing is sent before confirming: pressing the button only opens the dialog', async () => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await open(user)
    expect(within(dialog).getByRole('heading', { name: "Add $25.00 to Grace Okafor's cash wallet?" })).toBeInTheDocument()
    expect(mocks.controllers.cash.handleAddWalletMoney).not.toHaveBeenCalled()
    expect(mocks.controllers.cash.handleReduceWalletMoney).not.toHaveBeenCalled()
  })

  it('shows the balance from and to, with the figures as figures, and no promise about spending it', async () => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await open(user)
    expect(dialog).toHaveTextContent('The balance goes from $10.00 to $35.00.')
    expect([...dialog.querySelectorAll('.odc-figure')].map(node => node.textContent)).toEqual(expect.arrayContaining(['$10.00', '$35.00']))
    expect(dialog).not.toHaveTextContent('negative')
    expect(dialog).not.toHaveTextContent(/spend|use it|redeem/i)
  })

  it('the initial focus is on Cancel and the confirm label is the submit label', async () => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await open(user)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: 'Add $25.00' })).toBeInTheDocument()
  })

  it('Cancel closes it, keeps the form and sends nothing', async () => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.controllers.cash.handleAddWalletMoney).not.toHaveBeenCalled()
    expect(amountField()).toHaveValue('25')
  })

  it('confirming sends once, through the controller, and only the add side', async () => {
    const user = userEvent.setup()
    renderSection()
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(mocks.controllers.cash.handleAddWalletMoney).toHaveBeenCalledTimes(1))
    expect(mocks.controllers.cash.handleReduceWalletMoney).not.toHaveBeenCalled()
  })

  it('removing confirms through the reduce side and names «Remove … from …»', async () => {
    const user = userEvent.setup()
    renderSection()
    await choose(user, 'Remove')
    await user.type(amountField(), '4')
    await user.click(submitButton('Remove $4.00'))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: "Remove $4.00 from Grace Okafor's cash wallet?" })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('The balance goes from $10.00 to $6.00.')
    await user.click(within(dialog).getByRole('button', { name: 'Remove $4.00' }))
    await waitFor(() => expect(mocks.controllers.cash.handleReduceWalletMoney).toHaveBeenCalledTimes(1))
    expect(mocks.controllers.cash.handleAddWalletMoney).not.toHaveBeenCalled()
  })

  it('warns when the result is negative, with its minus sign', async () => {
    const user = userEvent.setup()
    renderSection()
    await choose(user, 'Remove')
    await user.type(amountField(), '15')
    await user.click(submitButton('Remove $15.00'))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('The balance goes from $10.00 to −$5.00.')
    expect(dialog).toHaveTextContent('The balance will be negative.')
  })

  it('points: the title and the figures are in points, with the singular for one', async () => {
    const user = userEvent.setup()
    renderSection({ configs: POINTS_ONLY, wallet: 'points' })
    await user.type(amountField(), '5')
    await user.click(submitButton('Add 5 points'))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: "Add 5 points to Grace Okafor's points wallet?" })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('The balance goes from 20.37 to 25.37.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await choose(user, 'Remove')
    await user.clear(amountField())
    await user.type(amountField(), '1')
    await user.click(submitButton('Remove 1 point'))
    expect(within(await screen.findByRole('alertdialog')).getByRole('heading', { name: "Remove 1 point from Grace Okafor's points wallet?" })).toBeInTheDocument()
  })

  it('while the request runs the dialog is busy and cannot be cancelled or repeated', async () => {
    const user = userEvent.setup()
    let finish
    mocks.controllers.cash = controller({ handleAddWalletMoney: vi.fn(() => new Promise(resolve => { finish = resolve })) })
    renderSection()
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add $25.00' })).toHaveAttribute('aria-busy', 'true'))
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Add $25.00' }))
    expect(mocks.controllers.cash.handleAddWalletMoney).toHaveBeenCalledTimes(1)
    finish({ ok: true, error: null })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('on success: closes, clears the form, refreshes the wallet and announces «Balance updated»', async () => {
    const user = userEvent.setup()
    const { onDirtyChange } = renderSection()
    await user.type(commentField(), 'Goodwill')
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(amountField()).toHaveValue('')
    expect(commentField()).toHaveValue('')
    expect(mocks.controllers.cash.refreshWallet).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Balance updated').closest('[role="status"]')).not.toBeNull()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(submitButton('Adjust balance')).toBeDisabled()
  })

  it('on an error: the dialog closes, the form keeps its values, and the notice above the form says why', async () => {
    const user = userEvent.setup()
    mocks.controllers.cash = controller({ handleAddWalletMoney: vi.fn().mockResolvedValue({ ok: false, error: ['The wallet is locked'] }) })
    renderSection()
    await user.type(commentField(), 'Goodwill')
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(amountField()).toHaveValue('25')
    expect(commentField()).toHaveValue('Goodwill')
    const notice = screen.getByText('The wallet is locked').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    const form = screen.getByRole('form', { name: 'Adjust balance' })
    expect(notice.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocks.controllers.cash.refreshWallet).not.toHaveBeenCalled()
    expect(screen.queryByText('Balance updated')).toBeNull()
  })

  it('an error without text says something instead of nothing, and the next try clears it', async () => {
    const user = userEvent.setup()
    mocks.controllers.cash = controller({
      handleAddWalletMoney: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: null })
        .mockResolvedValueOnce({ ok: true, error: null })
    })
    renderSection()
    let dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.getByText("The balance didn't change. Try again.")).toBeInTheDocument())
    await user.click(submitButton('Add $25.00'))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.queryByText("The balance didn't change. Try again.")).toBeNull()
    expect(mocks.controllers.cash.handleAddWalletMoney).toHaveBeenCalledTimes(2)
  })
})

describe('unsaved changes (auditor #16)', () => {
  it('reports dirty while an amount or a comment waits to be sent, and clean when emptied', async () => {
    const user = userEvent.setup()
    const { onDirtyChange } = renderSection()
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
    await user.type(amountField(), '5')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.clear(amountField())
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(commentField(), 'x')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.clear(commentField())
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('reports clean when the section goes away with something typed', async () => {
    const user = userEvent.setup()
    const { onDirtyChange, unmount } = renderSection()
    await user.type(amountField(), '5')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

// what was typed in one wallet survives a switch to the other wallet and back
describe('a draft per wallet', () => {
  const Harness = ({ initial = 'cash', ...props }) => {
    const [wallet, setWallet] = React.useState(initial)
    return <CustomerWalletSection user={user} configs={BOTH} wallet={wallet} onWalletChange={setWallet} {...props} />
  }
  const pick = (user, name) => user.click(within(screen.getByRole('group', { name: 'Wallet' })).getByRole('button', { name }))
  const pressed = name => screen.getByRole('button', { name }).getAttribute('aria-pressed')
  const lastValueWritten = (fn, field, isAdd) => fn.mock.calls.filter(([event, add]) => event.target.name === field && add === isAdd).at(-1)?.[0].target.value

  it('Cash -> Points -> Cash keeps the amount, the comment and the mode, and Points starts empty', async () => {
    const user = userEvent.setup()
    render(<Harness onDirtyChange={vi.fn()} />)
    await user.type(amountField(), '12')
    await user.type(commentField(), 'Goodwill')
    await choose(user, 'Remove')
    await pick(user, 'Points')
    expect(screen.getByRole('button', { name: 'Points' })).toHaveAttribute('aria-pressed', 'true')
    expect(amountField()).toHaveValue('')
    expect(commentField()).toHaveValue('')
    expect(pressed('Add')).toBe('true')
    await pick(user, 'Cash')
    expect(amountField()).toHaveValue('12')
    expect(commentField()).toHaveValue('Goodwill')
    expect(pressed('Remove')).toBe('true')
    expect(submitButton('Remove $12.00')).toBeEnabled()
  })

  it('the cash controller gets the kept values back on the side the form shows, so confirming sends what is seen', async () => {
    const user = userEvent.setup()
    render(<Harness onDirtyChange={vi.fn()} />)
    await user.type(amountField(), '12')
    await user.type(commentField(), 'Goodwill')
    await choose(user, 'Remove')
    await pick(user, 'Points')
    mocks.controllers.cash.handleChangeInput.mockClear()
    await pick(user, 'Cash')
    await waitFor(() => {
      expect(lastValueWritten(mocks.controllers.cash.handleChangeInput, 'amount', false)).toBe('12')
      expect(lastValueWritten(mocks.controllers.cash.handleChangeInput, 'description', false)).toBe('Goodwill')
    })
    await user.click(submitButton('Remove $12.00'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove $12.00' }))
    await waitFor(() => expect(mocks.controllers.cash.handleReduceWalletMoney).toHaveBeenCalledTimes(1))
    expect(mocks.controllers.cash.handleAddWalletMoney).not.toHaveBeenCalled()
  })

  it('each wallet keeps its own draft', async () => {
    const user = userEvent.setup()
    render(<Harness onDirtyChange={vi.fn()} />)
    await user.type(amountField(), '12')
    await pick(user, 'Points')
    await user.type(amountField(), '5')
    await user.type(commentField(), 'Welcome')
    await pick(user, 'Cash')
    expect(amountField()).toHaveValue('12')
    expect(commentField()).toHaveValue('')
    await pick(user, 'Points')
    expect(amountField()).toHaveValue('5')
    expect(commentField()).toHaveValue('Welcome')
  })

  it('stays dirty while any wallet holds a draft, even the hidden one', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Harness onDirtyChange={onDirtyChange} />)
    await user.type(amountField(), '12')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    await pick(user, 'Points')
    expect(onDirtyChange).not.toHaveBeenCalledWith(false)
    await user.type(amountField(), '5')
    await user.clear(amountField())
    expect(onDirtyChange).not.toHaveBeenCalledWith(false)
    await pick(user, 'Cash')
    expect(onDirtyChange).not.toHaveBeenCalledWith(false)
    await user.clear(amountField())
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('after a successful confirmation that wallet is empty again and the other draft keeps the section dirty', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Harness onDirtyChange={onDirtyChange} />)
    await pick(user, 'Points')
    await user.type(amountField(), '5')
    await pick(user, 'Cash')
    await user.type(amountField(), '25')
    await user.click(submitButton('Add $25.00'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(amountField()).toHaveValue('')
    expect(onDirtyChange).not.toHaveBeenCalledWith(false)
    await pick(user, 'Points')
    expect(amountField()).toHaveValue('5')
    await pick(user, 'Cash')
    expect(amountField()).toHaveValue('')
  })

  it('a successful confirmation with no other draft leaves the section clean', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    render(<Harness onDirtyChange={onDirtyChange} />)
    await user.type(amountField(), '25')
    await user.click(submitButton('Add $25.00'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Add $25.00' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('another customer discards both drafts and the section reports clean', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { rerender } = render(<Harness onDirtyChange={onDirtyChange} />)
    await user.type(amountField(), '12')
    await pick(user, 'Points')
    await user.type(amountField(), '5')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    rerender(<Harness onDirtyChange={onDirtyChange} user={{ id: 43, name: 'Ada', lastname: 'Lovelace' }} />)
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(amountField()).toHaveValue('')
    await pick(user, 'Cash')
    expect(amountField()).toHaveValue('')
  })

  it('reports clean when the section goes away with a draft in the hidden wallet', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const { unmount } = render(<Harness onDirtyChange={onDirtyChange} />)
    await user.type(amountField(), '12')
    await pick(user, 'Points')
    unmount()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('the history', () => {
  const events = [
    { id: 3, event_type: 'manual', event: 'movement', amount: 25, author_id: 7, description: 'Goodwill', created_at: '2026-10-09 14:05:00', code: 'ZX9', wallet_event: null },
    { id: 2, event_type: 'payment', amount: -12.5, author_id: 99, description: null, created_at: '2026-10-08 10:00:00', wallet_event: { order_id: 4521 } },
    { id: 1, event_type: 'manual', event: 'locked', amount: 0, author_id: 7, created_at: '2026-10-07 09:00:00' }
  ]
  const withEvents = (extra = {}) => {
    mocks.controllers.cash = controller({
      walletEventsState: { loading: false, events, error: null },
      walletUsers: [{ id: 7, name: 'Grace', lastname: 'Okafor' }],
      ...extra
    })
  }

  it('lists each event as a feed: signed figure, plain label, comment, author and a date through parseDate', () => {
    withEvents()
    renderSection()
    const feed = screen.getByRole('list', { name: 'Transaction history' })
    const items = within(feed).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('+$25.00')
    expect(items[0]).toHaveTextContent('Balance added')
    expect(items[0]).toHaveTextContent('Goodwill')
    expect(items[0]).toHaveTextContent('Grace Okafor')
    expect(items[0]).toHaveTextContent('on 2026-10-09 14:05:00')
    expect(items[0].querySelector('.cw-event-amount.odc-figure')).toHaveTextContent('+$25.00')
    expect(items[1]).toHaveTextContent('−$12.50')
    expect(items[1]).toHaveTextContent('Paid money')
    expect(items[1]).toHaveTextContent('#99')
  })

  it('a lock event has no amount', () => {
    withEvents()
    renderSection()
    const locked = within(screen.getByRole('list', { name: 'Transaction history' })).getAllByRole('listitem')[2]
    expect(locked).toHaveTextContent('Wallet locked')
    expect(locked.querySelector('.cw-event-amount')).toBeNull()
  })

  it('keeps the order number and the code the old history showed, folded away', () => {
    withEvents()
    renderSection()
    const items = within(screen.getByRole('list', { name: 'Transaction history' })).getAllByRole('listitem')
    expect(items[1].querySelector('details')).toHaveTextContent('Order number')
    expect(items[1].querySelector('details')).toHaveTextContent('4521')
    expect(items[0].querySelector('details')).toHaveTextContent('Code')
    expect(items[0].querySelector('details')).toHaveTextContent('ZX9')
  })

  it('points events are plain numbers', () => {
    mocks.controllers.credit_point = controller({
      walletEventsState: { loading: false, events: [{ id: 5, event_type: 'refund', amount: 20.37, author_id: null, created_at: '2026-10-09 14:05:00' }], error: null }
    })
    renderSection({ configs: POINTS_ONLY, wallet: 'points' })
    const item = within(screen.getByRole('list', { name: 'Transaction history' })).getByRole('listitem')
    expect(item).toHaveTextContent('+20.37')
    expect(item).not.toHaveTextContent('$')
  })

  it('never injects HTML: an author name with markup is text (M-C16)', () => {
    withEvents({
      walletUsers: [{ id: 7, name: '<img src=x onerror=alert(1)>', lastname: '<b>Doe</b>' }],
      walletEventsState: { loading: false, events: [{ ...events[0], event_type: 'redeem_gift_card' }], error: null }
    })
    const { container } = renderSection()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('strong')).toBeNull()
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)> <b>Doe</b>')
  })

  it('the gift card label is plain text even when the catalog string carries <strong>', () => {
    mocks.translations.REDEEMED_GIFT_CARD = 'Redeemed from the <strong>Gift card</strong>'
    withEvents({ walletEventsState: { loading: false, events: [{ ...events[0], event_type: 'redeem_gift_card' }], error: null } })
    const { container } = renderSection()
    expect(container.querySelector('strong')).toBeNull()
    expect(container).toHaveTextContent('Redeemed from the Gift card')
  })

  it('loads as a busy skeleton', () => {
    withEvents({ walletEventsState: { loading: true, events: [], error: null } })
    renderSection()
    expect(document.querySelector('.cw-history .odc-skeleton')).not.toBeNull()
    expect(screen.queryByText('No transactions yet')).toBeNull()
  })

  it('empty says «No transactions yet»', () => {
    renderSection()
    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
  })

  it('an error is a plain message: refreshWallet reloads the wallet, not the events, so there is no Retry here', () => {
    withEvents({ walletEventsState: { loading: false, events: [], error: ['boom'] } })
    renderSection()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("The transaction history didn't load.")
    expect(within(alert).queryByRole('button')).toBeNull()
  })

  it('the history sits below the form', () => {
    renderSection()
    const form = screen.getByRole('form', { name: 'Adjust balance' })
    const history = screen.getByRole('heading', { name: 'Transaction history' })
    expect(form.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
