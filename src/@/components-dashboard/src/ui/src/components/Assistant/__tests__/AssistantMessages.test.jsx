import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

// redesign AS-A (D1): the message list, the group of proposals, turn errors and the tool line

const assistant = vi.hoisted(() => ({ current: {} }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ parsePrice: (value) => `$${Number(value).toFixed(2)}`, parseDate: (value) => String(value) }],
  useAssistant: () => assistant.current
}))
// The destinations block has its own tests (and its own lot)
vi.mock('../AssistantDestinations', () => ({ AssistantDestinations: () => null }))

import { AssistantMessages } from '../AssistantMessages'

const action = (id, overrides = {}) => ({
  id,
  operation_id: 'Product.update',
  path_params: { product_id: Number(id.replace(/\D/g, '')) || 1 },
  record_name: id === 'a1' ? 'Pizza Pepperoni' : 'Crown Extra',
  status: 'proposed',
  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  changes: [{ field: 'price', before_known: true, before: 12, after: 14 }],
  ...overrides
})

const setAssistant = (overrides = {}) => {
  assistant.current = {
    items: [],
    actions: {},
    streaming: false,
    confirmActions: vi.fn(),
    cancelActions: vi.fn(),
    ...overrides
  }
  return assistant.current
}

const group = (ids) => ({ kind: 'actions', key: 'k1', actionIds: ids })
const tool = (key, status, label = null) => ({ kind: 'tool', key, name: 'read_operation', status, label })

describe('AssistantMessages', () => {
  beforeEach(() => setAssistant())

  it('paints the user bubble and the answer with their own classes', () => {
    setAssistant({
      items: [
        { kind: 'user', key: 'u1', text: 'Raise it' },
        { kind: 'assistant', key: 's1', text: 'Done **now**', streaming: true, aborted: false }
      ]
    })
    const { container } = render(<AssistantMessages />)
    expect(screen.getByText('Raise it')).toHaveClass('odc-as-user')
    const answer = container.querySelector('.odc-as-text')
    expect(answer).toHaveTextContent('Done now')
    expect(answer).toHaveAttribute('data-streaming', 'true')
  })

  it('says when the answer stopped', () => {
    setAssistant({ items: [{ kind: 'assistant', key: 's1', text: '', streaming: false, aborted: true }] })
    render(<AssistantMessages />)
    expect(screen.getByText('Answer stopped')).toHaveClass('odc-as-note')
  })

  // redesign AS-A (M-AS13)
  it('is a polite live region that is busy while the answer streams, so it is read whole at the end', () => {
    setAssistant({ streaming: true })
    const { container, rerender } = render(<AssistantMessages />)
    const list = container.querySelector('[aria-live="polite"]')
    expect(list).toHaveAttribute('aria-busy', 'true')

    setAssistant({ streaming: false })
    rerender(<AssistantMessages />)
    expect(container.querySelector('[aria-live="polite"]')).toHaveAttribute('aria-busy', 'false')
  })
})

describe('AssistantMessages: turn errors', () => {
  it.each([
    ['mcp_unavailable', 'Ordering couldn\'t connect right now. No change was made.'],
    ['no_permission', 'You don\'t have permission to do this.'],
    ['busy', 'I\'m still answering in this conversation. Wait a moment and send it again.'],
    ['usage_limit', 'The assistant reached its usage limit.'],
    ['other', 'Something went wrong while answering. No change was made.']
  ])('shows %s as a danger alert', (code, text) => {
    setAssistant({ items: [{ kind: 'error', key: 'e1', code }] })
    render(<AssistantMessages />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(text)
    expect(alert).toHaveAttribute('data-tone', 'danger')
  })
})

describe('AssistantMessages: tool line', () => {
  it('shows what is running, with a spinning icon', () => {
    setAssistant({ items: [tool('t1', 'running')] })
    const { container } = render(<AssistantMessages />)
    const line = screen.getByRole('status')
    expect(line).toHaveTextContent('Looking up data…')
    expect(line).toHaveAttribute('data-state', 'running')
    expect(line.querySelector('svg')).toHaveClass('odc-spin')
    expect(container.innerHTML).not.toMatch(/#0E9B55/i)
  })

  it('shows a finished read with a check that takes its colour from a token', () => {
    setAssistant({ items: [tool('t1', 'done')] })
    const { container } = render(<AssistantMessages />)
    const line = screen.getByText('Looked up data')
    expect(line).toHaveAttribute('data-state', 'done')
    expect(line.querySelector('svg')).not.toBeNull()
    expect(container.innerHTML).not.toMatch(/#0E9B55/i)
    expect(line.querySelector('svg')).not.toHaveAttribute('color')
  })

  it('counts several reads and joins their labels when they have one', () => {
    setAssistant({ items: [tool('t1', 'done'), tool('t2', 'done'), tool('t3', 'done')] })
    const { unmount } = render(<AssistantMessages />)
    expect(screen.getByText('Looked up data (3)')).toBeInTheDocument()
    unmount()

    setAssistant({ items: [tool('t1', 'done', 'Products'), tool('t2', 'done', 'Orders'), tool('t3', 'done', 'Products')] })
    render(<AssistantMessages />)
    expect(screen.getByText('Products · Orders')).toBeInTheDocument()
  })

  it('shows reads that all failed with their own state and icon', () => {
    setAssistant({ items: [tool('t1', 'error'), tool('t2', 'error')] })
    render(<AssistantMessages />)
    const line = screen.getByText('Looked up data (2)')
    expect(line).toHaveAttribute('data-state', 'error')
    expect(line.querySelector('svg')).not.toBeNull()
  })

  it('does not show the internal navigation tools', () => {
    setAssistant({
      items: [
        { kind: 'tool', key: 'n1', name: 'search_dashboard_destinations', status: 'done' },
        { kind: 'tool', key: 'n2', name: 'present_dashboard_navigation', status: 'running' }
      ]
    })
    render(<AssistantMessages />)
    expect(screen.queryByText(/Looked up data|Looking up data/)).not.toBeInTheDocument()
  })
})

describe('AssistantMessages: group of proposals', () => {
  const twoWaiting = (overrides = {}) => setAssistant({
    items: [group(['a1', 'a2'])],
    actions: { a1: action('a1'), a2: action('a2') },
    ...overrides
  })

  it('names what waits and offers Confirm all as a secondary button', () => {
    const { confirmActions } = twoWaiting()
    const { container } = render(<AssistantMessages />)

    expect(screen.getAllByRole('article')).toHaveLength(2)
    const row = container.querySelector('.odc-as-group')
    expect(row).toHaveTextContent('Waiting for you: Pizza Pepperoni, Crown Extra')
    const button = within(row).getByRole('button', { name: 'Confirm all (2)' })
    expect(button).toHaveAttribute('data-variant', 'secondary')
    expect(button).toHaveAttribute('data-size', 'md') // redesign R1-4 (D1): 32px, like the card buttons

    fireEvent.click(button)
    expect(confirmActions).toHaveBeenCalledExactlyOnceWith(['a1', 'a2'])
  })

  // redesign R1-1: the row follows the clock like the cards, so it never offers what already expired
  it('drops the group row when the proposals expire by the clock, without a new render from outside', () => {
    vi.useFakeTimers()
    try {
      const soon = new Date(Date.now() + 2000).toISOString()
      setAssistant({
        items: [group(['a1', 'a2'])],
        actions: { a1: action('a1', { expires_at: soon }), a2: action('a2', { expires_at: soon }) }
      })
      const { container } = render(<AssistantMessages />)
      expect(container.querySelector('.odc-as-group')).not.toBeNull()
      act(() => { vi.advanceTimersByTime(3000) })
      expect(container.querySelector('.odc-as-group')).toBeNull()
      expect(screen.queryByRole('button', { name: /Confirm all/ })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('has no group row with a single proposal waiting', () => {
    setAssistant({ items: [group(['a1'])], actions: { a1: action('a1') } })
    const { container } = render(<AssistantMessages />)
    expect(container.querySelector('.odc-as-group')).toBeNull()
    expect(screen.queryByRole('button', { name: /Confirm all/ })).not.toBeInTheDocument()
  })

  it('does not count what already has a confirm in flight or a result', () => {
    setAssistant({
      items: [group(['a1', 'a2', 'a3'])],
      actions: { a1: action('a1'), a2: action('a2', { busy: true }), a3: action('a3', { status: 'executed' }) }
    })
    const { container } = render(<AssistantMessages />)
    expect(container.querySelector('.odc-as-group')).toBeNull()
  })

  it('offers to propose again only when the assistant is not answering', () => {
    const onProposeAgain = vi.fn()
    setAssistant({ items: [group(['a1'])], actions: { a1: action('a1', { status: 'expired' }) } })
    const { unmount } = render(<AssistantMessages onProposeAgain={onProposeAgain} />)
    fireEvent.click(screen.getByRole('button', { name: 'Propose again' }))
    expect(onProposeAgain).toHaveBeenCalledTimes(1)
    unmount()

    setAssistant({ streaming: true, items: [group(['a1'])], actions: { a1: action('a1', { status: 'expired' }) } })
    render(<AssistantMessages onProposeAgain={onProposeAgain} />)
    expect(screen.queryByRole('button', { name: 'Propose again' })).not.toBeInTheDocument()
  })

  // redesign AS-A (M-AS2): the group row goes away as the changes get applied
  it('carries the focus from Confirm all to the result of the first card of the group', () => {
    const state = twoWaiting()
    const { rerender } = render(<AssistantMessages />)
    screen.getByRole('button', { name: 'Confirm all (2)' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm all (2)' }))
    expect(state.confirmActions).toHaveBeenCalledExactlyOnceWith(['a1', 'a2'])

    setAssistant({
      items: [group(['a1', 'a2'])],
      actions: { a1: action('a1', { status: 'executed', after: { price: 14 } }), a2: action('a2', { status: 'executed', after: { price: 14 } }) }
    })
    rerender(<AssistantMessages />)

    const first = screen.getAllByRole('article')[0]
    expect(document.activeElement).toBe(within(first).getByRole('status'))
  })

  it('does not move the focus when Confirm all was not focused', () => {
    twoWaiting()
    const { rerender } = render(<AssistantMessages />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm all (2)' }))

    setAssistant({
      items: [group(['a1', 'a2'])],
      actions: { a1: action('a1', { status: 'executed' }), a2: action('a2', { status: 'executed' }) }
    })
    rerender(<AssistantMessages />)
    expect(document.activeElement).toBe(document.body)
  })
})
