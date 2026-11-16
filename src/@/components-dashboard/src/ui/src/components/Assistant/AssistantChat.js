import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useAssistant } from '../../../../index'
import { Button, EmptyState, Skeleton } from '../Shared/Product'
import { LockKeyhole, WifiOff } from '../Shared/Icon'
import { AssistantNotice } from './AssistantNotice'
import { AssistantMessages } from './AssistantMessages'
import { AssistantComposer } from './AssistantComposer'
import { getAssistantPageContext, withPageEntities } from './pageContext'
import { URL_CHANGE_EVENT } from '../../utils'
import './assistant.css'

import { ASSISTANT_ROUTE } from './route'

export { ASSISTANT_ROUTE }

/** Stick to the bottom while the user is there; leave them alone when they scroll up */
const useStickToBottom = (deps) => {
  const ref = useRef(null)
  const stick = useRef(true)

  const onScroll = () => {
    const element = ref.current
    if (!element) return
    stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
  }

  useLayoutEffect(() => {
    const element = ref.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  }, deps)

  return { ref, onScroll }
}

/** Three lines in the shape of a message, announced once for screen readers (the lines are decorative) */
const LoadingLines = ({ t }) => (
  <div className='odc-as-loading' role='status'>
    <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
    <Skeleton size='60%' />
    <Skeleton />
    <Skeleton size='80%' />
  </div>
)

const readBrowserLocation = () => ({ pathname: window.location.pathname, search: window.location.search })

/**
 * The browser URL. Lateral panels write `?id=` with history.replaceState
 * (addQueryToUrl), which react-router does not see, so it also listens to
 * the event those helpers fire.
 */
const useBrowserLocation = () => {
  const routerLocation = useLocation()
  const [browserLocation, setBrowserLocation] = useState(readBrowserLocation)

  useEffect(() => {
    const update = () => setBrowserLocation(prev => {
      const next = readBrowserLocation()
      return prev.pathname === next.pathname && prev.search === next.search ? prev : next
    })
    update()
    window.addEventListener(URL_CHANGE_EVENT, update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, update)
      window.removeEventListener('popstate', update)
    }
  }, [routerLocation.pathname, routerLocation.search])

  return browserLocation
}

const getContextFor = (location, pageEntities) => (
  location.pathname === ASSISTANT_ROUTE
    // The page itself says nothing about what the user is working on
    ? { context: null, refs: [] }
    : withPageEntities(getAssistantPageContext(location), pageEntities)
)

/**
 * The assistant conversation, shared by the side panel and the /assistant
 * page: the notice first, then the messages and the composer
 */
export const AssistantChat = ({ page }) => {
  const [, t] = useLanguage()
  const location = useBrowserLocation()
  const assistant = useAssistant()
  const { status, items, actions, loadingConversation, sendMessage, loadStatus, pageEntities } = assistant

  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const scroll = useStickToBottom([items, actions])

  const { refs } = getContextFor(location, pageEntities)
  // The composer is locked then; suggestions and "Propose again" would only get a 429
  const isLimited = !!status.usage?.limited

  const send = async (text) => {
    if (isLimited) return
    // Read the URL again: it may have changed without an event
    const { context } = getContextFor(readBrowserLocation(), pageEntities)
    const result = await sendMessage(text, context)
    if (result && !result.sent) setDraft(prev => prev || text)
  }

  // (review): after a suggestion or «Propose again» the control goes away and the composer keeps the focus (R1-2); on a touch
  // screen focusing a text field opens the keyboard over the answer, so there the conversation takes it (settings decision 7, the same
  // rule as SettingsList: never a text control on a phone).
  const keepFocusAfterSend = () => {
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    const log = scroll.ref.current
    if (!coarse || !log) {
      inputRef.current?.focus()
      return
    }
    if (!log.hasAttribute('tabindex')) log.setAttribute('tabindex', '-1')
    log.focus({ preventScroll: true })
  }

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    send(text)
  }

  // redesign R1-3: the page takes the composer as soon as the chat is ready (as in main); the panel only when the user
  // accepts the notice in it (opening the panel moves the focus on its own), never because its status loaded
  const lastStatus = useRef({ loaded: status.loaded, noticeAccepted: status.noticeAccepted })
  useEffect(() => {
    const previous = lastStatus.current
    lastStatus.current = { loaded: status.loaded, noticeAccepted: status.noticeAccepted }
    if (!status.noticeAccepted) return
    const acceptedNow = previous.loaded && !previous.noticeAccepted
    if (page || acceptedNow) inputRef.current?.focus()
  }, [status.noticeAccepted, status.loaded])

  // redesign AS-B (D3, M-AS7): the states of the chat are Product's skeleton and empty states
  const dataPage = page ? '' : undefined

  if (!status.loaded) {
    return (
      <div className='odc-root odc-as-body' data-page={dataPage}>
        <div className='odc-as-center'><LoadingLines t={t} /></div>
      </div>
    )
  }

  if (status.error === 'no_permission') {
    return (
      <div className='odc-root odc-as-body' data-page={dataPage}>
        <EmptyState
          tone='error'
          icon={LockKeyhole}
          title={t('ASSISTANT_NO_PERMISSION_TITLE', 'No permission')}
          description={t('ASSISTANT_NO_PERMISSION_TEXT', 'Your user can\'t use the assistant in this project.')}
        />
      </div>
    )
  }

  if (status.error || !status.enabled) {
    return (
      <div className='odc-root odc-as-body' data-page={dataPage}>
        <EmptyState
          tone='error'
          icon={WifiOff}
          title={t('ASSISTANT_UNAVAILABLE_TITLE', 'Ordering couldn\'t connect')}
          description={t('ASSISTANT_UNAVAILABLE_TEXT', 'The assistant isn\'t available right now. Try again in a few minutes.')}
          action={<Button onClick={() => loadStatus()}>{t('ASSISTANT_RETRY', 'Try again')}</Button>}
        />
      </div>
    )
  }

  if (!status.noticeAccepted) {
    return <AssistantNotice page={page} />
  }

  const suggestions = [
    t('ASSISTANT_SUGGESTION_SALES', 'How much did each store sell yesterday?'),
    t('ASSISTANT_SUGGESTION_PENDING', 'Which orders are still pending right now?'),
    t('ASSISTANT_SUGGESTION_DISABLED', 'Which products are disabled?')
  ]
  // The title of the page is the h1 and the one of the panel an h2, so the empty state goes one level under
  const Heading = page ? 'h2' : 'h3'

  return (
    <>
      <div className='odc-root odc-as-body' data-page={dataPage} ref={scroll.ref} onScroll={scroll.onScroll}>
        {loadingConversation && <LoadingLines t={t} />}
        {!loadingConversation && items.length === 0 && (
          <div className='odc-as-center'>
            <Heading className='odc-as-heading'>{t('ASSISTANT_EMPTY_TITLE', 'How can I help?')}</Heading>
            <p className='odc-as-lead'>{t('ASSISTANT_EMPTY_TEXT', 'Ask about your orders, sales and catalog, or ask for a change.')}</p>
            <div className='odc-as-suggestions'>
              {suggestions.map(suggestion => (
                <Button key={suggestion} className='odc-as-suggestion' disabled={isLimited} onClick={() => {
                  send(suggestion)
                  // redesign R1-2: the suggestions go away once sent; the composer keeps the focus
                  keepFocusAfterSend()
                }}>{suggestion}</Button>
              ))}
            </div>
          </div>
        )}
        {items.length > 0 && (
          <AssistantMessages
            onProposeAgain={isLimited
              ? null
              : () => {
                  send(t('ASSISTANT_PROPOSE_AGAIN_MESSAGE', 'Please propose that change again.'))
                  // redesign R1-2: «Propose again» goes away while the answer streams; the composer keeps the focus
                  keepFocusAfterSend()
                }}
          />
        )}
      </div>
      <AssistantComposer
        page={page}
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        refs={refs}
        inputRef={inputRef}
      />
    </>
  )
}
