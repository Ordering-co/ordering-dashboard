import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// redesign AS-A (D1, D2, M-AS2): the proposal card, one anatomy for every state

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}`, parseDate: (value) => String(value) }]
}))

import { AssistantActionCard } from '../AssistantActionCard'

const preview = (overrides = {}) => ({
  id: 'a1',
  operation_id: 'Product.update',
  path_params: { product_id: 45 },
  record_name: 'Pizza Pepperoni',
  status: 'proposed',
  expires_at: new Date(Date.now() + 90 * 1000).toISOString(),
  changes: [{ field: 'price', before_known: true, before: 12, after: 14 }],
  ...overrides
})

const handlers = () => ({ onConfirm: vi.fn(), onCancel: vi.fn() })

const renderCard = (action, props = {}) => {
  const fns = handlers()
  const ui = (next, extra = {}) => <AssistantActionCard action={next} {...fns} {...props} {...extra} />
  const view = render(ui(action))
  return { ...view, ...fns, update: (next, extra) => view.rerender(ui(next, extra)) }
}

const texts = (container, selector) => Array.from(container.querySelectorAll(selector)).map(node => node.textContent)

describe('AssistantActionCard: proposal', () => {
  it('shows the type, the name, the countdown and the change before → after', () => {
    const { container } = renderCard(preview())

    const card = screen.getByRole('article', { name: 'Pizza Pepperoni' })
    expect(card).toHaveAttribute('data-status', 'proposed')
    expect(within(card).getByText('Product')).toBeInTheDocument()

    const countdown = screen.getByText(/Expires in/)
    expect(countdown).not.toHaveAttribute('aria-label')
    expect(countdown.textContent).toMatch(/^Expires in \d+:\d{2}$/)
    expect(countdown.querySelector('.odc-figure')).not.toBeNull()
    expect(countdown.querySelector('svg')).not.toBeNull()

    expect(within(card).getByText('Price')).toBeInTheDocument()
    expect(texts(container, '.odc-as-before')).toEqual(['$12.00'])
    expect(texts(container, '.odc-as-after')).toEqual(['$14.00'])
    expect(container.querySelector('.odc-as-after')).toHaveClass('odc-figure')
  })

  // redesign AS-A (M-AS13)
  it('puts the countdown in a live region that stays quiet', () => {
    renderCard(preview())
    expect(screen.getByText(/Expires in/).closest('[aria-live]')).toHaveAttribute('aria-live', 'off')
  })

  it('names the record #id, or Unnamed, when the API sent no name', () => {
    const { unmount } = renderCard(preview({ record_name: null }))
    expect(screen.getByRole('article', { name: '#45' })).toBeInTheDocument()
    unmount()
    renderCard(preview({ record_name: null, path_params: {} }))
    expect(screen.getByRole('article', { name: 'Unnamed' })).toBeInTheDocument()
  })

  it('says the current value is not available when the API did not read it', () => {
    renderCard(preview({ changes: [{ field: 'price', before_known: false, before: null, after: 14 }] }))
    expect(screen.getByText('(current value not available)')).toBeInTheDocument()
  })

  it('confirms and cancels with the id of the proposal', () => {
    const { onConfirm, onCancel } = renderCard(preview())
    const confirm = screen.getByRole('button', { name: 'Confirm change' })
    expect(confirm).toHaveAttribute('data-variant', 'primary')
    expect(confirm).toHaveAttribute('data-size', 'md') // redesign R1-4 (D1): 32px
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(['a1'])

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel).toHaveAttribute('data-variant', 'ghost')
    expect(cancel).toHaveAttribute('data-size', 'md')
    fireEvent.click(cancel)
    expect(onCancel).toHaveBeenCalledExactlyOnceWith(['a1'])
  })

  it('shows Applying… and blocks both buttons while the confirm is in flight', () => {
    const { onConfirm, onCancel } = renderCard(preview({ busy: true }))
    const applying = screen.getByRole('button', { name: 'Applying…' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(applying).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Confirm change' })).not.toBeInTheDocument()
    ;[applying, cancel].forEach(button => {
      fireEvent.click(button)
      expect(button.disabled || button.getAttribute('aria-disabled') === 'true').toBe(true)
    })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows a confirmed proposal as applying', () => {
    renderCard(preview({ status: 'confirmed' }))
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveAttribute('data-status', 'confirmed')
  })

  // redesign AS-A (M-AS12): the clock cannot expire what a confirm already sent
  it('keeps a proposal with a confirm in flight as proposed after its clock ran out', () => {
    renderCard(preview({ busy: true, expires_at: new Date(Date.now() - 5000).toISOString() }))
    expect(screen.getByRole('article')).toHaveAttribute('data-status', 'proposed')
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeInTheDocument()
    expect(screen.queryByText('This proposal expired')).not.toBeInTheDocument()
  })

  it('shows the proposal as expired once the clock ran out and nothing is in flight', () => {
    renderCard(preview({ expires_at: new Date(Date.now() - 5000).toISOString() }))
    expect(screen.getByRole('article')).toHaveAttribute('data-status', 'expired')
    expect(screen.getByText('This proposal expired')).toBeInTheDocument()
  })

  it('warns when the change is for another record than the one open', () => {
    renderCard(preview({ record_name: 'Crown Extra', context_mismatch: true }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This change is for Crown Extra, not for what you have open on this page. Check it before confirming.')
    expect(alert).toHaveAttribute('data-tone', 'warning')
    expect(alert.querySelector('svg')).not.toBeNull()
  })

  it.each([
    ['mcp_unavailable', 'Ordering couldn\'t connect right now. No change was made.'],
    ['no_permission', 'You don\'t have permission to make this change. No change was made.'],
    ['error', 'The change could not be sent. No change was made.']
  ])('shows the send error %s', (code, text) => {
    renderCard(preview({ requestError: code }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(text)
    expect(alert).toHaveAttribute('data-tone', 'danger')
  })

  it('sets money, numbers and dates in figures and keeps a schedule on several lines', () => {
    const schedule = [{ enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 22, minute: 0 } }] }]
    const { container } = renderCard(preview({
      changes: [
        { field: 'prepared_in', before_known: true, before: 10, after: 20 },
        { field: 'snooze_until', before_known: true, before: '2026-10-01', after: '2026-10-02' },
        { field: 'name', before_known: true, before: 'Pizza', after: 'Pizza XL' },
        { field: 'schedule', before_known: true, before: schedule, after: schedule }
      ]
    }))
    const rows = container.querySelectorAll('.odc-as-change')
    expect(rows[0].querySelector('.odc-as-after')).toHaveClass('odc-figure')
    expect(rows[0]).toHaveTextContent('20 min')
    expect(rows[1].querySelector('.odc-as-after')).toHaveClass('odc-figure')
    expect(rows[2].querySelector('.odc-as-after')).not.toHaveClass('odc-figure')
    expect(rows[3].querySelector('.odc-as-after').textContent).toBe('Sun 09:00–22:00')
  })
})

describe('AssistantActionCard: results', () => {
  const status = () => screen.getByRole('status')

  it('executed: the new value in bold, the old one struck, with icon and text', () => {
    const { container } = renderCard(preview({ status: 'executed', after: { price: 16 } }))
    expect(status()).toHaveTextContent('Product updated: Pizza Pepperoni')
    expect(status().querySelector('svg')).not.toBeNull()
    expect(texts(container, '.odc-as-before')).toEqual(['$12.00'])
    // the value the server read back, not the one proposed
    expect(texts(container, '.odc-as-after')).toEqual(['$16.00'])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument()
  })

  it('executed without a read-back: the proposed value in bold', () => {
    const { container } = renderCard(preview({ status: 'executed' }))
    expect(texts(container, '.odc-as-before')).toEqual(['$12.00'])
    expect(texts(container, '.odc-as-after')).toEqual(['$14.00'])
  })

  it.each([
    ['no_permission', 'You don\'t have permission to change this.'],
    ['mcp_unavailable', 'Ordering couldn\'t connect right now.'],
    ['rejected', 'Ordering didn\'t accept the change.']
  ])('failed (%s): the reason, no change made, and the proposal never looks applied', (state, reason) => {
    const { container } = renderCard(preview({ status: 'failed', error: { state } }))
    expect(status()).toHaveTextContent('Couldn\'t change Pizza Pepperoni')
    expect(status()).toHaveTextContent(reason)
    expect(status()).toHaveTextContent('No change was made.')
    expect(status().querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Proposed')).toBeInTheDocument()
    expect(container.querySelector('.odc-as-before')).toBeNull()
    expect(container.querySelector('.odc-as-after')).toBeNull()
    expect(texts(container, '.odc-as-dim')).toEqual(['$12.00', '$14.00'])
  })

  it.each([
    ['applied', 'It looks applied. This is what Pizza Pepperoni has now:'],
    ['not_applied', 'It doesn\'t look applied. You can ask for it again.'],
    ['unreadable', 'We couldn\'t read how it ended up either. Check it before trying again.']
  ])('unknown (%s): never shown as done', (observed, text) => {
    renderCard(preview({ status: 'unknown', observed }))
    expect(status()).toHaveTextContent('We couldn\'t confirm the change to Pizza Pepperoni')
    expect(status()).toHaveTextContent(text)
    expect(status().querySelector('svg')).not.toBeNull()
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument()
  })

  it('unknown and applied: what it has now, with no strike, no arrow and no bold', () => {
    const { container } = renderCard(preview({ status: 'unknown', observed: 'applied', after: { price: 16 } }))
    expect(texts(container, '.odc-as-now')).toEqual(['$16.00'])
    expect(within(status()).getByText('Price')).toBeInTheDocument()
    expect(container.querySelector('.odc-as-before')).toBeNull()
    expect(container.querySelector('.odc-as-after')).toBeNull()
    expect(screen.queryByText('Proposed')).not.toBeInTheDocument()
    expect(screen.queryByText('→')).not.toBeInTheDocument()
    expect(screen.queryByText('$12.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$14.00')).not.toBeInTheDocument()
  })

  it('unknown shows only the fields it read back, never the proposed value as current', () => {
    const { container } = renderCard(preview({
      status: 'unknown',
      observed: 'not_applied',
      after: { price: 12 },
      changes: [
        { field: 'price', before_known: true, before: 12, after: 14 },
        { field: 'name', before_known: true, before: 'Pizza', after: 'Pizza XL' }
      ]
    }))
    expect(texts(container, '.odc-as-now')).toEqual(['$12.00'])
    expect(screen.queryByText('Pizza XL')).not.toBeInTheDocument()
  })

  it('unknown and unreadable: no values at all', () => {
    const { container } = renderCard(preview({ status: 'unknown', observed: 'unreadable', after: { price: 16 } }))
    expect(container.querySelector('dl')).toBeNull()
    expect(screen.queryByText('$16.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$14.00')).not.toBeInTheDocument()
  })

  it('expired: says nothing changed, keeps the proposal dimmed and offers to propose again', () => {
    const onProposeAgain = vi.fn()
    const { container } = renderCard(preview({ status: 'expired' }), { onProposeAgain })
    expect(status()).toHaveTextContent('This proposal expired')
    expect(status()).toHaveTextContent('No change was made to Pizza Pepperoni.')
    expect(status().querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Proposed')).toBeInTheDocument()
    expect(container.querySelector('.odc-as-before')).toBeNull()
    expect(container.querySelector('.odc-as-after')).toBeNull()
    expect(texts(container, '.odc-as-dim')).toEqual(['$12.00', '$14.00'])

    const again = screen.getByRole('button', { name: 'Propose again' })
    expect(again).toHaveAttribute('data-variant', 'secondary')
    expect(again).toHaveAttribute('data-size', 'sm')
    fireEvent.click(again)
    expect(onProposeAgain).toHaveBeenCalledTimes(1)
  })

  it('expired without onProposeAgain: no button', () => {
    renderCard(preview({ status: 'expired' }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('cancelled: says the record stays as it was and keeps the proposal dimmed', () => {
    const { container } = renderCard(preview({ status: 'cancelled' }))
    expect(status()).toHaveTextContent('You cancelled this change')
    expect(status()).toHaveTextContent('Pizza Pepperoni stays as it was.')
    expect(status().querySelector('svg')).not.toBeNull()
    expect(screen.getByText('Proposed')).toBeInTheDocument()
    expect(container.querySelector('.odc-as-before')).toBeNull()
    expect(container.querySelector('.odc-as-after')).toBeNull()
    expect(texts(container, '.odc-as-dim')).toEqual(['$12.00', '$14.00'])
  })

  it('renders nothing without an action', () => {
    const { container } = renderCard(null)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AssistantActionCard: focus (M-AS2)', () => {
  it('moves the focus to the result when it was on the card as the proposal got its result', () => {
    const { update } = renderCard(preview())
    screen.getByRole('button', { name: 'Confirm change' }).focus()

    update(preview({ busy: true }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Applying…' }))

    update(preview({ status: 'executed', after: { price: 14 } }))
    expect(document.activeElement).toBe(screen.getByRole('status'))
    expect(screen.getByRole('status')).toHaveAttribute('tabindex', '-1')
  })

  it('does not move anything when the focus was somewhere else', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    const { update } = renderCard(preview())
    outside.focus()

    update(preview({ status: 'failed', error: { state: 'rejected' } }))
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('does not move anything when the result arrives with nothing focused', () => {
    const { update } = renderCard(preview())
    update(preview({ status: 'executed' }))
    expect(document.activeElement).toBe(document.body)
  })
})
