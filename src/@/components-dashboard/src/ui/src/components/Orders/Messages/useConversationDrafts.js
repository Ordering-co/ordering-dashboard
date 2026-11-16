import { useRef } from 'react'

// redesign messages B3b (decision 10A): one draft per conversation, so switching A → B → A does not carry A's text into B (it would be
// sent to the wrong order, W0-P2-09) and does not lose it either. In memory and per mounted page: a draft may hold private text and an
// image, so it is never written to localStorage.
const createDrafts = () => {
  const drafts = new Map()
  return {
    // `{ text, image, recipients }` or null; B1's ConversationChat takes it as `initialDraft`
    get: orderId => drafts.get(orderId) ?? null,
    // detached on purpose: it is passed as `onDraftChange(orderId, { text, image, recipients })`
    // redesign messages R1 (Q-01): `recipients` is the chat's `canRead` (`{ administrator, business, customer, driver }`) or null. A draft with
    // only recipients is kept: «store only» must survive the trip to another conversation. The entry goes only when all three are empty.
    set: (orderId, draft) => {
      if (!draft || (!draft.text && !draft.image && !draft.recipients)) {
        drafts.delete(orderId)
        return
      }
      drafts.set(orderId, { text: draft.text ?? '', image: draft.image ?? null, recipients: draft.recipients ?? null })
    }
  }
}

export const useConversationDrafts = () => {
  const ref = useRef(null)
  if (ref.current === null) ref.current = createDrafts()
  return ref.current
}
