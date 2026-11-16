import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useLanguage, useUtils, useSession, Messages as MessagesController } from '../../../../../index'
import { Avatar, Button, Dialog, EmptyState, IconButton, Skeleton } from '../../Shared/Product'
import { Ban, Check, ChevronDown, ChevronUp, Image as ImageIcon, MessageSquare, TriangleAlert, X } from '../../Shared/Icon'
import { TechnicalFacts, extractMapSrc, splitTechnicalBlock } from './ActivityTab'
import { useOrderMessages } from './OrderMessages'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CHAT_ENDED_STATUSES } from '../Messages/conversationScope'
import './activity-tab.css'
import './image-preview.css'
import { getQuickMessages } from '../Messages/quickMessages'

/**
 * Chat tab (batch 5.3): the order chat inside the panel, same controller as before
 * (`Messages`, GET/POST /orders/:id/messages, type 2 text, type 3 image, `can_see`, read marking)
 * with its own UIComponent: bubbles, recipients as toggles, quick messages and the composer in
 * product tokens. The events of the order (placed, status changes) stay inline as muted lines;
 * their technical facts are folded like in Activity (levels 0 and 2 only).
 */

// Statuses in which the order has ended and nobody can write any more (redesign messages: one list, shared with the /messages scope).
const ENDED_STATUSES = CHAT_ENDED_STATUSES

// The API catalog may bring a label in lowercase ("send"); a button label starts with a capital.
const capitalizeFirst = (text) => (typeof text === 'string' && text ? text.charAt(0).toUpperCase() + text.slice(1) : text)

// redesign messages B1 (B1-5): `can_see` arrives as an array ([0, 2, 4]) or as a string ("0,2,4"); always numbers.
const parseCanSee = (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
  .map(level => Number(level))
  .filter(level => Number.isFinite(level))

// redesign messages R1 (Q-01): the recipients of a draft are the chat's `canRead` object; two are the same when every key matches.
const RECIPIENT_KEYS = ['administrator', 'business', 'customer', 'driver']
const defaultRecipients = (hasDriver) => ({ administrator: true, business: true, customer: true, driver: !!hasDriver })
const sameRecipients = (a, b) => a === b || (!!a && !!b && RECIPIENT_KEYS.every(key => !!a[key] === !!b[key]))

const HtmlText = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />

const Fold = ({ label, children }) => (
  <details className='odc-feed-details'>
    <summary className='odc-feed-summary'>
      <ChevronDown className='odc-icon odc-feed-chevron' aria-hidden='true' />
      {label}
    </summary>
    <div className='odc-feed-detail-body'>{children}</div>
  </details>
)

const ChatSkeleton = () => {
  const [, t] = useLanguage()
  return (
    <div className='odt-chat-skeleton' aria-busy='true'>
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
      <Skeleton size='55%' />
      <Skeleton size='70%' align='end' />
      <Skeleton size='40%' />
      <Skeleton size='60%' align='end' />
    </div>
  )
}

const ChatPanelUI = (props) => {
  const {
    order,
    messages,
    message,
    image,
    canRead,
    sendMessage,
    handleSend,
    handleReadMessages,
    setMessage,
    setCanRead,
    setImage,
    getHistoryComment,
    isTourOpen,
    setCurrentTourStep,
    orderDetailClose,
    layout,
    initialDraft,
    onDraftChange
  } = props
  // redesign messages B1 (B1-3): outside the panel the chat fills its parent and the log is its own scroll area
  const standalone = layout === 'standalone'
  // redesign fix-qa E6: the panel keeps the chat mounted while another tab shows; `active` is whether it is
  // the one on screen (true when nobody says otherwise)
  const active = props.active !== false

  const [, t] = useLanguage()
  const [{ parseDate, optimizeImage }] = useUtils()
  const [{ user }] = useSession()
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const insertImageRef = useRef(null)
  const refocusInsertRef = useRef(false)
  const sendRef = useRef(null)
  const endRef = useRef(null)
  const rootRef = useRef(null)
  const hintId = useId()
  const quickGroupId = useId()
  const recipientsLabelId = useId()
  // redesign F6c (Q2-12): on a phone the quick replies are folded behind a button (the CSS only folds them below 768px)
  const [quickOpen, setQuickOpen] = useState(false)

  const [previewImage, setPreviewImage] = useState(null)
  // What a previewed image is called: its file name, or who sent it when the source has none (a data URL).
  const getImageAlt = (source, authorName) => {
    const fileName = typeof source === 'string' && !source.startsWith('data:')
      ? source.split(/[?#]/)[0].split('/').pop()
      : ''
    let decoded = fileName
    try { decoded = decodeURIComponent(fileName) } catch (e) {}
    if (/\.[a-z0-9]{2,5}$/i.test(decoded)) return decoded
    return authorName
      ? t('IMAGE_FROM_AUTHOR', 'Image from _author_').replace('_author_', () => authorName)
      : t('IMAGE', 'Image')
  }
  const [isChatDisabled, setIsChatDisabled] = useState(false)

  const ended = ENDED_STATUSES.includes(order?.status)
  const list = Array.isArray(messages?.messages) ? messages.messages : []

  // main 4b7ff4f9 + owner decision 2A: only the quick replies the project configured (admin set at level 0, store set at
  // level 2); one still on its placeholder text («admin_message_1») is hidden, so a project without any shows none.
  const quickMessages = getQuickMessages(user?.level, t)

  const getLevel = (level) => {
    switch (level) {
      case 0: return t('ADMIN', 'Admin')
      case 1: return t('CITY_MANAGER', 'City Manager')
      case 2: return t('BUSINESS', 'Business')
      case 3: return t('CUSTOMER', 'Customer')
      case 4: return t('DRIVER', 'Driver')
      case 5: return t('DRIVER_MANAGER', 'Driver Manager')
      default: return ''
    }
  }

  const authorName = (item) => item.author_id
    ? [item.author?.name, item.author?.lastname].filter(Boolean).join(' ')
    : t('AUTHOR_SYSTEM', 'System')

  // redesign messages B1 (B1-1, decision 4A): the read guard of /messages (W1-6, W1-D-14), ported. At most one read per
  // «orderId:messageId» while the request is on the way (a focus or a re-render does not repeat it; a failed one is asked again on
  // the next event), never a message id under another order, and the effect depends on the id of the last message.
  //  - `readRequestedRef` keeps «orderId:messageId» while the request is on the way and lets go of it when it ends;
  //  - `settledRef` says whose messages `messages` holds: the order that finished loading. On the render that follows a change of
  //    order the controller still holds the old messages (it empties them in its own effect, which runs after this one);
  //  - the last message is read whoever wrote it, as before (for a business account the read of the message just sent is what
  //    resets the unread count of the open card).
  const readRequestedRef = useRef(new Set())
  const lastId = list.length ? list[list.length - 1].id : undefined
  const settledRef = useRef({ orderId: messages.loading ? null : order?.id })
  const wasLoadingRef = useRef(messages.loading)
  useEffect(() => {
    if (messages.loading) settledRef.current = { orderId: null }
    else if (wasLoadingRef.current) settledRef.current = { orderId: order?.id }
    wasLoadingRef.current = messages.loading
  }, [messages.loading, order?.id])

  // redesign messages B1 (B1-2, decision 9A): with readPolicy='interaction' nothing is read until the host says `engaged` or the
  // user touches the chat (pointer, key, focus, wheel, composer). The engagement is kept per order id, so a new order starts
  // unengaged on the very render it appears. `active=false` is not used: it also stops the scroll to the end.
  const interactionOnly = props.readPolicy === 'interaction'
  const [touchedId, setTouchedId] = useState(null)
  const touchedRef = useRef(null)
  const isEngaged = () => !interactionOnly || props.engaged === true || (order?.id != null && touchedRef.current === order.id)
  const markTouched = () => {
    if (!interactionOnly || !order?.id || touchedRef.current === order.id) return
    touchedRef.current = order.id
    setTouchedId(order.id)
  }
  const engaged = !interactionOnly || props.engaged === true || (order?.id != null && touchedId === order.id)

  const unreadCount = Number(order?.unread_direct_count !== undefined ? order.unread_direct_count : order?.unread_count) || 0
  const unreadMessageControl = () => {
    if (!active || messages.loading || list.length === 0) return
    if (!order?.id || settledRef.current.orderId !== order.id) return
    if (!isEngaged()) return
    const last = list[list.length - 1]
    // redesign bugs-d row 54: a read last message still has to be marked when the order counts unread ones (same count as the badge)
    if (last.read && unreadCount === 0) return
    const key = `${order.id}:${last.id}`
    if (readRequestedRef.current.has(key)) return
    readRequestedRef.current.add(key)
    Promise.resolve(handleReadMessages(last.id)).finally(() => readRequestedRef.current.delete(key))
  }

  // redesign messages R1 (Q-01, decision 10A): the draft of a conversation also carries its recipients. `reportDraft` hands the host
  // the whole draft (`{ text, image, recipients }`, recipients being `canRead`) whenever one of the three differs from the last report.
  const reportedDraftRef = useRef({ text: '', image: null, recipients: null })
  const reportDraft = (draft) => {
    const last = reportedDraftRef.current
    if (!onDraftChange || !order?.id) return
    if (draft.text === last.text && draft.image === last.image && sameRecipients(draft.recipients, last.recipients)) return
    reportedDraftRef.current = draft
    onDraftChange(order.id, draft)
  }
  const reportRecipients = (recipients) => reportDraft({ text: message || '', image: image || null, recipients })

  // Who the next message goes to follows the order: the driver only exists once one is assigned.
  // redesign messages B1 (B1-4, decision 5A): it resets by order id, not by order object: a socket `update_order` hands a new
  // object of the same order, which must not put back a recipient the user removed.
  // redesign messages R1 (Q-01): a driver assigned later (false to true) only adds `driver: true`; it never resets the other keys.
  // Another order id (or the first mount) starts again from the defaults; the draft restored on mount is applied after this effect.
  const hasDriver = !!order?.driver
  const recipientsOrderRef = useRef(null)
  const recipientsDriverRef = useRef(false)
  useEffect(() => {
    const sameOrder = recipientsOrderRef.current === order?.id
    const driverAssigned = hasDriver && !recipientsDriverRef.current
    recipientsOrderRef.current = order?.id ?? null
    recipientsDriverRef.current = hasDriver
    if (!sameOrder) {
      setCanRead(defaultRecipients(hasDriver))
      return
    }
    if (driverAssigned) {
      const next = { ...canRead, driver: true }
      setCanRead(next)
      reportRecipients(next)
    }
  }, [order?.id, hasDriver])

  useEffect(() => {
    if (!order?.id || messages.loading) return
    unreadMessageControl()
  }, [order?.id, messages.loading, lastId, active, engaged, unreadCount > 0])

  useEffect(() => {
    if (user?.level !== 2) {
      setIsChatDisabled(!canRead?.business && !canRead?.customer && !canRead?.driver)
    } else {
      setIsChatDisabled(!canRead?.customer && !canRead?.driver)
    }
  }, [canRead])

  // redesign W0-2 r2 (W0-Q1-07): the box and the attachment are NOT cleared when the request starts: the controller
  // empties them once the API took the message, so a failed send keeps the draft and the same Send retries.

  // redesign F6d (Q3-05): to the very end of the panel's scroll area, after the layout (and once more a frame later, when the
  // sticky composer, the avatars and the fonts have their final height). `scrollIntoView` on the anchor alone stopped about
  // 31px short, with the last event under the composer. The anchor call stays for a panel with no scroll area of its own.
  const scrollToEnd = () => {
    const end = endRef.current
    if (!end) return
    // redesign messages B1 (B1-3): standalone, the area is the log itself; in the panel it is `.odc-od-body`, as before
    const own = standalone ? rootRef.current?.querySelector('[data-chat-scroll]') : null
    if (standalone) {
      if (own) own.scrollTop = own.scrollHeight - own.clientHeight
      return
    }
    const area = end.closest('.odc-od-body')
    if (area) area.scrollTop = area.scrollHeight - area.clientHeight
    else end.scrollIntoView?.({ block: 'end' })
  }
  useLayoutEffect(() => {
    if (!active) return undefined
    scrollToEnd()
    endRef.current?.scrollIntoView?.({ block: 'nearest' })
    const frame = window.requestAnimationFrame?.(scrollToEnd)
    return () => { if (frame) window.cancelAnimationFrame?.(frame) }
  }, [list.length, messages.loading, active, !!ended])

  // redesign messages B1 (B1-3, decision 10A): the host (/messages) keeps one draft per conversation. The initial one is restored
  // once on mount; every later change of the text or the image is reported with the order id, also the empty one after a send.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (initialDraft?.text) setMessage(initialDraft.text)
    if (initialDraft?.image) setImage(initialDraft.image)
    // redesign messages R1 (Q-01): after its own default reset (the effect above runs first), the recipients of the draft win
    if (initialDraft?.recipients) setCanRead({ ...defaultRecipients(hasDriver), ...initialDraft.recipients })
  }, [])
  useEffect(() => {
    const draft = { text: message || '', image: image || null, recipients: canRead ?? null }
    const last = reportedDraftRef.current
    if (draft.text === last.text && draft.image === last.image) return
    reportDraft(draft)
  }, [message, image])

  const handleChangeTour = (event) => {
    if (isTourOpen && !event.target.closest('.message-footer')) {
      orderDetailClose()
      setCurrentTourStep(4)
    }
  }

  const handleClickQuickMessage = (text) => {
    setMessage(message ? `${message} ${text}` : text)
    setQuickOpen(false)
    inputRef.current?.focus()
  }

  const onChangeImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setImage(reader.result)
      sendRef.current?.focus()
    }
  }

  // tanda P: «Remove» unmounts with the preview; the focus goes to «Insert image», which mounts again in its place (or
  // to the message box when the chat is disabled), instead of falling to the body.
  const onRemoveImage = () => {
    refocusInsertRef.current = true
    setImage(null)
  }

  useEffect(() => {
    if (image || !refocusInsertRef.current) return
    refocusInsertRef.current = false
    const target = insertImageRef.current && !insertImageRef.current.disabled ? insertImageRef.current : inputRef.current
    target?.focus()
  }, [image])

  // redesign messages B1 (B1-4, M-D5): with no recipient chosen the box stays editable (it used to turn read-only without a word)
  // and Send is off, described by the line under the chips
  const canSend = !sendMessage.loading && !messages.loading && !isChatDisabled && (message !== '' || !!image)

  const onSubmit = (event) => {
    event.preventDefault()
    if (!canSend) return
    handleSend()
    if (isTourOpen && setCurrentTourStep && orderDetailClose) {
      orderDetailClose()
      setCurrentTourStep(4)
    }
  }

  const recipientNames = (item) => {
    const seen = parseCanSee(item.can_see)
    return [
      seen.includes(2) && t('BUSINESS', 'Business'),
      seen.includes(3) && t('CUSTOMER', 'Customer'),
      seen.includes(4) && order?.driver && t('DRIVER', 'Driver')
    ].filter(Boolean)
  }

  // redesign messages B1 (B1-5): a message the customer does not see (`can_see` without 3) is an internal note, unless the customer
  // wrote it. Presentation only.
  const isInternalNote = (item) => !parseCanSee(item.can_see).includes(3) &&
    item.author_id !== order?.customer_id && item.author?.level !== 3

  // Absolute time, the same as in Activity (relative times made the two tabs disagree).
  const renderTime = (item) => (
    <span className='odc-mono'>{parseDate(item.created_at)}</span>
  )

  const renderPhoto = (source, author) => (
    <button
      type='button'
      className='odt-chat-thumb'
      aria-label={t('CLICK_TO_EXPAND', 'Click to expand')}
      title={t('CLICK_TO_EXPAND', 'Click to expand')}
      onClick={() => setPreviewImage({ source, alt: getImageAlt(source, author) })}
    >
      <img src={source} alt={t('IMAGE', 'Image')} loading='lazy' />
    </button>
  )

  const renderMessage = (item) => {
    if (item.type === 0) {
      return (
        <div key={item.id} className='odt-chat-msg' data-from='system'>
          {/* redesign F6c (Q2-28): the time of an order event is above it, as in Activity */}
          <div className='odt-chat-meta'>{renderTime(item)}</div>
          <div className='odt-chat-bubble'>
            <p className='odt-chat-text'>
              {t('ORDER_PLACED_FOR', 'Order placed for')} <strong>{parseDate(order.created_at)}</strong> {t('VIA', 'Via')}{' '}
              <strong>{order.app_id ? t(order.app_id.toUpperCase(), order.app_id) : t('OTHER', 'Other')}</strong>
            </p>
            {/* main shows these at any level for the placed event */}
            <Fold label={t('TECHNICAL_DETAILS', 'Technical details')}>
              <TechnicalFacts appId={item.app_id} author={authorName(item)} userAgent={item.user_agent} ip={item.ip} />
            </Fold>
          </div>
        </div>
      )
    }
    if (item.type === 1) {
      const comment = getHistoryComment(item)
      if (!comment) return null
      const { title, technical } = splitTechnicalBlock(comment)
      return (
        <div key={item.id} className='odt-chat-msg' data-from='system'>
          <div className='odt-chat-meta'>{renderTime(item)}</div>
          <div className='odt-chat-bubble'>
            <HtmlText html={title} />
            {item.source && renderPhoto(item.source, item.author?.name)}
            {technical && (
              <Fold label={t('TECHNICAL_DETAILS', 'Technical details')}>
                <TechnicalFacts appId={item.app_id} author={authorName(item)} userAgent={item.user_agent} ip={item.ip} mapSrc={extractMapSrc(technical)} />
              </Fold>
            )}
          </div>
        </div>
      )
    }
    if (item.type === 2 || item.type === 3) {
      const mine = user.id === item.author_id
      const names = recipientNames(item)
      const senderLevel = order.customer_id === item.author?.id ? getLevel(3) : getLevel(item.author?.level)
      const internal = isInternalNote(item)
      return (
        <div key={item.id} className='odt-chat-msg' data-from={mine ? 'me' : 'other'} data-note={internal ? 'internal' : undefined}>
          <div className='odt-chat-bubble'>
            {/* redesign messages R1 (Q-07): no name, the role alone */}
            <span className='odt-chat-sender'>{item.author?.name ? `${item.author.name} (${senderLevel})` : senderLevel}</span>
            {item.type === 3 && renderPhoto(item.source, item.author?.name)}
            {item.comment && <p className='odt-chat-text'>{item.comment}</p>}
          </div>
          <div className='odt-chat-meta'>
            {renderTime(item)}
            {internal && <> · {t('INTERNAL_NOTE', 'Internal note')}</>}
            {names.length > 0 && <> · {t('SEND_TO', 'Send to')}: {names.join(', ')}</>}
          </div>
        </div>
      )
    }
    return null
  }

  // redesign W0-2 r2 (W0-Q1-07): what the API said, translated as the rest of the quiet failures; Error when it said nothing
  // redesign W0-2 r3 (W0-P2-10): .flat() as /messages does, so a list of lists shows its lines
  const sendError = !sendMessage.loading && sendMessage.error
    ? [].concat(sendMessage.error).flat().map(text => translateApiMessage(t, text, '')).filter(Boolean).join(' ') || t('ERROR', 'Error')
    : null

  // redesign messages R1 (Q-07, M-D10): a person without a name is the role alone («Customer»), also as the accessible name.
  const withRole = (label, name) => (name ? `${label}: ${name}` : label)
  const recipients = [
    user?.level !== 2 && {
      key: 'business',
      kind: 'business',
      label: t('BUSINESS', 'Business'),
      name: order.business?.name,
      photo: optimizeImage(order.business?.logo, 'h_40,c_limit'),
      accessibleName: withRole(t('BUSINESS', 'Business'), order.business?.name)
    },
    {
      key: 'customer',
      kind: 'person',
      label: t('CUSTOMER', 'Customer'),
      name: [order.customer?.name, order.customer?.lastname].filter(Boolean).join(' '),
      photo: optimizeImage(order.customer?.photo, 'w_40,c_limit'),
      accessibleName: withRole(t('CUSTOMER', 'Customer'), [order.customer?.name, order.customer?.lastname].filter(Boolean).join(' '))
    },
    order?.driver && {
      key: 'driver',
      kind: 'person',
      label: t('DRIVER', 'Driver'),
      name: [order.driver?.name, order.driver?.lastname].filter(Boolean).join(' '),
      photo: optimizeImage(order.driver?.photo, 'w_40,c_limit'),
      accessibleName: withRole(t('DRIVER', 'Driver'), [order.driver?.name, order.driver?.lastname].filter(Boolean).join(' '))
    }
  ].filter(Boolean)

  return (
    <div
      ref={rootRef}
      className='odc-root odt-chat'
      data-layout={standalone ? 'standalone' : undefined}
      data-tour='tour_message'
      data-chat-root=''
      tabIndex={-1}
      onClick={handleChangeTour}
      onPointerDown={markTouched}
      onKeyDown={markTouched}
      onFocus={markTouched}
      onWheel={markTouched}
    >
      {messages.loading
        ? <ChatSkeleton />
        : messages.error
          ? (
            <EmptyState
              tone='error'
              icon={TriangleAlert}
              title={t('CHAT_LOAD_ERROR', 'Couldn\'t load the messages')}
              description={t('ACTIVITY_LOAD_ERROR_HINT', 'Close the panel and open the order again to retry.')}
            />
            )
          : list.length === 0
            ? <EmptyState icon={MessageSquare} title={t('NO_MESSAGES_YET', 'No messages yet')} />
            : (
              <div className='odt-chat-log' role='log' aria-live='polite' aria-label={t('MESSAGES', 'Messages')} data-chat-scroll={standalone ? '' : undefined}>
                {list.map(renderMessage)}
              </div>
              )}

      <div className='odt-chat-composer message-footer'>
        {ended
          ? (
            <p className='odt-chat-ended'>
              <Ban className='odc-icon' />
              {t('NOT_SEND_MESSAGES', 'You can\'t send messages because the order has ended')}
            </p>
            )
          : (
            <>
              <div className='odt-chat-recipients' role='group' aria-labelledby={recipientsLabelId}>
                {/* redesign messages R1 (Q-06, decision 5A): the group's label is visible text, before the chips */}
                <span id={recipientsLabelId} className='odt-chat-recipients-label'>{t('SEND_TO', 'Send to')}</span>
                {recipients.map(recipient => (
                  <button
                    key={recipient.key}
                    type='button'
                    className='odt-chat-chip'
                    aria-pressed={!!canRead?.[recipient.key]}
                    aria-label={recipient.accessibleName}
                    onClick={() => {
                      const next = { ...canRead, [recipient.key]: !canRead?.[recipient.key] }
                      setCanRead(next)
                      reportRecipients(next)
                    }}
                  >
                    {/* redesign messages B1 (B1-4, decision 5A): the state is drawn inside the chip, not only in its colour */}
                    <span className='odt-chat-chip-check' data-chip-check='' data-checked={canRead?.[recipient.key] ? 'true' : 'false'} aria-hidden='true'>
                      {canRead?.[recipient.key] && <Check className='odc-icon' />}
                    </span>
                    <Avatar kind={recipient.kind} name={recipient.name} src={recipient.photo} />
                    <span className='odt-chat-chip-name'>
                      {recipient.name && <span>{recipient.name}</span>}
                      <span className='odt-chat-chip-role'>{recipient.label}</span>
                    </span>
                  </button>
                ))}
              </div>
              {isChatDisabled && (
                <p id={hintId} className='odt-chat-recipient-hint' role='status'>
                  {t('CHOOSE_AT_LEAST_ONE_RECIPIENT', 'Choose at least one recipient to send.')}
                </p>
              )}

              {quickMessages.length > 0 && (
                <Button
                  size='sm'
                  className='odt-chat-quick-toggle'
                  iconEnd={quickOpen ? ChevronUp : ChevronDown}
                  aria-expanded={quickOpen}
                  aria-controls={quickGroupId}
                  onClick={() => setQuickOpen(open => !open)}
                >
                  {t('QUICK_REPLIES', 'Quick replies')}
                </Button>
              )}

              {quickMessages.length > 0 && (
                <div
                  id={quickGroupId}
                  className='odt-chat-quick'
                  data-open={quickOpen ? '' : undefined}
                  role='group'
                  aria-label={t('QUICK_MESSAGES', 'Quick messages')}
                >
                  {quickMessages.map(quick => (
                    <Button key={quick.key} size='sm' onClick={() => handleClickQuickMessage(quick.text)}>
                      {quick.text}
                    </Button>
                  ))}
                </div>
              )}

              {sendError && (
                <p className='odt-chat-alert' role='alert'>
                  <TriangleAlert className='odc-icon' />
                  {sendError}
                </p>
              )}

              {image && (
                <div className='odt-chat-attachment'>
                  <img src={image} alt={t('IMAGE', 'Image')} />
                  <IconButton icon={X} size='sm' label={t('REMOVE', 'Remove')} onClick={onRemoveImage} />
                </div>
              )}

              <form className='odt-chat-row' onSubmit={onSubmit} noValidate>
                <input
                  ref={inputRef}
                  className='odt-chat-input'
                  type='text'
                  name='message'
                  data-chat-composer=''
                  value={message}
                  placeholder={t('WRITE_A_MESSAGE', 'Write a message...')}
                  aria-label={t('WRITE_A_MESSAGE', 'Write a message...')}
                  autoComplete='off'
                  onChange={event => setMessage(event.target.value)}
                  onFocus={() => { markTouched(); unreadMessageControl() }}
                />
                {!image && (
                  <>
                    <input
                      ref={fileRef}
                      className='odt-chat-file'
                      type='file'
                      name='image'
                      accept='image/png,image/jpg,image/jpeg'
                      tabIndex={-1}
                      aria-hidden='true'
                      disabled={isChatDisabled}
                      onChange={onChangeImage}
                    />
                    <IconButton
                      ref={insertImageRef}
                      icon={ImageIcon}
                      label={t('INSERT_IMAGE', 'Insert image')}
                      disabled={isChatDisabled}
                      onClick={() => fileRef.current?.click()}
                    />
                  </>
                )}
                <Button
                  ref={sendRef}
                  type='submit'
                  variant='primary'
                  busy={!!sendMessage.loading}
                  disabled={!canSend && !sendMessage.loading}
                  aria-describedby={isChatDisabled ? hintId : undefined}
                >
                  {sendMessage.loading ? t('SENDING_MESSAGE', 'Sending...') : capitalizeFirst(t('SEND', 'Send'))}
                </Button>
              </form>
            </>
            )}
      </div>
      {/* redesign F6c (Q2-12): the scroll anchor is after the sticky composer, so the last event ends above it, never under it */}
      <div ref={endRef} data-chat-end='' />

      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => { if (!open) setPreviewImage(null) }}
        title={t('IMAGE_PREVIEW', 'Image preview')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        className='odc-image-dialog'
      >
        {previewImage && (
          <div className='odt-chat-preview'>
            <img src={previewImage.source} alt={previewImage.alt} />
            <a href={previewImage.source} target='_blank' rel='noopener noreferrer'>
              {t('OPEN_ORIGINAL_IMAGE', 'Open original image')}
            </a>
          </div>
        )}
      </Dialog>
    </div>
  )
}

export const ChatTab = (props) => {
  const order = props.order?.order
  const sharedMessages = useOrderMessages()
  if (!order?.id) return null
  // The panel's one Messages controller (OrderMessages): the chat, the route and the history share the list, the
  // draft and the socket room. On its own the tab runs its own controller.
  if (sharedMessages) {
    return (
      <ChatPanelUI
        {...sharedMessages}
        order={order}
        isTourOpen={props.isTourOpen}
        setCurrentTourStep={props.setCurrentTourStep}
        active={props.active}
        readPolicy={props.readPolicy}
        engaged={props.engaged}
        orderDetailClose={() => props.onClose()}
      />
    )
  }
  return (
    <MessagesController
      orderId={order.id}
      order={order}
      asDashboard
      UIComponent={ChatPanelUI}
      handleUpdateOrderForUnreadCount={props.handleUpdateOrderForUnreadCount}
      messages={props.messages}
      isTourOpen={props.isTourOpen}
      setCurrentTourStep={props.setCurrentTourStep}
      active={props.active}
      readPolicy={props.readPolicy}
      engaged={props.engaged}
      orderDetailClose={() => props.onClose()}
    />
  )
}

/**
 * redesign messages B1 (B1-3, decision 4A): the panel's chat mounted on its own, for /messages. It runs its own controller for a
 * plain order (not `{ order }`) and fills its parent: the log scrolls and the composer sits below it. The host mounts one per
 * order (`key={order.id}`) and keeps the drafts through `initialDraft` / `onDraftChange`.
 */
export const ConversationChat = ({ order, readPolicy, engaged, handleUpdateOrderForUnreadCount, initialDraft, onDraftChange }) => {
  if (!order?.id) return null
  return (
    <MessagesController
      orderId={order.id}
      order={order}
      asDashboard
      UIComponent={ChatPanelUI}
      handleUpdateOrderForUnreadCount={handleUpdateOrderForUnreadCount}
      layout='standalone'
      readPolicy={readPolicy}
      engaged={engaged}
      initialDraft={initialDraft}
      onDraftChange={onDraftChange}
    />
  )
}
