/* eslint-disable import/first */
// redesign BM-B (D3, D4, M-BM6, M-BM10, M-BM11, M-BM12, M-BM16): the saved cards and the Stripe field of the Billing
// modal, as one Product piece. The Product wrappers are real; the two controllers of main (BillingPaymentOptionStripe and
// BillingCardForm) are stand-ins with props we control, and Stripe itself is a stub.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stub = vi.hoisted(() => ({
  stripe: {},
  form: {},
  translations: {},
  seen: {},
  showToast: undefined
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key, fallback) => stub.translations[key] ?? fallback],
  useToast: () => [null, { showToast: stub.showToast }],
  ToastType: { Success: 'success', Error: 'error' }
}))

vi.mock('../../../../../../components/BillingPaymentOptionStripe', () => ({
  BillingPaymentOptionStripe: (props) => {
    stub.seen = props
    const { UIComponent, ...rest } = props
    return <UIComponent {...rest} {...stub.stripe} />
  }
}))

vi.mock('../../../../../../components/BillingCardForm', () => ({
  BillingCardForm: ({ UIComponent, ...props }) => <UIComponent {...props} {...stub.form} />
}))

vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div data-testid='elements'>{children}</div>,
  CardElement: ({ options, onChange, onFocus, onBlur }) => (
    <input
      data-testid='card-element'
      aria-label='Card details'
      disabled={options?.disabled}
      onChange={event => onChange?.({ complete: event.target.value === 'done', error: null })}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  )
}))

import { PaymentMethodPicker } from '../index'
import { getCardElementOptions } from '../stripeCardOptions'

const visa = { id: 1, default: true, data: { brand: 'visa', last4: '4242' } }
const mastercard = { id: 2, default: false, data: { brand: 'mastercard', last4: '4444' } }

const stripeState = (overrides = {}) => ({
  cardsList: { cards: [visa, mastercard], loading: false, error: null },
  cardDefaultState: { loading: false, error: null, result: null },
  cardSelected: visa,
  publicKey: 'pk_test_123',
  requirements: 'seti_secret',
  requirementsState: { requested: true, loading: false },
  loadRequirements: vi.fn(),
  handleCardClick: vi.fn(),
  handleNewCard: vi.fn(),
  deleteCard: vi.fn(),
  ...overrides
})

const formState = (overrides = {}) => ({
  cardState: { error: null, loading: false },
  addCardState: { loading: false, error: null, result: null },
  handleSubmit: vi.fn(event => event.preventDefault()),
  handleChange: vi.fn(),
  ...overrides
})

const dot4 = '••••'

beforeEach(() => {
  stub.stripe = stripeState()
  stub.form = formState()
  stub.translations = {}
  stub.showToast = vi.fn()
})

afterEach(() => {
  document.getElementById('app-modals')?.remove()
})

const mount = (props = {}) => {
  const onSelectCard = vi.fn()
  const onBusyChange = vi.fn()
  const element = () => <PaymentMethodPicker onSelectCard={onSelectCard} onBusyChange={onBusyChange} {...props} />
  const view = render(element())
  const update = () => view.rerender(element()) // a new element each time: React skips the very same one
  return { ...view, update, onSelectCard, onBusyChange }
}

// a row's name starts with its brand; the «Card actions: Brand …» menu button must not match
const row = (brand) => screen.getByRole('button', { name: new RegExp(`^${brand}`) })

describe('PaymentMethodPicker · the saved cards (D3, M-BM6, M-BM10, M-BM12)', () => {
  it('is a section named «Payment method» with one pressable button per card', () => {
    mount()
    const section = screen.getByRole('region', { name: 'Payment method' })
    expect(within(section).getByRole('heading', { level: 3, name: 'Payment method' })).toBeInTheDocument()
    const visaRow = within(section).getByRole('button', { name: /^Visa/ })
    const masterRow = within(section).getByRole('button', { name: /^Mastercard/ })
    // pressed buttons, not radios: choosing a card is a POST, and a radio would write on every arrow key
    expect(visaRow).toHaveAttribute('type', 'button')
    expect(visaRow).toHaveAttribute('aria-pressed', 'true')
    expect(masterRow).toHaveAttribute('aria-pressed', 'false')
    expect(within(section).queryByRole('radio')).toBeNull()
  })

  it('writes the card as brand and •••• last4 in a figure, and marks the default one', () => {
    mount()
    const visaRow = row('Visa')
    expect(within(visaRow).getByText(`${dot4} 4242`)).toHaveClass('odc-figure')
    expect(within(visaRow).getByText('Default')).toBeInTheDocument()
    expect(within(row('Mastercard')).queryByText('Default')).toBeNull()
  })

  it('Tab reaches every card', async () => {
    const user = userEvent.setup()
    mount()
    await user.tab()
    expect(row('Visa')).toHaveFocus()
    await user.tab()
    expect(row('Mastercard')).toHaveFocus()
  })

  it('pressing another card chooses it (the same POST as main); pressing the chosen one does nothing', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(row('Visa'))
    expect(stub.stripe.handleCardClick).not.toHaveBeenCalled()
    await user.click(row('Mastercard'))
    expect(stub.stripe.handleCardClick).toHaveBeenCalledTimes(1)
    expect(stub.stripe.handleCardClick).toHaveBeenCalledWith(mastercard)
  })

  it('Enter and Space on another card choose it too', async () => {
    const user = userEvent.setup()
    mount()
    row('Mastercard').focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(stub.stripe.handleCardClick).toHaveBeenCalledTimes(2)
  })

  it('while the default is being written the chosen card is busy and the others do not answer', async () => {
    const user = userEvent.setup()
    stub.stripe = stripeState({
      cardSelected: mastercard,
      cardDefaultState: { loading: true, error: null, result: null }
    })
    mount()
    const chosen = row('Mastercard')
    expect(chosen).toHaveAttribute('aria-busy', 'true')
    expect(chosen.querySelector('.odc-pmp-spin')).not.toBeNull()
    expect(row('Visa')).not.toHaveAttribute('aria-busy')
    await user.click(row('Visa'))
    expect(stub.stripe.handleCardClick).not.toHaveBeenCalled()
  })

  it('has no ⋮ on the default card nor on any card while the default is being written', () => {
    const { unmount } = mount()
    expect(screen.queryByRole('button', { name: `Card actions: Visa ${dot4} 4242` })).toBeNull()
    expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toBeInTheDocument()
    unmount()
    stub.stripe = stripeState({ cardDefaultState: { loading: true, error: null, result: null } })
    mount()
    expect(screen.queryByRole('button', { name: /Card actions/ })).toBeNull()
  })

  it('names the brand the way the card networks write it, and capitalizes any other', () => {
    stub.stripe = stripeState({
      cardsList: {
        cards: [
          { id: 1, default: false, data: { brand: 'amex', last4: '0005' } },
          { id: 2, default: false, data: { brand: 'visa', last4: '4242' } },
          { id: 3, default: false, data: { brand: 'mastercard', last4: '4444' } },
          { id: 4, default: false, data: { brand: 'discover', last4: '1117' } },
          { id: 5, default: false, data: { brand: 'unionpay', last4: '0000' } },
          { id: 6, default: false, data: { last4: '9999' } }
        ],
        loading: false,
        error: null
      },
      cardSelected: null
    })
    mount()
    expect(screen.getByRole('button', { name: new RegExp(`^American Express ${dot4} 0005`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Visa ${dot4} 4242`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Mastercard ${dot4} 4444`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Discover ${dot4} 1117`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Unionpay ${dot4} 0000`) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`^Card ${dot4} 9999`) })).toBeInTheDocument()
  })

  it('paints two skeleton rows while loading, with no cards and no add form', () => {
    stub.stripe = stripeState({ cardsList: { cards: [], loading: true, error: null } })
    const { container } = mount()
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(2)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Add new card')).toBeNull()
  })

  it('says there are no saved cards, and shows no info notice, when the list is empty', () => {
    stub.stripe = stripeState({ cardsList: { cards: [], loading: false, error: null }, cardSelected: null })
    mount()
    expect(screen.getByText('No saved cards yet. Add one below to pay.')).toBeInTheDocument()
    expect(screen.queryByText(/it will also change for your subscription/)).toBeNull()
  })

  it('tells that changing the payment method also changes the subscription, whenever there is a card', () => {
    mount()
    const notice = screen.getByText('If you change your payment method it will also change for your subscription.').closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'info')
  })

  it('keeps the success toast of main when the default card is written', () => {
    stub.stripe = stripeState({ cardDefaultState: { loading: false, error: null, result: { id: 2 } } })
    mount()
    expect(stub.showToast).toHaveBeenCalledWith('success', 'Card Selected Successfully')
  })
})

describe('PaymentMethodPicker · no card chosen (M-BM6)', () => {
  it('says why «Pay» waits when there are cards but none is chosen, and not otherwise', () => {
    stub.stripe = stripeState({ cardSelected: null })
    const { update } = mount()
    expect(screen.getByText('Choose the card to pay with.')).toBeInTheDocument()
    stub.stripe = stripeState()
    update()
    expect(screen.queryByText('Choose the card to pay with.')).toBeNull()
  })
})

describe('PaymentMethodPicker · deleting a card (M-BM11)', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete card' }))
    return screen.findByRole('alertdialog')
  }

  it('the menu has one danger item, «Delete card», and it sits next to the row, not inside it', async () => {
    const user = userEvent.setup()
    mount()
    const trigger = screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })
    expect(row('Mastercard').contains(trigger)).toBe(false)
    await user.click(trigger)
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual(['Delete card'])
    expect(items[0]).toHaveAttribute('data-tone', 'danger')
  })

  it('«Delete card» opens a confirmation that names the card, and nothing is deleted yet', async () => {
    const user = userEvent.setup()
    mount()
    const confirm = await openDelete(user)
    expect(confirm).toHaveAccessibleName(`Delete Mastercard ${dot4} 4444?`)
    expect(within(confirm).getByRole('button', { name: 'Delete card' })).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(confirm).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0)
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(stub.stripe.deleteCard).not.toHaveBeenCalled()
  })

  it('confirming deletes the card once, and the focus goes to the chosen row', async () => {
    const user = userEvent.setup()
    mount()
    const confirm = await openDelete(user)
    await user.click(within(confirm).getByRole('button', { name: 'Delete card' }))
    expect(stub.stripe.deleteCard).toHaveBeenCalledTimes(1)
    expect(stub.stripe.deleteCard).toHaveBeenCalledWith(mastercard)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(row('Visa')).toHaveFocus())
  })

  // redesign (row 51 R1-3): cancelling deletes nothing, so the focus goes back to the ⋮ that opened the confirmation
  // (it still exists), not to the chosen row. Confirming keeps today's behaviour (the card and its ⋮ go away).
  it('cancelling deletes nothing, and the focus goes back to the ⋮ of that card', async () => {
    const user = userEvent.setup()
    mount()
    const confirm = await openDelete(user)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(stub.stripe.deleteCard).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toHaveFocus())
  })

  it('closing the confirmation with Escape also returns to the ⋮ of that card', async () => {
    const user = userEvent.setup()
    mount()
    await openDelete(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toHaveFocus())
  })

  it('when that ⋮ is gone by the time the confirmation closes, the focus falls back to the chosen row', async () => {
    const user = userEvent.setup()
    const { update } = mount()
    const confirm = await openDelete(user)
    // the list lost the card while the confirmation was open (e.g. it became the default)
    stub.stripe = stripeState({ cardsList: { cards: [visa], loading: false, error: null } })
    update()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(row('Visa')).toHaveFocus())
  })

  it('uses the translations of the project for the menu and the confirmation', async () => {
    stub.translations = {
      CARD_ACTIONS: 'Acciones de tarjeta: _card_',
      DELETE_CARD: 'Eliminar tarjeta',
      DELETE_CARD_TITLE: '¿Eliminar _card_?'
    }
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: `Acciones de tarjeta: Mastercard ${dot4} 4444` }))
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar tarjeta' }))
    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(`¿Eliminar Mastercard ${dot4} 4444?`)
  })
})

describe('PaymentMethodPicker · errors stay in the dialog', () => {
  it('shows the list error as a translated alert, and no toast', () => {
    stub.translations = { YOUR_CARD_WAS_DECLINED: 'Tu tarjeta fue rechazada' }
    stub.stripe = stripeState({ cardsList: { cards: [visa], loading: false, error: 'Your card was declined' } })
    mount()
    const alert = screen.getByText('Tu tarjeta fue rechazada').closest('[role="alert"]')
    expect(alert).toHaveAttribute('data-tone', 'danger')
    expect(stub.showToast).not.toHaveBeenCalled()
  })

  it('shows the error of choosing a card as an alert', () => {
    stub.stripe = stripeState({ cardDefaultState: { loading: false, error: 'Card is expired', result: null } })
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Card is expired')
  })

  // Owner decision 17 B (2026-10-21)
  it('a default that failed says so, and that the card the person had stays selected (owner decision 17)', () => {
    stub.stripe = stripeState({ cardDefaultState: { loading: false, error: 'Card is expired', result: null, reverted: true } })
    mount()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The default card could not be changed. The card you had stays selected.')
    expect(alert).toHaveTextContent('Card is expired')
  })

  it('a failed default with no previous card only says it could not change (owner decision 17)', () => {
    stub.stripe = stripeState({ cardSelected: null, cardDefaultState: { loading: false, error: null, result: null, reverted: true } })
    mount()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The default card could not be changed.')
    expect(alert).not.toHaveTextContent('stays selected')
  })

  it('shows every message when the API answers a list, and «Error» when it has no text', () => {
    stub.stripe = stripeState({ cardsList: { cards: [], loading: false, error: ['First problem', 'Second problem'] } })
    const { unmount } = mount()
    expect(screen.getByText('First problem').closest('[role="alert"]')).not.toBeNull()
    expect(screen.getByText('Second problem').closest('[role="alert"]')).not.toBeNull()
    unmount()
    stub.stripe = stripeState({ cardsList: { cards: [], loading: false, error: {} } })
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Error')
  })

  it('paints no alert when nothing failed', () => {
    mount()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

// redesign (n.º 5, P-2): the Stripe field appears when «Add card» is pressed; the controller then fetches the requirements.
describe('PaymentMethodPicker · the field on demand (n.º 5, P-2)', () => {
  const waiting = (overrides = {}) => stripeState({
    publicKey: undefined,
    requirements: undefined,
    requirementsState: { requested: false, loading: false },
    ...overrides
  })

  it('asks the controller for the requirements on demand', () => {
    stub.stripe = waiting()
    mount()
    expect(stub.seen.requirementsOnDemand).toBe(true)
  })

  it('opens with an «Add card» button and no Stripe field, no form and no unavailable notice', () => {
    stub.stripe = waiting()
    mount()
    const section = screen.getByRole('region', { name: 'Add new card' })
    const button = within(section).getByRole('button', { name: 'Add card' })
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.queryByTestId('card-element')).toBeNull()
    expect(screen.queryByText('Powered by Stripe')).toBeNull()
    expect(screen.queryByText(/Adding a card isn't available/)).toBeNull()
    expect(stub.stripe.loadRequirements).not.toHaveBeenCalled()
  })

  it('pressing «Add card» asks the controller once; the field shows when the key is there', async () => {
    const user = userEvent.setup()
    stub.stripe = waiting()
    const { update } = mount()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(stub.stripe.loadRequirements).toHaveBeenCalledTimes(1)
    stub.stripe = stripeState()
    update()
    const section = screen.getByRole('region', { name: 'Add new card' })
    expect(within(section).getByTestId('card-element')).toBeInTheDocument()
    expect(within(section).getAllByRole('button', { name: 'Add card' })).toHaveLength(1)
    expect(within(section).getByRole('button', { name: 'Add card' })).toHaveAttribute('type', 'submit')
  })

  it('while the requirements load the button is busy and does not ask again', async () => {
    const user = userEvent.setup()
    stub.stripe = waiting({ requirementsState: { requested: false, loading: true } })
    mount()
    const button = screen.getByRole('button', { name: 'Add card' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(stub.stripe.loadRequirements).not.toHaveBeenCalled()
  })

  it('when no publishable key comes back it shows the unavailable notice and no field', () => {
    stub.stripe = waiting({ requirementsState: { requested: true, loading: false } })
    mount()
    expect(screen.getByText("Adding a card isn't available right now. You can still pay with a saved card.").closest('.odc-notice')).toHaveAttribute('data-tone', 'warning')
    expect(screen.queryByTestId('card-element')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add card' })).toBeNull()
  })

  // review L2 #2: «Add card» leaves the page when pressed; the focus goes to what replaces it, and a failed request can be retried
  it('after «Add card» the focus goes to «Try again» without a key, which asks again', async () => {
    const user = userEvent.setup()
    stub.stripe = waiting()
    const { update } = mount()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    stub.stripe = waiting({ requirementsState: { requested: true, loading: false }, loadRequirements: stub.stripe.loadRequirements })
    update()
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry).toHaveFocus()
    await user.click(retry)
    expect(stub.stripe.loadRequirements).toHaveBeenCalledTimes(2)
  })

  it('after «Add card» with a key the focus goes to the section title until the Stripe field takes it', async () => {
    const user = userEvent.setup()
    stub.stripe = waiting()
    const { update } = mount()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    stub.stripe = stripeState()
    update()
    expect(screen.getByRole('heading', { name: 'Add new card' })).toHaveFocus()
  })

  it('while the dialog charges the button does nothing', async () => {
    const user = userEvent.setup()
    stub.stripe = waiting()
    mount({ disabled: true })
    const button = screen.getByRole('button', { name: 'Add card' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(stub.stripe.loadRequirements).not.toHaveBeenCalled()
  })
})

describe('PaymentMethodPicker · adding a card (D4)', () => {
  it('has an «Add new card» section with the Stripe field, its attribution and an «Add card» button', () => {
    mount()
    const section = screen.getByRole('region', { name: 'Add new card' })
    expect(within(section).getByRole('heading', { level: 3, name: 'Add new card' })).toBeInTheDocument()
    const frame = within(section).getByTestId('card-element').closest('.odc-pmp-stripe')
    expect(frame).not.toBeNull()
    expect(within(section).getByText('Powered by Stripe')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Add card' })).toHaveAttribute('type', 'submit')
  })

  it('submits through the controller of main', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(stub.form.handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('is busy while the card is being confirmed or saved, and a second submit does nothing', async () => {
    const user = userEvent.setup()
    stub.form = formState({ cardState: { error: null, loading: true } })
    mount()
    const button = screen.getByRole('button', { name: 'Add card' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(stub.form.handleSubmit).not.toHaveBeenCalled()
  })

  // once busy, neither a second click nor Enter in the field reaches the form at all.
  it('a quick double submit adds the card once', async () => {
    const user = userEvent.setup()
    const { update } = mount()
    const form = screen.getByTestId('card-element').closest('form')
    const submits = vi.fn()
    form.addEventListener('submit', submits)
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    stub.form = { ...stub.form, cardState: { error: null, loading: true } }
    update()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    await user.type(screen.getByTestId('card-element'), '{Enter}')
    expect(stub.form.handleSubmit).toHaveBeenCalledTimes(1)
    expect(submits).toHaveBeenCalledTimes(1)
  })

  it('shows the validation error of Stripe under the field as an alert', () => {
    stub.form = formState({ cardState: { error: 'Your card number is incomplete.', loading: false } })
    mount()
    const alert = screen.getByText('Your card number is incomplete.').closest('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert.closest('.odc-pmp-stripe')).toBeNull() // under the frame, not inside it
    expect(screen.getByTestId('card-element').closest('.odc-pmp-stripe')).toHaveAttribute('data-invalid')
  })

  it('shows the error of saving the card as a translated alert, and no toast', () => {
    stub.translations = { YOUR_CARD_WAS_DECLINED: 'Tu tarjeta fue rechazada' }
    stub.form = formState({ addCardState: { loading: false, error: 'Your card was declined', result: null } })
    mount()
    expect(screen.getByText('Tu tarjeta fue rechazada').closest('[role="alert"]')).not.toBeNull()
    expect(stub.showToast).not.toHaveBeenCalledWith('error', expect.anything())
  })

  it('keeps the success toast of main when the card is created', () => {
    stub.form = formState({ addCardState: { loading: false, error: null, result: { id: 9 } } })
    mount()
    expect(stub.showToast).toHaveBeenCalledWith('success', 'Card Created Successfully')
  })

  it('passes what the Stripe field says to the controller', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByTestId('card-element'), 'x')
    expect(stub.form.handleChange).toHaveBeenCalled()
  })

  it('without a public key says adding is not available and paints no field; saved cards still work', async () => {
    const user = userEvent.setup()
    stub.stripe = stripeState({ publicKey: undefined })
    mount()
    const notice = screen.getByText("Adding a card isn't available right now. You can still pay with a saved card.").closest('.odc-notice')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(screen.queryByTestId('card-element')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add card' })).toBeNull()
    await user.click(row('Mastercard'))
    expect(stub.stripe.handleCardClick).toHaveBeenCalledWith(mastercard)
  })
})

// redesign (row 51 main-1): while the dialog charges, choosing a card, the ⋮ and adding a card do nothing. The charge
// itself (card, amount, period) is not touched; this only stops the list changing under it.
describe('PaymentMethodPicker · locked while the charge is in flight (main-1)', () => {
  it('the rows do not answer, the ⋮ is off and the Add card form cannot be sent', async () => {
    const user = userEvent.setup()
    const { unmount } = mount({ disabled: true })
    expect(row('Mastercard')).toHaveAttribute('aria-disabled', 'true')
    await user.click(row('Mastercard'))
    expect(stub.stripe.handleCardClick).not.toHaveBeenCalled()
    // the ⋮ stays where it was (no layout jump) but off
    expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toBeDisabled()
    expect(screen.getByTestId('card-element')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(stub.form.handleSubmit).not.toHaveBeenCalled()
    unmount()
  })

  it('the Add card submit is swallowed even by Enter (the form is guarded, not only the button)', () => {
    mount({ disabled: true })
    const form = screen.getByTestId('card-element').closest('form')
    form.requestSubmit()
    expect(stub.form.handleSubmit).not.toHaveBeenCalled()
  })

  it('nothing is locked by default, and unlocking brings the controls back', async () => {
    const user = userEvent.setup()
    const { rerender } = mount({ disabled: true })
    expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toBeDisabled()
    rerender(<PaymentMethodPicker onSelectCard={vi.fn()} onBusyChange={vi.fn()} />)
    expect(row('Mastercard')).not.toHaveAttribute('aria-disabled')
    expect(screen.getByRole('button', { name: `Card actions: Mastercard ${dot4} 4444` })).toBeEnabled()
    expect(screen.getByTestId('card-element')).toBeEnabled()
    await user.click(row('Mastercard'))
    expect(stub.stripe.handleCardClick).toHaveBeenCalledWith(mastercard)
  })
})

// redesign (row 51 R1-4): jsdom has no :hover, so the rule is pinned as text: the highlight belongs to the whole row
// (`.odc-pmp-card`), not to its button, and the lock rule still keys on `aria-disabled`.
describe('payment-method-picker.css · hover (R1-4)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Billing/PaymentMethodPicker/payment-method-picker.css'), 'utf8')

  it('the hover highlight is on the row, so it also covers the ⋮', () => {
    expect(css).toMatch(/\.odc-pmp-card:hover\s*\{[^}]*background:\s*var\(--od-x-hover\)/)
    expect(css).not.toMatch(/\.odc-pmp-card-btn:hover\s*\{[^}]*var\(--od-x-hover\)/)
  })

  it('a locked row does not highlight (the aria-disabled rule stays)', () => {
    expect(css).toMatch(/\.odc-pmp-card:has\(\.odc-pmp-card-btn\[aria-disabled='true'\]\):hover\s*\{[^}]*background:\s*var\(--od-bg\)/)
    expect(css).toMatch(/\.odc-pmp-card-btn\[aria-disabled='true'\]\s*\{\s*cursor:\s*default/)
  })
})

describe('PaymentMethodPicker · onBusyChange (M-BM16)', () => {
  it('tells true when writing the default starts and false when it ends', () => {
    const { update, onBusyChange } = mount()
    expect(onBusyChange).not.toHaveBeenCalledWith(true)
    stub.stripe = stripeState({ cardSelected: mastercard, cardDefaultState: { loading: true, error: null, result: null } })
    update()
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    stub.stripe = stripeState({ cardSelected: mastercard, cardDefaultState: { loading: false, error: null, result: { id: 2 } } })
    update()
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
    expect(onBusyChange).toHaveBeenCalledTimes(2)
  })

  it('lets go of the busy state when it unmounts while writing', () => {
    stub.stripe = stripeState({ cardDefaultState: { loading: true, error: null, result: null } })
    const { unmount, onBusyChange } = mount()
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
  })

  it('works without the callback', () => {
    stub.stripe = stripeState({ cardDefaultState: { loading: true, error: null, result: null } })
    expect(() => mount({ onBusyChange: undefined })).not.toThrow()
  })
})

describe('PaymentMethodPicker · the controller wiring', () => {
  it('forwards onSelectCard to the controller of main untouched (the controller calls it, not the piece)', () => {
    const onSelectCard = vi.fn()
    mount({ onSelectCard })
    expect(stub.seen.onSelectCard).toBe(onSelectCard)
    expect(typeof stub.seen.UIComponent).toBe('function')
    expect(onSelectCard).not.toHaveBeenCalled()
  })
})

describe('stripeCardOptions', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--od-text')
    document.documentElement.style.removeProperty('--od-text-muted')
    document.documentElement.style.removeProperty('--od-danger-functional')
    document.documentElement.style.removeProperty('--od-font-sans')
  })

  it('falls back to the values of main when the tokens are missing', () => {
    const { style } = getCardElementOptions()
    expect(style.base.color).toBe('#32325d')
    expect(style.base.fontSize).toBe('16px')
    expect(style.base['::placeholder'].color).toBe('#aab7c4')
    expect(style.invalid).toEqual({ color: '#fa755a', iconColor: '#fa755a' })
  })

  it('reads the brand tokens when they are there, and ignores a value Stripe cannot paint', () => {
    document.documentElement.style.setProperty('--od-text', '#111827')
    document.documentElement.style.setProperty('--od-text-muted', 'color-mix(in srgb, red, blue)')
    document.documentElement.style.setProperty('--od-danger-functional', 'rgb(180, 35, 24)')
    document.documentElement.style.setProperty('--od-font-sans', 'Inter, sans-serif')
    const { style } = getCardElementOptions()
    expect(style.base.color).toBe('#111827')
    expect(style.base['::placeholder'].color).toBe('#aab7c4') // not a hex/rgb/hsl value: main's
    expect(style.invalid).toEqual({ color: 'rgb(180, 35, 24)', iconColor: 'rgb(180, 35, 24)' })
    expect(style.base.fontFamily).toBe('Inter, sans-serif')
  })
})
