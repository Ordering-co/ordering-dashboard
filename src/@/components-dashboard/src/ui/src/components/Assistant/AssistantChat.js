import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Lock, WifiOff } from 'react-bootstrap-icons'
import { useLanguage, useAssistant } from '../../../../index'
import { AssistantNotice } from './AssistantNotice'
import { AssistantMessages } from './AssistantMessages'
import { AssistantComposer } from './AssistantComposer'
import { getAssistantPageContext, withPageEntities } from './pageContext'
import { URL_CHANGE_EVENT } from '../../utils'
import { ActionButton, Body, Callout, Centered, Spinner, Suggestion, ToolLine } from './styles'

export const ASSISTANT_ROUTE = '/assistant'

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

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    send(text)
  }

  useEffect(() => {
    if (status.noticeAccepted) inputRef.current?.focus()
  }, [status.noticeAccepted])

  if (!status.loaded) {
    return (
      <Body page={page}>
        <Centered>
          <ToolLine role='status'><Spinner aria-hidden />{t('LOADING', 'Loading')}</ToolLine>
        </Centered>
      </Body>
    )
  }

  if (status.error === 'no_permission') {
    return (
      <Body page={page}>
        <Centered>
          <Callout tone='danger' role='alert'>
            <div className='title'><Lock size={15} aria-hidden />{t('ASSISTANT_NO_PERMISSION_TITLE', 'No permission')}</div>
            <div>{t('ASSISTANT_NO_PERMISSION_TEXT', 'Your user can\'t use the assistant in this project.')}</div>
          </Callout>
        </Centered>
      </Body>
    )
  }

  if (status.error || !status.enabled) {
    return (
      <Body page={page}>
        <Centered>
          <Callout tone='danger' role='alert'>
            <div className='title'><WifiOff size={15} aria-hidden />{t('ASSISTANT_UNAVAILABLE_TITLE', 'Ordering couldn\'t connect')}</div>
            <div>{t('ASSISTANT_UNAVAILABLE_TEXT', 'The assistant isn\'t available right now. Try again in a few minutes.')}</div>
            <ActionButton type='button' small onClick={() => loadStatus()}>{t('ASSISTANT_RETRY', 'Try again')}</ActionButton>
          </Callout>
        </Centered>
      </Body>
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

  return (
    <>
      <Body page={page} ref={scroll.ref} onScroll={scroll.onScroll}>
        {loadingConversation && (
          <ToolLine role='status'><Spinner aria-hidden />{t('LOADING', 'Loading')}</ToolLine>
        )}
        {!loadingConversation && items.length === 0 && (
          <Centered>
            <h3>{t('ASSISTANT_EMPTY_TITLE', 'How can I help?')}</h3>
            <p>{t('ASSISTANT_EMPTY_TEXT', 'Ask about your orders, sales and catalog, or ask for a change.')}</p>
            {suggestions.map(suggestion => (
              <Suggestion key={suggestion} type='button' disabled={isLimited} onClick={() => send(suggestion)}>{suggestion}</Suggestion>
            ))}
          </Centered>
        )}
        {items.length > 0 && (
          <AssistantMessages
            onProposeAgain={isLimited ? null : () => send(t('ASSISTANT_PROPOSE_AGAIN_MESSAGE', 'Please propose that change again.'))}
          />
        )}
      </Body>
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
