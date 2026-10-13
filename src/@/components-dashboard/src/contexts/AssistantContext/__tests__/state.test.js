import { describe, expect, it } from 'vitest'
import { buildConversationState, conversationReducer, initialConversationState } from '../state'

const preview = (overrides = {}) => ({
  id: 'a1',
  operation_id: 'Product.update',
  path_params: { business_id: 3, category_id: 7, product_id: 45 },
  record_name: 'Pizza Pepperoni',
  status: 'proposed',
  expires_at: '2099-01-01T00:00:00.000Z',
  changes: [{ field: 'price', before_known: true, before: 12, after: 14 }],
  ...overrides
})

const run = (state, ...actions) => actions.reduce(conversationReducer, state)
const event = (name, data) => ({ type: 'stream_event', event: name, data })
const kinds = (state) => state.items.map(item => item.kind)

it('keeps exactly one final navigation block per turn and restores v2 on reload', () => {
  const first = { version: 2, mode: 'open', scope: 'scope', revision: 'rev', status: 'ok', items: [{ id: 'stripe-section', title: 'Stripe Connect' }] }
  const final = { ...first, items: [{ id: 'stripe-field', title: 'Client ID' }] }
  const state = run(initialConversationState,
    { type: 'user_message', text: 'Stripe' },
    event('destinations', first), event('destinations', final)
  )
  expect(state.items.filter(item => item.kind === 'destinations')).toHaveLength(1)
  expect(state.items.find(item => item.kind === 'destinations').items).toEqual(final.items)
  const restored = buildConversationState({
    id: 'conversation',
    messages: [
      { id: 1, role: 'user', type: 'text', text: 'Stripe' },
      { id: 2, role: 'tool', type: 'dashboard_navigation', hidden: true, destinations: first },
      { id: 3, role: 'tool', type: 'dashboard_navigation', hidden: true, destinations: final }
    ]
  })
  expect(restored.items.filter(item => item.kind === 'destinations')).toEqual([{ kind: 'destinations', ...final, key: 'd3' }])
})

describe('conversationReducer: a streamed turn', () => {
  it('keeps the tool name when a later status omits it', () => {
    const state = run(initialConversationState,
      event('tool', { id: 'search', name: 'search_dashboard_destinations', status: 'running' }),
      event('tool', { id: 'search', status: 'done' })
    )
    expect(state.items).toHaveLength(1)
    expect(state.items[0]).toMatchObject({ name: 'search_dashboard_destinations', status: 'done' })
  })

  it('builds the answer from text deltas, tool calls and a preview', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Raise the pepperoni to $14' },
      event('conversation', { id: 'c1', title: 'Pepperoni price' }),
      event('tool', { id: 't1', name: 'read_operation', label: null, status: 'running' }),
      event('tool', { id: 't1', name: 'read_operation', label: null, status: 'done' }),
      event('text', { delta: 'Here is ' }),
      event('text', { delta: 'the change:' }),
      event('actions', { actions: [preview()] }),
      event('done', { message_id: 9, aborted: false })
    )

    expect(state.conversation).toEqual({ id: 'c1', title: 'Pepperoni price' })
    expect(kinds(state)).toEqual(['user', 'tool', 'assistant', 'actions'])
    expect(state.items[1]).toMatchObject({ toolId: 't1', name: 'read_operation', status: 'done' })
    expect(state.items[2]).toMatchObject({ text: 'Here is the change:', streaming: false })
    expect(state.items[3].actionIds).toEqual(['a1'])
    expect(state.actions.a1).toMatchObject({ status: 'proposed', record_name: 'Pizza Pepperoni', busy: false })
    expect(state.streaming).toBe(false)
  })

  it('starts a new text block after a tool call', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Sales?' },
      event('text', { delta: 'Let me check.' }),
      event('tool', { id: 't1', status: 'running' }),
      event('text', { delta: 'Yesterday: $120.' })
    )
    expect(kinds(state)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(state.items[1].streaming).toBe(false)
    expect(state.items[3].streaming).toBe(true)
  })

  it('keeps destination search results separate from confirmed actions', () => {
    const state = run(
      initialConversationState,
      event('destinations', {
        id: 'tool-1',
        version: 1,
        scope: 'scope-1',
        revision: 'revision-1',
        query: 'orders',
        status: 'ok',
        items: [{ id: 'nav:orders', title: 'Orders' }],
        errors: []
      })
    )

    expect(kinds(state)).toEqual(['destinations'])
    expect(state.items[0]).toMatchObject({ kind: 'destinations', id: 'tool-1', status: 'ok' })
    expect(state.actions).toEqual({})
  })

  it('marks the last answer of the turn as stopped', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Sales?' },
      event('text', { delta: 'Yesterday the sales' }),
      { type: 'turn_finished', aborted: true }
    )
    expect(state.items[1]).toMatchObject({ aborted: true, streaming: false })
    expect(state.streaming).toBe(false)
  })

  it('adds a stopped note when the turn stopped before any text', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Sales?' },
      event('tool', { id: 't1', status: 'running' }),
      { type: 'turn_finished', aborted: true }
    )
    expect(kinds(state)).toEqual(['user', 'tool', 'assistant'])
    expect(state.items[2]).toMatchObject({ text: '', aborted: true })
  })

  it('expires what was waiting once the next turn starts on the server', () => {
    const waiting = run(initialConversationState, event('actions', { actions: [preview()] }))
    const sent = run(waiting, { type: 'user_message', text: 'Never mind' })
    expect(sent.actions.a1.status).toBe('proposed')

    const started = run(sent, event('conversation', { id: 'c1' }))
    expect(started.actions.a1.status).toBe('expired')
  })

  it('takes a refused message out of the chat and shows why', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Hi' },
      { type: 'turn_failed', code: 'busy', message: '', unsent: true }
    )
    expect(kinds(state)).toEqual(['error'])
    expect(state.items[0].code).toBe('busy')
    expect(state.streaming).toBe(false)
  })

  it('keeps the message when the turn failed after it started', () => {
    const state = run(
      initialConversationState,
      { type: 'user_message', text: 'Hi' },
      event('conversation', { id: 'c1' }),
      event('error', { code: 'mcp_unavailable', message: 'down' })
    )
    expect(kinds(state)).toEqual(['user', 'error'])
    expect(state.streaming).toBe(false)
  })
})

describe('conversationReducer: confirming', () => {
  it('keeps the record name from the preview when the result has none', () => {
    const state = run(
      initialConversationState,
      event('actions', { actions: [preview()] }),
      { type: 'actions_busy', ids: ['a1'], busy: true },
      { type: 'action_results', ids: ['a1'], results: [preview({ record_name: null, status: 'executed', after: { price: 14 } })] }
    )
    expect(state.actions.a1).toMatchObject({ status: 'executed', record_name: 'Pizza Pepperoni', busy: false, after: { price: 14 } })
  })

  it('leaves a card as it was when the result has no status', () => {
    const state = run(
      initialConversationState,
      event('actions', { actions: [preview()] }),
      { type: 'actions_busy', ids: ['a1'], busy: true },
      { type: 'action_results', ids: ['a1'], results: [{ id: 'a1', status: null, error: { code: 'not_found' } }] }
    )
    expect(state.actions.a1).toMatchObject({ status: 'proposed', busy: false })
  })

  it('keeps the proposal and records why the request failed', () => {
    const state = run(
      initialConversationState,
      event('actions', { actions: [preview()] }),
      { type: 'actions_busy', ids: ['a1'], busy: true },
      { type: 'actions_failed', ids: ['a1'], code: 'mcp_unavailable' }
    )
    expect(state.actions.a1).toMatchObject({ status: 'proposed', busy: false, requestError: 'mcp_unavailable' })
  })
})

describe('buildConversationState', () => {
  it('rehydrates destination metadata from hidden tool-result messages', () => {
    const destinations = {
      version: 1,
      scope: 'scope-1',
      revision: 'old-revision',
      query: 'orders',
      status: 'ok',
      items: [{ id: 'nav:orders', title: 'Orders' }],
      errors: []
    }
    const state = buildConversationState({
      id: 'c1',
      messages: [{
        id: 9,
        role: 'tool',
        type: 'tool_result',
        hidden: true,
        destinations
      }]
    })

    expect(state.items).toEqual([{ kind: 'destinations', key: 'd9', ...destinations }])
    expect(state.actions).toEqual({})
  })

  it('shows visible messages and puts each preview after its anchor', () => {
    const state = buildConversationState({
      id: 'c1',
      title: 'Pepperoni',
      messages: [
        { id: 1, role: 'user', type: 'text', text: 'Raise it', hidden: false },
        { id: 2, role: 'assistant', type: 'assistant', text: null, hidden: true, tool_calls: [{ id: 't1' }] },
        { id: 3, role: 'tool', type: 'tool_result', hidden: true },
        { id: 4, role: 'assistant', type: 'assistant', text: 'Here it is', hidden: false, aborted: false },
        { id: 5, role: 'user', type: 'text', text: 'Thanks', hidden: false },
        { id: 6, role: 'assistant', type: 'assistant', text: 'You are welcome', hidden: false, aborted: true }
      ],
      actions: [
        preview({ id: 'a1', record_name: null, status: 'executed', message_id: 2, anchor_message_id: 4 }),
        preview({ id: 'a2', record_name: null, status: 'proposed', message_id: 90, anchor_message_id: null }),
        preview({ id: 'a3', record_name: null, status: 'cancelled', message_id: 80, anchor_message_id: 77 })
      ]
    })

    expect(state.conversation).toEqual({ id: 'c1', title: 'Pepperoni' })
    expect(state.items.map(item => [item.kind, item.text ?? item.actionIds])).toEqual([
      ['user', 'Raise it'],
      ['assistant', 'Here it is'],
      ['actions', ['a1']],
      ['user', 'Thanks'],
      ['assistant', 'You are welcome'],
      ['actions', ['a2', 'a3']]
    ])
    expect(state.items[4].aborted).toBe(true)
    expect(state.actions.a1.status).toBe('executed')
  })
})
