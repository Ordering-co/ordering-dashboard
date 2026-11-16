import React, { useEffect, useRef, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { EmptyState } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { MessageSquare } from '../../Shared/Icon'
import { ConversationChat } from '../OrderDetails/ChatTab'
import { ConversationList } from './ConversationList'
import { ConversationHeader } from './ConversationHeader'
import { useConversationDrafts } from './useConversationDrafts'
import './inbox.css'

// redesign messages B3b (decisions 1A, 8A, 9A, 10A): the /messages inbox. Two panes from 768px, the list first and the conversation
// full screen below it. It owns the selection, the drafts and the layout; the list (B3a) and the chat (B1) own the rest.
//
// redesign messages R1 (Q-05): on a phone the open conversation is a history entry, so the system back closes it like «Back» does.
// Opening pushes `conversation=<orderId>` onto the current query (`id`, `page` and the rest stay); the pane is open while the location
// holds the key of the selected order. A reload with the key opens that conversation once the list holds it. On desktop the query is
// not used.
const CONVERSATION_KEY = 'conversation'

// addQueryToUrl (page, pageSize) rewrites the URL with replaceState, which the router does not hear: when the router and the window are
// on the same path, the window has the query as it really is.
const currentSearch = (history) => (
  typeof window !== 'undefined' && window.location.pathname === history.location.pathname ? window.location.search : history.location.search
)

const searchWith = (search, orderId) => {
  const query = new URLSearchParams(search)
  if (orderId == null) query.delete(CONVERSATION_KEY)
  else query.set(CONVERSATION_KEY, String(orderId))
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const Inbox = ({ onOpenOrder, orderDetailOpen = false, showBusiness = true, ...listProps }) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const drafts = useConversationDrafts()
  const [scope, setScope] = useState('active')
  const [sort, setSort] = useState('last_direct_message_at')
  const [selectedId, setSelectedId] = useState(null)
  const [engaged, setEngaged] = useState(false)
  const [orders, setOrders] = useState([])
  // redesign messages R2.2 (M-08): { orderId, seq }, a new seq on every read. The chat calls its callback with null and then with the
  // id in the same tick; with only the id in state, a second read of the same conversation changed nothing and the list kept its count.
  const [unreadResetSignal, setUnreadResetSignal] = useState(null)
  const handleUpdateOrderForUnreadCount = (orderId) => {
    if (orderId == null) return
    setUnreadResetSignal(previous => ({ orderId, seq: (previous?.seq ?? 0) + 1 }))
  }
  const history = useHistory()
  const location = useLocation()
  const conversationId = isPhone ? new URLSearchParams(location.search).get(CONVERSATION_KEY) : null
  const listRef = useRef(null)
  const backRef = useRef(null)
  const lastSnapshot = useRef(null)
  const pushedByUs = useRef(false)
  const wasPaneOpen = useRef(false)

  const goTo = (method, orderId) => history[method]({
    pathname: history.location.pathname,
    search: searchWith(currentSearch(history), orderId),
    hash: history.location.hash
  })

  const handleSelect = (order, { byUser } = {}) => {
    lastSnapshot.current = order
    setSelectedId(order.id)
    setEngaged(!!byUser)
    if (byUser && isPhone) {
      pushedByUs.current = true
      goTo('push', order.id)
    }
  }

  // The open order is the one the list holds, so the header and the chat follow `update_order`. When it leaves the list (another
  // scope or page) the last snapshot stays, so the conversation does not vanish under the user.
  const liveOrder = orders.find(order => order.id === selectedId)
  if (liveOrder) lastSnapshot.current = liveOrder
  const order = liveOrder ?? (lastSnapshot.current?.id === selectedId ? lastSnapshot.current : null)

  // on a phone the pane is open while the location names the selected order
  const paneOnPhone = isPhone && !!order && conversationId != null && String(order.id) === conversationId

  // a reload (or a forward) with the key: that conversation opens as soon as the list holds it
  useEffect(() => {
    if (conversationId == null || (selectedId != null && String(selectedId) === conversationId)) return
    const target = orders.find(candidate => String(candidate.id) === conversationId)
    if (!target) return
    pushedByUs.current = false
    lastSnapshot.current = target
    setSelectedId(target.id)
    setEngaged(true)
  }, [conversationId, orders, selectedId])

  // «Back» takes the entry we pushed away; a conversation that came from the URL has none of ours behind it, so it drops the key
  const handleBack = () => {
    if (pushedByUs.current) history.goBack()
    else goTo('replace', null)
  }

  // however the pane closes (the system back, a location without the key, «Back»), the focus returns to the row it came from: the
  // selected one, which stays marked in the list under the pane
  useEffect(() => {
    if (wasPaneOpen.current && !paneOnPhone) {
      pushedByUs.current = false
      if (isPhone) {
        window.requestAnimationFrame(() => {
          const row = listRef.current?.querySelector('[aria-current="true"]')
          const target = row?.matches('button') ? row : row?.querySelector('button')
          target?.focus()
        })
      }
    }
    wasPaneOpen.current = paneOnPhone
  }, [paneOnPhone])

  useEffect(() => {
    if (paneOnPhone) backRef.current?.focus()
  }, [paneOnPhone])

  const showPane = !isPhone || paneOnPhone

  return (
    <div className='odi-inbox' data-phone={isPhone ? '' : undefined}>
      <div className='odi-list' ref={listRef} inert={paneOnPhone ? '' : undefined}>
        <ConversationList
          {...listProps}
          scope={scope}
          onScopeChange={setScope}
          sort={sort}
          onSortChange={setSort}
          selectedId={selectedId}
          onSelect={handleSelect}
          autoSelectFirst={!isPhone}
          onOrdersChange={setOrders}
          unreadResetSignal={unreadResetSignal}
          showBusiness={showBusiness}
        />
      </div>
      {showPane && (
        <div className='odi-pane' data-pane='conversation'>
          {order
            ? (
              <>
                <ConversationHeader
                  order={order}
                  onOpenOrder={onOpenOrder}
                  onBack={paneOnPhone ? handleBack : undefined}
                  backRef={backRef}
                />
                {/* the order panel has its own chat: two controllers on one order would read and keep drafts twice. The draft stays in `drafts`. */}
                {!orderDetailOpen && (
                  <ConversationChat
                    key={order.id}
                    order={order}
                    readPolicy='interaction'
                    engaged={engaged}
                    initialDraft={drafts.get(order.id)}
                    onDraftChange={drafts.set}
                    handleUpdateOrderForUnreadCount={handleUpdateOrderForUnreadCount}
                  />
                )}
              </>
              )
            : (
              <EmptyState icon={MessageSquare} title={t('SELECT_A_CONVERSATION', 'Select a conversation')} />
              )}
        </div>
      )}
    </div>
  )
}
