/* eslint-disable import/first */
// Batch 5.4-B · the customer review as a Product Dialog (C8): role and name, where the focus starts,
// Escape, the footer in order, the scale as a radio group with the numeric values the payload carries,
// and the quick comments as toggle buttons. The Product wrappers are real here.
// redesign fix-qa E5: the question is about a customer, not a delivery.
// redesign fix-qa C3 (B3): the quick comments are `main`'s again (`reviewCommentList(1)`, same catalog keys,
// same `comment` sent); only the question and the heading before a mark are the redesign's.
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ reviewState: null, send: null, loading: false, error: null, texts: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => runtime.texts[key] ?? fallback],
  useUtils: () => [{ optimizeImage: value => value }],
  ReviewCustomer: ({ UIComponent, ...props }) => {
    const [reviewState, setReviewState] = React.useState({
      qualification: 0,
      comment: '',
      order_id: props.order?.id,
      user_id: props.order?.customer_id
    })
    runtime.reviewState = reviewState
    return (
      <UIComponent
        {...props}
        reviewState={reviewState}
        setReviewState={setReviewState}
        actionState={{ loading: runtime.loading, error: runtime.error }}
        handleSendCustomerReview={() => runtime.send(runtime.reviewState)}
      />
    )
  }
}))

import { ReviewCustomer } from '..'

const order = { id: 42, customer_id: 7 }
const customer = { id: 7, name: 'Ada', lastname: 'Lovelace' }

const mount = (props = {}) => {
  const onClose = vi.fn()
  const view = renderWithProviders(<ReviewCustomer order={order} customer={customer} onClose={onClose} {...props} />)
  return { onClose, ...view }
}
const footerButtons = dialog => within(dialog.querySelector('.odc-overlay-foot')).getAllByRole('button').map(button => button.textContent)

beforeEach(() => {
  runtime.send = vi.fn()
  runtime.loading = false
  runtime.error = null
  runtime.texts = {}
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('ReviewCustomer · dialog', () => {
  it('is a dialog named Review customer, with Cancel first and Send review last', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Review customer' })
    expect(footerButtons(dialog)).toEqual(['Cancel', 'Send review'])
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument()
  })

  it('starts the focus on the first mark of the scale', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Review customer' })
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Terrible' })).toHaveFocus())
  })

  it('Escape, Cancel and the close button all ask the opener to close it', async () => {
    const user = userEvent.setup()
    const { onClose } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Review customer' })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(3)
    expect(runtime.send).not.toHaveBeenCalled()
  })

  it('is closed while the opener says so, and sends nothing', async () => {
    mount({ open: false })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the scale is a radio group of five with the values 1 to 5, and the arrows move through it', async () => {
    const user = userEvent.setup()
    mount()
    const group = await screen.findByRole('radiogroup', { name: 'How was the customer?' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5'])
    expect(radios.map(radio => radio.closest('label').textContent)).toEqual(['Terrible', 'Bad', 'Okay', 'Good', 'Great'])
    radios[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(radios[1]).toBeChecked()
    expect(runtime.reviewState.qualification).toBe(2)
    await user.click(within(group).getByRole('radio', { name: 'Great' }))
    expect(runtime.reviewState.qualification).toBe(5)
  })

  it('the quick comments are toggle buttons of the chosen mark', async () => {
    const user = userEvent.setup()
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Review customer' })
    await user.click(within(dialog).getByRole('radio', { name: 'Terrible' }))
    const group = within(dialog).getByRole('group', { name: 'What went wrong?' })
    const rude = within(group).getByRole('button', { name: 'Rude' })
    expect(rude).toHaveAttribute('aria-pressed', 'false')
    await user.click(rude)
    expect(within(group).getByRole('button', { name: 'Rude' })).toHaveAttribute('aria-pressed', 'true')
    expect(runtime.reviewState.comment).toBe('Rude. ')
    await user.click(within(group).getByRole('button', { name: 'Rude' }))
    expect(within(group).getByRole('button', { name: 'Rude' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('the free text has a visible label and goes into the comment', async () => {
    const user = userEvent.setup()
    mount()
    const field = await screen.findByRole('textbox', { name: 'Do you want to add something?' })
    await user.type(field, 'Thanks')
    expect(runtime.reviewState.comment).toBe('Thanks')
  })

  it('Send review sends the state once; while it runs the button is busy and cannot repeat', async () => {
    const user = userEvent.setup()
    const view = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Review customer' })
    await user.click(within(dialog).getByRole('radio', { name: 'Great' }))
    await user.click(within(dialog).getByRole('button', { name: 'Send review' }))
    expect(runtime.send).toHaveBeenCalledTimes(1)
    expect(runtime.send).toHaveBeenCalledWith({ qualification: 5, comment: '', order_id: 42, user_id: 7 })
    runtime.loading = true
    view.rerender(<ReviewCustomer order={order} customer={customer} onClose={vi.fn()} />)
    const busy = within(await screen.findByRole('dialog', { name: 'Review customer' })).getByRole('button', { name: 'Send review' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
  })

  it('what the API answers opens its own dialog with an OK', async () => {
    runtime.error = ['The user already reviewed this order']
    mount()
    const alert = await screen.findByRole('alertdialog', { name: 'Review not sent' }) // redesign W0-2 r2 (W0-Q1-10): the alert is an alertdialog
    expect(within(alert).getByText('The user already reviewed this order')).toBeInTheDocument()
    expect(footerButtons(alert)).toEqual(['OK'])
  })
})

describe('ReviewCustomer · copy for a customer', () => {
  it('asks how the customer was, never how the delivery was', async () => {
    mount()
    await screen.findByRole('radiogroup', { name: 'How was the customer?' })
    expect(screen.queryByText(/delivery/i)).toBeNull()
  })

  it('keeps the chips visible before a mark, under a neutral heading (as main always showed them)', async () => {
    mount()
    const group = await screen.findByRole('group', { name: 'Quick comments' })
    expect(within(group).getAllByRole('button').length).toBeGreaterThan(0)
    expect(screen.queryByText('What went wrong?')).toBeNull()
  })

  // redesign fix-qa C3 (B3): the chips are the ones of `main`, mark by mark.
  it('offers the chips of main for each mark', async () => {
    const user = userEvent.setup()
    mount()
    const chips = name => within(screen.getByRole('group', { name })).getAllByRole('button').map(button => button.textContent)
    const negative = ['Not handled with care', 'Poor communication', 'COVID-19 issue', "Didn't follow instructions", 'Rude', 'Not on-time']
    await user.click(await screen.findByRole('radio', { name: 'Terrible' }))
    expect(chips('What went wrong?')).toEqual(negative)
    await user.click(screen.getByRole('radio', { name: 'Bad' }))
    expect(chips('What went wrong?')).toEqual(negative)
    await user.click(screen.getByRole('radio', { name: 'Okay' }))
    expect(chips('What could have been better?')).toEqual(negative)
    await user.click(screen.getByRole('radio', { name: 'Good' }))
    expect(chips('Tell us more')).toEqual(negative)
    await user.click(screen.getByRole('radio', { name: 'Great' }))
    expect(chips('What went well?')).toEqual(['Good communication', 'Friendly', 'Above and beyond'])
  })

  it('reads each mark from its own catalog keys, so the texts of the project win', async () => {
    runtime.texts = { CUSTOMER_QUICK_COMMENT_2_1: 'Slow replies', CUSTOMER_QUICK_COMMENT_5_2: 'Went the extra mile' }
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('radio', { name: 'Bad' }))
    expect(screen.getByRole('button', { name: 'Slow replies' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Poor communication' })).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Great' }))
    expect(screen.getByRole('button', { name: 'Went the extra mile' })).toBeInTheDocument()
  })

  it('the comment sent is still the chosen chips followed by the free text', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('radio', { name: 'Terrible' }))
    await user.click(screen.getByRole('button', { name: 'Rude' }))
    await user.type(screen.getByRole('textbox', { name: 'Do you want to add something?' }), 'Left')
    expect(runtime.reviewState).toMatchObject({ qualification: 1, comment: 'Rude. Left' })
  })
})
