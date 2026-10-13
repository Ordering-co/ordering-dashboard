/**
 * Conversation state of the assistant, built from the server-sent events of a
 * turn and from `GET /conversations/{id}` after a reload.
 *
 * `items` is what the chat shows, in order:
 * - `{ kind: 'user', key, text }`
 * - `{ kind: 'assistant', key, text, streaming, aborted }`
 * - `{ kind: 'tool', key, toolId, name, label, status }` (running | done | error)
 * - `{ kind: 'actions', key, actionIds }`: a preview card
 * - `{ kind: 'error', key, code, message }`: the turn failed
 *
 * `actions` holds each proposed change by id: its preview, then its outcome
 * once confirmed or cancelled, plus `busy` while a request runs and
 * `requestError` when that request failed before reaching the action.
 */

export const initialConversationState = {
  conversation: null,
  items: [],
  actions: {},
  streaming: false,
  seq: 0
}

const lastUserIndex = (items) => {
  for (let index = items.length - 1; index >= 0; index--) {
    if (items[index].kind === 'user') return index
  }
  return -1
}

const finishStreaming = (items) => items.map(item => (
  item.kind === 'assistant' && item.streaming ? { ...item, streaming: false } : item
))

/** Keep what only the live preview carries (the record name) when a result replaces it */
const mergeAction = (previous, next) => ({
  ...previous,
  ...next,
  record_name: next.record_name ?? previous?.record_name ?? null,
  busy: false,
  requestError: null
})

const applyStreamEvent = (state, event, data) => {
  const seq = state.seq + 1
  const items = state.items

  switch (event) {
    case 'conversation': {
      // The turn started: the server expired what was still waiting
      const actions = {}
      Object.entries(state.actions).forEach(([id, item]) => {
        actions[id] = item.status === 'proposed' ? { ...item, status: 'expired' } : item
      })
      return { ...state, actions, conversation: { id: data.id, title: data.title ?? null } }
    }

    case 'text': {
      const last = items[items.length - 1]
      if (last?.kind === 'assistant' && last.streaming) {
        return { ...state, items: [...items.slice(0, -1), { ...last, text: `${last.text}${data.delta ?? ''}` }] }
      }
      return {
        ...state,
        seq,
        items: [...items, { kind: 'assistant', key: `s${seq}`, text: data.delta ?? '', streaming: true, aborted: false }]
      }
    }

    case 'tool': {
      const index = items.findIndex(item => item.kind === 'tool' && item.toolId === data.id)
      const tool = { toolId: data.id, name: data.name || items[index]?.name || null, label: data.label || null, status: data.status }
      if (index >= 0) {
        const next = [...items]
        next[index] = { ...items[index], ...tool, label: tool.label || items[index].label }
        return { ...state, items: next }
      }
      // Text after a tool call is a new block
      return { ...state, seq, items: [...finishStreaming(items), { kind: 'tool', key: `s${seq}`, ...tool }] }
    }

    case 'actions': {
      const previews = Array.isArray(data.actions) ? data.actions : []
      if (previews.length === 0) return state
      const actions = { ...state.actions }
      previews.forEach(preview => { actions[preview.id] = mergeAction(actions[preview.id], preview) })
      return {
        ...state,
        seq,
        actions,
        items: [...finishStreaming(items), { kind: 'actions', key: `s${seq}`, actionIds: previews.map(preview => preview.id) }]
      }
    }

    case 'destinations': {
      if (!data || !Array.isArray(data.items)) return state
      const turnStart = lastUserIndex(items)
      const previous = items.findIndex((item, index) => index > turnStart && item.kind === 'destinations')
      const destinations = { kind: 'destinations', ...data, key: data.key || `s${seq}` }
      if (previous >= 0) {
        const next = finishStreaming(items)
        next[previous] = { ...destinations, key: items[previous].key }
        return { ...state, seq, items: next }
      }
      return {
        ...state,
        seq,
        items: [...finishStreaming(items), destinations]
      }
    }

    case 'done':
      return data?.aborted ? markAborted({ ...state, streaming: false }) : { ...state, streaming: false, items: finishStreaming(items) }

    case 'error':
      return {
        ...state,
        seq,
        streaming: false,
        items: [...finishStreaming(items), { kind: 'error', key: `s${seq}`, code: data?.code || 'error', message: data?.message || '' }]
      }

    default:
      return state
  }
}

/** The turn stopped: the last answer shows it, or a note says so */
const markAborted = (state) => {
  const items = finishStreaming(state.items)
  const turnStart = lastUserIndex(items)
  for (let index = items.length - 1; index > turnStart; index--) {
    if (items[index].kind === 'assistant') {
      const next = [...items]
      next[index] = { ...items[index], aborted: true }
      return { ...state, streaming: false, items: next }
    }
  }
  const seq = state.seq + 1
  return { ...state, seq, streaming: false, items: [...items, { kind: 'assistant', key: `s${seq}`, text: '', streaming: false, aborted: true }] }
}

/**
 * The state of a stored conversation (`GET /conversations/{id}`). Hidden
 * messages and tool calls stay out; each preview goes after its anchor
 * message, or at the end when it has none.
 */
export const buildConversationState = (conversation) => {
  const actions = {}
  const byAnchor = new Map()
  const trailing = []

  for (const action of conversation?.actions || []) {
    actions[action.id] = mergeAction(null, action)
    const anchor = action.anchor_message_id ?? null
    if (anchor === null) {
      trailing.push(action.id)
    } else {
      byAnchor.set(anchor, [...(byAnchor.get(anchor) || []), action.id])
    }
  }

  const items = []
  const placed = new Set()
  for (const message of conversation?.messages || []) {
    if (!message.hidden) {
      if (message.type === 'text') {
        items.push({ kind: 'user', key: `m${message.id}`, text: message.text || '' })
      } else if (message.type === 'assistant') {
        items.push({ kind: 'assistant', key: `m${message.id}`, text: message.text || '', streaming: false, aborted: !!message.aborted })
      }
    }
    if ([1, 2].includes(message.destinations?.version)) {
      const start = lastUserIndex(items)
      const previous = items.findIndex((item, index) => index > start && item.kind === 'destinations')
      if (previous >= 0) items.splice(previous, 1)
      items.push({ kind: 'destinations', ...message.destinations, key: `d${message.id}` })
    }
    const anchored = byAnchor.get(message.id)
    if (anchored && !placed.has(message.id)) {
      placed.add(message.id)
      items.push({ kind: 'actions', key: `a${message.id}`, actionIds: anchored })
    }
  }
  // An anchor outside the loaded messages falls to the end
  for (const [anchor, ids] of byAnchor) {
    if (!placed.has(anchor)) trailing.push(...ids)
  }
  if (trailing.length > 0) items.push({ kind: 'actions', key: 'a-end', actionIds: trailing })

  return {
    ...initialConversationState,
    conversation: conversation?.id ? { id: conversation.id, title: conversation.title ?? null } : null,
    items,
    actions
  }
}

export const conversationReducer = (state, action) => {
  switch (action.type) {
    case 'reset':
      return initialConversationState

    case 'loaded':
      return buildConversationState(action.conversation)

    case 'forget_conversation':
      return { ...state, conversation: null }

    case 'user_message': {
      const seq = state.seq + 1
      return {
        ...state,
        seq,
        streaming: true,
        items: [...finishStreaming(state.items), { kind: 'user', key: `s${seq}`, text: action.text }]
      }
    }

    case 'stream_event':
      return applyStreamEvent(state, action.event, action.data)

    case 'turn_finished':
      if (!state.streaming) return state
      return action.aborted ? markAborted(state) : { ...state, streaming: false, items: finishStreaming(state.items) }

    case 'turn_failed': {
      // Refused before the stream started: the message was not stored, so it
      // leaves the chat (the composer gets the text back)
      const index = action.unsent ? lastUserIndex(state.items) : -1
      const items = index >= 0 ? [...state.items.slice(0, index), ...state.items.slice(index + 1)] : state.items
      return applyStreamEvent({ ...state, items, streaming: false }, 'error', { code: action.code, message: action.message })
    }

    case 'actions_busy': {
      const actions = { ...state.actions }
      action.ids.forEach(id => {
        if (actions[id]) actions[id] = { ...actions[id], busy: action.busy, requestError: null }
      })
      return { ...state, actions }
    }

    case 'actions_failed': {
      const actions = { ...state.actions }
      action.ids.forEach(id => {
        if (actions[id]) actions[id] = { ...actions[id], busy: false, requestError: action.code || 'error' }
      })
      return { ...state, actions }
    }

    case 'action_results': {
      const actions = { ...state.actions }
      ;(action.results || []).forEach(result => {
        // A result without status (not_found) leaves the card as it was
        if (!result?.id || !result.status) return
        actions[result.id] = mergeAction(actions[result.id], result)
      })
      action.ids?.forEach(id => {
        if (actions[id]?.busy) actions[id] = { ...actions[id], busy: false }
      })
      return { ...state, actions }
    }

    default:
      return state
  }
}
