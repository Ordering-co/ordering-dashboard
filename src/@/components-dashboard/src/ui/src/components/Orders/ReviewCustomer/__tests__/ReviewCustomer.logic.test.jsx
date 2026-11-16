/* eslint-disable import/first */
// Batch 5.4-B · logic of the customer review. Written green against the legacy Modal content and kept
// green after the move to a Product Dialog: it reads text and what the controller receives (the
// review state it sends, `handleSendCustomerReview`), not the markup of the scale or the chips.
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ reviewState: null, send: null, error: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: value => value }],
  // The same surface the real controller gives its UI: the review state, its setter, the action state and the sender.
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
        actionState={{ loading: false, error: runtime.error }}
        handleSendCustomerReview={() => runtime.send(runtime.reviewState)}
      />
    )
  }
}))

vi.mock('../../../../utils', () => {
  const list = (title, contents) => ({ title, list: contents.map((content, key) => ({ key, content })) })
  const reviews = {
    1: list('What went wrong?', ['Rude', 'Not on-time']),
    2: list('What went wrong?', ['Rude', 'Not on-time']),
    3: list('What could have been better?', ['Rude', 'Not on-time']),
    4: list('Tell us more', ['Friendly']),
    5: list('What went well?', ['Friendly', 'Above and beyond'])
  }
  return { reviewCommentList: () => reviews }
})

import { ReviewCustomer } from '..'

const order = { id: 42, customer_id: 7 }
const customer = { id: 7, name: 'Ada', lastname: 'Lovelace' }

const mount = () => renderWithProviders(<ReviewCustomer order={order} customer={customer} onClose={vi.fn()} />)

beforeEach(() => {
  runtime.send = vi.fn()
  runtime.error = null
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('ReviewCustomer · what the review sends', () => {
  it('names the customer and offers the five marks from Terrible to Great', async () => {
    mount()
    expect(await screen.findByText('Review customer')).toBeInTheDocument()
    expect(screen.getByText(/Ada\s+Lovelace/)).toBeInTheDocument()
    for (const mark of ['Terrible', 'Bad', 'Okay', 'Good', 'Great']) {
      expect(screen.getByText(mark)).toBeInTheDocument()
    }
  })

  it('choosing a mark sets its numeric value and clears the comment', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByText('Great'))
    expect(runtime.reviewState).toMatchObject({ qualification: 5, comment: '', order_id: 42, user_id: 7 })
    await user.click(screen.getByText('Terrible'))
    expect(runtime.reviewState.qualification).toBe(1)
  })

  it('the quick comments of the chosen mark and the free text become one comment', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByText('Terrible'))
    expect(screen.getByText('What went wrong?')).toBeInTheDocument()
    await user.click(screen.getByText('Rude'))
    await user.click(screen.getByText('Not on-time'))
    expect(runtime.reviewState.comment).toBe('Rude. Not on-time. ')
    await user.type(screen.getByRole('textbox'), 'Left it at the door')
    expect(runtime.reviewState.comment).toBe('Rude. Not on-time. Left it at the door')
    // Choosing the same chip again takes it out.
    await user.click(screen.getByText('Rude'))
    expect(runtime.reviewState.comment).toBe('Not on-time. Left it at the door')
  })

  it('Send review hands the state of the review to the controller sender, once', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByText('Good'))
    await user.click(screen.getByText('Friendly'))
    await user.click(screen.getByText('Send review'))
    expect(runtime.send).toHaveBeenCalledTimes(1)
    expect(runtime.send).toHaveBeenCalledWith({ qualification: 4, comment: 'Friendly. ', order_id: 42, user_id: 7 })
  })

  it('shows what the API answered when the review fails', async () => {
    runtime.error = ['The user already reviewed this order']
    mount()
    expect(await screen.findByText('The user already reviewed this order')).toBeInTheDocument()
  })
})
