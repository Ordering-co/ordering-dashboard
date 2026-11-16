import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useUtils, useLanguage, useSession, Messages as MessagesController, useConfig } from '../../../../../index'
import { useForm, Controller } from 'react-hook-form'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { addQueryToUrl } from '../../../utils'
import { buildOrderPlacedForViaHtml, getOrderPlacedViaCopy } from './orderPlacedHistory'
import { getQuickMessages } from './quickMessages'

import {
  MessagesContainer,
  WrapperContainer,
  HeaderProfile,
  WrapperHeader,
  ImageContainer,
  Chat,
  BubbleCustomer,
  MessageCustomer,
  MessageBusiness,
  BubbleBusines,
  SkeletonBubbleCustomer,
  SkeletonBubbleBusiness,
  ChatImage,
  TimeofSent,
  SendForm,
  Send,
  WrapperSendInput,
  SendImage,
  MessageConsole,
  BubbleConsole,
  WrapperDeleteImage,
  WrapperSendMessageButton,
  OrderNumber,
  WrapperHitoryHeader,
  TabItem,
  SkeletonHitory,
  WrapperLogistics,
  WrapperLogisticInformation,
  HeaderInfo,
  SearchAndDetailControlContainer,
  MessagesSearch,
  OrderDetailIconButton,
  ChatHeader,
  ChatContactInfoContainer,
  InfoBlock,
  SendToContainer,
  MessageSender,
  QuickMessageWrapper,
  NotSendMessage
} from './styles'
import { Image as ImageWithFallback } from '../../Shared'
import { Button, Dialog, IconButton, TextField, Tooltip } from '../../Shared/Product'
import { AlertDialog } from '../../Shared/Product/AlertDialog'
import '../OrderDetails/image-preview.css'
// redesign W1-6 (T1-6-4a): the glyphs are Lucide, by Shared/Icon, in place of the @meronex/icons ones. The attach, driver and customer
// glyphs keep the size the CSS gives them (size='1em' follows font-size / width / height as the old SVGs did).
import { Ban, Image as ImageIcon, Info, Store, User, UserRound, Send as SendIcon, X } from '../../Shared/Icon'
import { Logistics } from '../Logistics'
import { OrderLogisticInformation } from '../OrderLogisticInformation'

// redesign W1-6 (T1-6-4a): Lucide Send (main's paper plane); in RTL the glyph flips with the page (odc-icon-flip, product.css)
const SendGlyph = () => <SendIcon className='odc-icon odc-icon-flip' />

export const MessagesUI = (props) => {
  const {
    isChat,
    order,
    messages,
    handleSend,
    image,
    message,
    sendMessage,
    setImage,
    setMessage,
    canRead,
    setCanRead,
    history,
    messageDashboardView,
    handleMessageOrderDetail,
    handleReadMessages,
    isTourOpen,
    setCurrentTourStep,
    orderDetailClose,
    getHistoryComment
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const theme = useTheme()
  const { handleSubmit, setValue, errors, control } = useForm()
  const [{ user }] = useSession()
  const [{ parseDate, getTimeAgo, optimizeImage }] = useUtils()
  const orderPlacedViaCopy = getOrderPlacedViaCopy(order?.app_id)
  const buttonRef = useRef(null)
  const messageInputRef = useRef(null)

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [tabActive, setTabActive] = useState('order_history')
  const [messageSearchValue, setMessageSearchValue] = useState('')
  const [filteredMessages, setFilteredMessages] = useState([])
  const [load, setLoad] = useState(0)
  const [messageList, setMessageList] = useState([])
  const [isChatDisabled, setIsChatDisabled] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  // What the previewed image is called: its file name, or who sent it when the source has none (a data URL).
  const getImageAlt = (source) => {
    const fileName = typeof source === 'string' && !source.startsWith('data:')
      ? source.split(/[?#]/)[0].split('/').pop()
      : ''
    let decoded = fileName
    try { decoded = decodeURIComponent(fileName) } catch (e) {}
    if (/\.[a-z0-9]{2,5}$/i.test(decoded)) return decoded
    const author = messages?.messages?.find(item => item.source === source)?.author?.name
    return author
      ? t('IMAGE_FROM_AUTHOR', 'Image from _author_').replace('_author_', () => author)
      : t('IMAGE', 'Image')
  }
  const previousStatus = [1, 2, 5, 6, 10, 11, 12, 15, 16, 17]
  const chatDisabled = previousStatus.includes(order?.status)
  const [{ configs }] = useConfig()
  const showExternalId = configs?.change_order_id?.value === '1'

  const handleClickQuickMessage = (msg) => {
    const quickMsg = message ? `${message} ${msg}` : msg
    setValue('message', quickMsg)
    setMessage(quickMsg)
    const msgElement = messageInputRef?.current
    if (msgElement) {
      msgElement.value = quickMsg
      msgElement.focus()
      msgElement.selectionStart = msgElement.selectionEnd = msgElement.value.length
      msgElement.scrollLeft = msgElement.scrollWidth
    }
  }

  useEffect(() => {
    // main 4b7ff4f9 + owner decision 2A: only the quick replies the project configured
    setMessageList(getQuickMessages(user?.level, t))
  }, [user])

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map(error => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    setMessageSearchValue('')
  }, [order.id])

  // redesign W0-2 r3 (W0-P2-02): as in main, the box empties when the request STARTS (the controller empties the text
  // and the attachment; the form follows). If the send fails, the controller gives the sent draft back only when the
  // box is still empty, and when it ends the form takes what the controller kept (a draft typed meanwhile stays).
  const wasSendingRef = useRef(false)
  useEffect(() => {
    if (sendMessage.loading) {
      wasSendingRef.current = true
      setValue('message', '')
      return
    }
    if (sendMessage?.error) {
      // the lines of text the API (or the network) left; the generic Error when it left none
      const lines = [].concat(sendMessage.error).flat().filter(line => typeof line === 'string' && line.trim())
      setAlertState({
        open: true,
        content: lines.length ? lines : [t('ERROR', 'Error')]
      })
    }
    if (wasSendingRef.current) {
      wasSendingRef.current = false
      setValue('message', message || '')
      // redesign W1-6 (T1-6-4a, M-15): «Send» disables itself when the box empties and the focus falls to <body>. After a good send
      // the box takes it back, unless the user already moved it to another control. (A failed send returns it through the Error dialog.)
      if (!sendMessage?.error) {
        const active = document.activeElement
        if (!active || active === document.body || active === buttonRef.current) messageInputRef.current?.focus()
      }
    }
  }, [sendMessage])

  // redesign W1-6 (T1-6-4a, W1-D-19): the count of loaded images starts again in each conversation, so the images of the next one
  // still take the scroll to the bottom (no key per order: the draft passes to the other conversation, as in main, W0-P2-09).
  useEffect(() => {
    setLoad(0)
  }, [order?.id])

  useEffect(() => {
    if (history) return
    if (load < 3) {
      const chat = document.getElementById('chat')
      if (chat) {
        chat.scrollTop = chat?.scrollHeight
      }
    }
  }, [load])

  useEffect(() => {
    if (history) return
    const chat = document.getElementById('chat')
    if (chat) {
      chat.scrollTop = chat?.scrollHeight
    }
  }, [messages.messages.length, filteredMessages])

  useEffect(() => {
    if (history) return
    setTimeout(() => {
      const chat = document.getElementById('chat')
      if (chat) {
        chat.scrollTop = chat?.scrollHeight
      }
    }, 10)
  }, [isChat])

  const onChangeMessage = (e) => {
    setMessage(e.target.value)
  }

  const removeImage = (e) => {
    setImage(null)
  }

  const onChangeImage = e => {
    const files = e.target.files?.[0]
    if (!files) return
    const reader = new window.FileReader()
    reader.readAsDataURL(files)
    reader.onload = () => {
      setImage(reader.result)
      buttonRef.current.focus()
    }
  }

  const getLevel = (level) => {
    switch (level) {
      case 0:
        return t('ADMIN', 'Admin')
      case 1:
        return t('CITY_MANAGER', 'City Manager')
      case 2:
        return t('BUSINESS', 'Business')
      case 3:
        return t('CUSTOMER', 'Customer')
      case 4:
        return t('DRIVER', 'Driver')
      case 5:
        return t('DRIVER_MANAGER', 'Driver Manager')
    }
  }

  const onSubmit = (values) => {
    // redesign W0-2 r2 (W0-Q1-07): a second Send (Enter) while one is on the way must not send twice
    if (sendMessage.loading) return
    handleSend()
    if (isTourOpen && setCurrentTourStep && orderDetailClose) {
      orderDetailClose()
      setCurrentTourStep(4)
    }
  }

  const handleChangeTour = (evt) => {
    if (isTourOpen && !evt.target.closest('.message-footer')) {
      orderDetailClose()
      setCurrentTourStep(4)
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // redesign W1-6 (T1-6-4a, W1-D-14): at most one GET …/read per event. Main keeps its meaning (the conversation on view and the
  // messages that others write in it are read) but the request is asked once:
  //  - `readRequestedRef` keeps «orderId:messageId» while the request is on the way (a focus or a re-render does not repeat it) and
  //    lets go of it when it ends, so a read that failed is asked again on the next event; one that went well left `read` on the message;
  //  - `settledRef` says whose messages `messages` holds: the order that finished loading. On the render that follows a change of
  //    order the controller still holds the old messages (it empties them in its own effect, which runs after this one): asking then
  //    would read the old message id under the new order;
  //  - redesign W1-6 (W1-PB1-01): the last message is marked read whoever wrote it, as in main: for a business account (level 2) the
  //    read of the message just sent is what makes the controller reset the unread count of the open card. Only the duplicates
  //    (same «orderId:messageId») and the request under the wrong order are dropped.
  const readRequestedRef = useRef(new Set())
  const lastLoaded = messages.messages[messages.messages.length - 1]
  const settledRef = useRef({ orderId: messages.loading ? null : order?.id })
  const wasLoadingRef = useRef(messages.loading)
  useEffect(() => {
    if (messages.loading) settledRef.current = { orderId: null }
    else if (wasLoadingRef.current) settledRef.current = { orderId: order?.id }
    wasLoadingRef.current = messages.loading
  }, [messages.loading, order?.id])

  const unreadMessageControl = () => {
    if (messages.loading || messages.messages.length === 0) return
    if (!order?.id || settledRef.current.orderId !== order.id) return
    const last = messages.messages[messages.messages.length - 1]
    if (last.read) return
    const key = `${order.id}:${last.id}`
    if (readRequestedRef.current.has(key)) return
    readRequestedRef.current.add(key)
    Promise.resolve(handleReadMessages(last.id)).finally(() => readRequestedRef.current.delete(key))
  }

  useEffect(() => {
    if (!isChat) return
    if (order?.driver) {
      setCanRead({ administrator: true, business: true, customer: true, driver: true })
    } else {
      setCanRead({ administrator: true, business: true, customer: true, driver: false })
    }
  }, [isChat, order])

  // redesign W1-6 (T1-6-4a, W1-D-14): it depends on the id of the last message, not on the `messages` object (that changed with every
  // incoming message, read mark and send, and asked again each time).
  useEffect(() => {
    if (!isChat || !order?.id || messages.loading) return
    unreadMessageControl()
  }, [isChat, order?.id, messages.loading, lastLoaded?.id])

  useEffect(() => {
    if (messages.loading) return
    const _filteredMessages = messages.messages.filter(message => {
      if (message.type === 2) {
        return message?.comment?.toLocaleLowerCase()?.includes(messageSearchValue?.toLocaleLowerCase())
      }
      return true
    })

    setFilteredMessages(_filteredMessages)
  }, [messages, messageSearchValue])

  useEffect(() => {
    if (user?.level !== 2) {
      if (!canRead?.business && !canRead?.customer && !canRead?.driver) setIsChatDisabled(true)
      else setIsChatDisabled(false)
    } else {
      if (!canRead?.customer && !canRead?.driver) setIsChatDisabled(true)
      else setIsChatDisabled(false)
    }
  }, [canRead])

  const handleTabClick = (tab, isInitialRender) => {
    setTabActive(tab)
    if (!isInitialRender) {
      addQueryToUrl({
        tab
      })
    }
  }

  useEffect(() => {
    if (!history) return
    const tab = query.get('tab')
    if (tab) {
      handleTabClick(tab, true)
    } else {
      handleTabClick('order_history')
    }
  }, [history])

  return (
    <MessagesContainer>
      <WrapperContainer onClick={handleChangeTour}>
        <HeaderProfile>
          <WrapperHeader
            messageDashboardView={messageDashboardView}
            historyView={history}
          >
            <HeaderInfo>
              {isChat && (
                <ChatHeader>
                  <OrderNumber>
                    {t('INVOICE_ORDER_NO', 'Order number')} <span className='order-identifier'>{(showExternalId && !!order?.external_id) ? order.external_id : order.id}</span>
                  </OrderNumber>
                  <ImageContainer>
                    {user?.level !== 2 && (
                      <ImageWithFallback
                        src={optimizeImage(order.business?.logo, 'h_40,c_limit')}
                        fallback={<Store size='1em' />}
                      />
                    )}
                    <ImageWithFallback
                      src={optimizeImage(order.customer?.photo, 'w_40,c_limit')}
                      fallback={<User size='1em' />}
                    />
                    {order?.driver && (
                      <ImageWithFallback
                        src={optimizeImage(order.driver?.photo, 'w_40,c_limit')}
                        fallback={<UserRound size='1em' />}
                      />
                    )}
                  </ImageContainer>
                </ChatHeader>
              )}
              {history && (
                <WrapperHitoryHeader>
                  <TabItem active={tabActive === 'order_history'} aria-pressed={tabActive === 'order_history'} onClick={() => handleTabClick('order_history')}>
                    {t('MOBILE_ORDER_HISTORY', 'Order History')}
                  </TabItem>
                  <TabItem active={tabActive === 'logistics'} aria-pressed={tabActive === 'logistics'} onClick={() => handleTabClick('logistics')}>
                    {t('LOGISTICS', 'Logistics')}
                  </TabItem>
                  <TabItem active={tabActive === 'logistic_information'} aria-pressed={tabActive === 'logistic_information'} onClick={() => handleTabClick('logistic_information')}>
                    {t('LOGISTIC_INFORMATION', 'Logistics information')}
                  </TabItem>
                </WrapperHitoryHeader>
              )}
            </HeaderInfo>
            {messageDashboardView && (
              <SearchAndDetailControlContainer>
                <MessagesSearch>
                  <img src={theme?.images?.icons?.search} alt='' />
                  <input
                    type='text'
                    name='search'
                    placeholder={t('SEARCH', 'Search')}
                    aria-label={t('SEARCH', 'Search')}
                    value={messageSearchValue}
                    onChange={(e) => setMessageSearchValue(e.target.value)}
                  />
                </MessagesSearch>
                <OrderDetailIconButton
                  type='button'
                  aria-label={t('ORDER_DETAILS', 'Order details')}
                  onClick={() => handleMessageOrderDetail(true)}
                >
                  <Info size='1em' />
                </OrderDetailIconButton>
              </SearchAndDetailControlContainer>
            )}
          </WrapperHeader>
        </HeaderProfile>
        {/* redesign W1-6 (W1-QB1-04): a scrollable region is focusable and has a name (axe scrollable-region-focusable) */}
        <Chat id='chat' role='region' tabIndex={0} aria-label={history ? t('MOBILE_ORDER_HISTORY', 'Order History') : t('CHAT', 'Chat')}>
          {
            messages.loading && (
              <>
                {!history
                  ? (
                  <>
                    <MessageBusiness>
                      <SkeletonBubbleBusiness>
                        <Skeleton width={200} height={100} />
                      </SkeletonBubbleBusiness>
                    </MessageBusiness>
                    <MessageCustomer>
                      <SkeletonBubbleCustomer>
                        <Skeleton width={250} height={100} />
                      </SkeletonBubbleCustomer>
                    </MessageCustomer>
                    <MessageBusiness>
                      <SkeletonBubbleBusiness>
                        <Skeleton width={150} height={100} />
                      </SkeletonBubbleBusiness>
                    </MessageBusiness>
                    <MessageCustomer>
                      <SkeletonBubbleCustomer>
                        <Skeleton width={200} height={100} />
                      </SkeletonBubbleCustomer>
                    </MessageCustomer>
                  </>
                    )
                  : (
                  <>
                    {[...Array(5)].map((item, i) =>
                      <SkeletonHitory key={i}>
                        <Skeleton width={400} height={50} />
                        <Skeleton width={300} height={50} />
                        <Skeleton width={380} height={50} />
                        <Skeleton width={200} height={50} />
                        <Skeleton width={450} height={50} />
                      </SkeletonHitory>
                    )}
                  </>
                    )}
              </>
            )
          }
          {
            !messages.loading && (
              <>
                {!tabActive === 'logistic_information' && (
                  <MessageConsole>
                    <BubbleConsole>
                      {t('ORDER_PLACED_FOR', 'Order placed for')} {' '}
                      <strong>{parseDate(order.created_at)}</strong> {' '}
                      {t('VIA', 'via')} <strong>{order.app_id ? t(order.app_id.toUpperCase(), `${order.app_id}`) : ''}</strong>{' '}
                      <Tooltip content={parseDate(order.created_at)}>
                        <TimeofSent>{getTimeAgo(order.created_at)}</TimeofSent>
                      </Tooltip>
                    </BubbleConsole>
                  </MessageConsole>
                )}
                {history && (
                  <>
                    {tabActive === 'logistics' && (
                      <WrapperLogistics>
                        <Logistics orderId={order.id} />
                      </WrapperLogistics>
                    )}
                    {tabActive === 'logistic_information' && (
                      <WrapperLogisticInformation>
                        <OrderLogisticInformation orderId={order.id} />
                      </WrapperLogisticInformation>
                    )}
                  </>
                )}
                {filteredMessages.length > 0 && filteredMessages.map((message) => (
                  <React.Fragment key={message.id}>
                    {history && tabActive === 'order_history' && (
                      <>
                        {message.type === 0 && (
                          <MessageConsole key={message.id}>
                            <BubbleConsole>
                              <p
                                dangerouslySetInnerHTML={{
                                  __html: buildOrderPlacedForViaHtml({
                                    template: t('ORDER_PLACED_FOR_VIA', 'Order placed for _for_ via _via_.'),
                                    deliveryDatetimeUtc: order?.delivery_datetime_utc,
                                    parseUtcDate: () => parseDate(order?.delivery_datetime_utc),
                                    parseLocalDate: () => parseDate(order?.delivery_datetime, { utc: false }),
                                    viaLabel: t(orderPlacedViaCopy.key, orderPlacedViaCopy.fallback)
                                  })
                                }}
                              />
                              <div><strong>{t('APP_ID', 'App ID')}: </strong>{message?.app_id}</div>
                              <div><strong>{t('AUTHOR', 'Author')}: </strong>{message?.author ? message?.author?.name + ' ' + message?.author?.lastname : t('AUTHOR_SYSTEM', 'System')}</div>
                              <div><strong>{t('USER_AGENT', 'User agent')}: </strong>{message?.user_agent}</div>
                              <div><strong>{t('IP', 'IP')}: </strong>{message?.ip}</div>
                              <TimeofSent>{getTimeAgo(message?.created_at)}</TimeofSent>
                            </BubbleConsole>
                          </MessageConsole>
                        )}
                        {message.type === 1 && (
                          <MessageConsole key={message.id} style={{ display: `${tabActive === 'order_history' ? 'inline-flex' : 'none'}` }}>
                            {getHistoryComment(message) && (
                              <BubbleConsole>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: getHistoryComment(message)
                                  }}
                                />
                                {message.source && (
                                  <ChatImage aria-label={t('CLICK_TO_EXPAND', 'Click to expand')} onClick={() => setPreviewImage(message.source)} title={t('CLICK_TO_EXPAND', 'Click to expand')}><img src={message.source} onLoad={() => setLoad(load + 1)} alt={t('IMAGE', 'Image')} loading='lazy' /></ChatImage>
                                )}
                                <Tooltip content={parseDate(message.created_at)}>
                                  <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                                </Tooltip>
                              </BubbleConsole>
                            )}
                          </MessageConsole>
                        )}
                      </>
                    )}
                    {isChat && (
                      <>
                        {message.type === 0 && (
                          <MessageConsole key={message.id}>
                            <BubbleConsole>
                              <p>
                                {t('ORDER_PLACED_FOR', 'Order placed for')} {' '}
                                <strong>{parseDate(order.created_at)}</strong> {' '}
                                {t('VIA', 'Via')}{' '}
                                <strong>
                                  {order.app_id ? t(order.app_id.toUpperCase(), order.app_id) : t('OTHER', 'Other')}
                                </strong>{' '}
                              </p>
                              <div><strong>{t('APP_ID', 'App ID')}: </strong>{message?.app_id}</div>
                              <div><strong>{t('AUTHOR', 'Author')}: </strong>{message?.author_id ? message?.author?.name + ' ' + message?.author?.lastname : t('AUTHOR_SYSTEM', 'System')}</div>
                              <div><strong>{t('USER_AGENT', 'User agent')}: </strong>{message?.user_agent}</div>
                              <div><strong>{t('IP', 'IP')}: </strong>{message?.ip}</div>
                              <TimeofSent>{getTimeAgo(message?.created_at)}</TimeofSent>
                            </BubbleConsole>
                          </MessageConsole>
                        )}
                        {message.type === 1 && (
                          <MessageConsole key={message.id} style={{ display: `${tabActive === 'order_history' ? 'inline-flex' : 'none'}` }}>
                            {getHistoryComment(message) && (
                              <BubbleConsole>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: getHistoryComment(message)
                                  }}
                                />
                                {message.source && (
                                  <ChatImage aria-label={t('CLICK_TO_EXPAND', 'Click to expand')} onClick={() => setPreviewImage(message.source)} title={t('CLICK_TO_EXPAND', 'Click to expand')}><img src={message.source} onLoad={() => setLoad(load + 1)} alt={t('IMAGE', 'Image')} loading='lazy' /></ChatImage>
                                )}
                                <Tooltip content={parseDate(message.created_at)}>
                                  <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                                </Tooltip>
                              </BubbleConsole>
                            )}
                          </MessageConsole>
                        )}
                        {message.type === 2 && user.id === message.author_id && (
                          <MessageCustomer>
                            <BubbleCustomer>
                              <MessageSender>{message.author.name} ({order.customer_id === message.author.id ? getLevel(3) : getLevel(message.author.level)})</MessageSender>
                              {message.comment}
                              <Tooltip content={parseDate(message.created_at)}>
                                <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                              </Tooltip>
                            </BubbleCustomer>
                            <SendToContainer>
                              <p>{t('SEND_TO', 'Send to')}:</p>
                              <ImageContainer isCircle>
                                {message.can_see.includes(2) && (
                                  <ImageWithFallback
                                    src={order.business?.logo}
                                    fallback={<Store size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(3) && (
                                  <ImageWithFallback
                                    src={order.customer?.photo}
                                    fallback={<User size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(4) && (
                                  <>
                                    {order?.driver && (
                                      <ImageWithFallback
                                        src={order.driver?.photo}
                                        fallback={<UserRound size='1em' />}
                                      />
                                    )}
                                  </>
                                )}
                              </ImageContainer>
                            </SendToContainer>
                          </MessageCustomer>
                        )}
                        {message.type === 3 && user.id === message.author_id && (
                          <MessageCustomer>
                            <BubbleCustomer name='image'>
                              <MessageSender>{message.author.name} ({order.customer_id === message.author.id ? getLevel(3) : getLevel(message.author.level)})</MessageSender>
                              <ChatImage aria-label={t('CLICK_TO_EXPAND', 'Click to expand')} onClick={() => setPreviewImage(message.source)} title={t('CLICK_TO_EXPAND', 'Click to expand')}><img src={message.source} onLoad={() => setLoad(load + 1)} alt={t('IMAGE', 'Image')} loading='lazy' /></ChatImage>
                              {message.comment && (
                                <>
                                  {message.comment}
                                </>
                              )}
                              <Tooltip content={parseDate(message.created_at)}>
                                <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                              </Tooltip>
                            </BubbleCustomer>
                            <SendToContainer>
                              <p>{t('SEND_TO', 'Send to')}:</p>
                              <ImageContainer isCircle>
                                {message.can_see.includes(2) && (
                                  <ImageWithFallback
                                    src={order.business?.logo}
                                    fallback={<Store size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(3) && (
                                  <ImageWithFallback
                                    src={order.customer?.photo}
                                    fallback={<User size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(4) && (
                                  <>
                                    {order?.driver && (
                                      <ImageWithFallback
                                        src={order.driver?.photo}
                                        fallback={<UserRound size='1em' />}
                                      />
                                    )}
                                  </>
                                )}
                              </ImageContainer>
                            </SendToContainer>
                          </MessageCustomer>
                        )}
                        {message.type === 2 && user.id !== message.author_id && (
                          <MessageBusiness>
                            <BubbleBusines>
                              <MessageSender>{message.author.name} ({order.customer_id === message.author.id ? getLevel(3) : getLevel(message.author.level)})</MessageSender>
                              {message.comment}
                              <Tooltip content={parseDate(message.created_at)}>
                                <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                              </Tooltip>
                            </BubbleBusines>
                            <SendToContainer isReceived>
                              <p>{t('SEND_TO', 'Send to')}:</p>
                              <ImageContainer isCircle isReceived>
                                {message.can_see.includes(2) && (
                                  <ImageWithFallback
                                    src={order.business?.logo}
                                    fallback={<Store size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(3) && (
                                  <ImageWithFallback
                                    src={order.customer?.photo}
                                    fallback={<User size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(4) && (
                                  <>
                                    {order?.driver && (
                                      <ImageWithFallback
                                        src={order.driver?.photo}
                                        fallback={<UserRound size='1em' />}
                                      />
                                    )}
                                  </>
                                )}
                              </ImageContainer>
                            </SendToContainer>
                          </MessageBusiness>
                        )}
                        {message.type === 3 && user.id !== message.author_id && (
                          <MessageBusiness>
                            <MessageSender>{message.author.name} ({order.customer_id === message.author.id ? getLevel(3) : getLevel(message.author.level)})</MessageSender>
                            <BubbleBusines name='image'>
                              <ChatImage aria-label={t('CLICK_TO_EXPAND', 'Click to expand')} onClick={() => setPreviewImage(message.source)} title={t('CLICK_TO_EXPAND', 'Click to expand')}><img src={message.source} onLoad={() => setLoad(load + 1)} alt={t('IMAGE', 'Image')} loading='lazy' /></ChatImage>
                              {message.comment && (
                                <>
                                  {message.comment}
                                </>
                              )}
                              <Tooltip content={parseDate(message.created_at)}>
                                <TimeofSent>{getTimeAgo(message.created_at)}</TimeofSent>
                              </Tooltip>
                            </BubbleBusines>
                            <SendToContainer isReceived>
                              <p>{t('SEND_TO', 'Send to')}:</p>
                              <ImageContainer isCircle isReceived>
                                {message.can_see.includes(2) && (
                                  <ImageWithFallback
                                    src={order.business?.logo}
                                    fallback={<Store size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(3) && (
                                  <ImageWithFallback
                                    src={order.customer?.photo}
                                    fallback={<User size='1em' />}
                                  />
                                )}
                                {message.can_see.includes(4) && (
                                  <>
                                    {order?.driver && (
                                      <ImageWithFallback
                                        src={order.driver?.photo}
                                        fallback={<UserRound size='1em' />}
                                      />
                                    )}
                                  </>
                                )}
                              </ImageContainer>
                            </SendToContainer>
                          </MessageBusiness>
                        )}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </>
            )
          }
        </Chat>

        {!history && (
          <SendForm className='message-footer'>
            <ImageContainer>
              {user?.level !== 2 && (
                <ChatContactInfoContainer
                  selected={canRead?.business}
                  aria-pressed={canRead?.business}
                  aria-label={`${t('BUSINESS', 'Business')}: ${order.business?.name}`}
                  onClick={() => setCanRead({ ...canRead, business: !canRead?.business })}
                >
                  <ImageWithFallback
                    src={optimizeImage(order.business?.logo, 'h_40,c_limit')}
                    fallback={<Store size='1em' />}
                  />
                  <InfoBlock>
                    <p>{order.business?.name}</p>
                    <p>{t('BUSINESS', 'Business')}</p>
                  </InfoBlock>
                </ChatContactInfoContainer>
              )}
              <ChatContactInfoContainer
                selected={canRead?.customer}
                aria-pressed={canRead?.customer}
                aria-label={`${t('CUSTOMER', 'Customer')}: ${order.customer?.name ?? ''} ${order.customer?.lastname ?? ''}`.trim()}
                onClick={() => setCanRead({ ...canRead, customer: !canRead?.customer })}
              >
                <ImageWithFallback
                  src={optimizeImage(order.customer?.photo, 'w_40,c_limit')}
                  fallback={<User size='1em' />}
                />
                <InfoBlock>
                  <p>{order.customer?.name} {order.customer?.lastname}</p>
                  <p>{t('CUSTOMER', 'Customer')}</p>
                </InfoBlock>
              </ChatContactInfoContainer>
              {order?.driver && (
                <ChatContactInfoContainer
                  selected={canRead?.driver}
                  aria-pressed={canRead?.driver}
                  aria-label={`${t('DRIVER', 'Driver')}: ${order.driver?.name ?? ''} ${order.driver?.lastname ?? ''}`.trim()}
                  onClick={() => setCanRead({ ...canRead, driver: !canRead?.driver })}
                >
                  <ImageWithFallback
                    src={optimizeImage(order.driver?.photo, 'w_40,c_limit')}
                    fallback={<UserRound size='1em' />}
                  />
                  <InfoBlock>
                    <p>{order.driver?.name} {order.driver?.lastname}</p>
                    <p>{t('DRIVER', 'Driver')}</p>
                  </InfoBlock>
                </ChatContactInfoContainer>
              )}
            </ImageContainer>
            {chatDisabled
              ? (
              <NotSendMessage>
                <Ban size='1em' />
                <p>{t('NOT_SEND_MESSAGES', 'You can\'t send messages because the order has ended')}</p>
              </NotSendMessage>
                )
              : (
              <>
                {messageList.length > 0 && (
                  <QuickMessageWrapper>
                    {messageList.map((quickMessage, i) => (
                      <Button
                        key={i}
                        variant='secondary'
                        onClick={() => handleClickQuickMessage(quickMessage.text)}
                      >
                        {quickMessage.text}
                      </Button>
                    ))}
                  </QuickMessageWrapper>
                )}

                <Send onSubmit={handleSubmit(onSubmit)} noValidate>
                  <WrapperSendInput>
                    <Controller
                      name='message'
                      control={control}
                      render={({ onChange, value }) => (
                        // redesign W1-6 (T1-6-4a): the box is the Product TextField (same value, focus and read-only states)
                        <TextField
                          aria-label={t('WRITE_A_MESSAGE', 'Write a message...')}
                          placeholder={t('WRITE_A_MESSAGE', 'Write a message...')}
                          value={value}
                          onChange={(nextValue) => {
                            onChange(nextValue)
                            onChangeMessage({ target: { value: nextValue } })
                          }}
                          onFocus={unreadMessageControl}
                          name='message'
                          ref={messageInputRef}
                          autoComplete='off'
                          readOnly={isChatDisabled}
                        />
                      )}
                      rules={{
                        required: !image
                      }}
                      defaultValue=''
                    />
                    {!image && (
                      <SendImage htmlFor='chat_image'>
                        <input
                          type='file'
                          name='image'
                          id='chat_image'
                          accept='image/png,image/jpg,image/jpeg'
                          onChange={onChangeImage}
                          disabled={isChatDisabled}
                          aria-label={t('INSERT_IMAGE', 'Insert image')}
                        />
                        <ImageIcon size='1em' />
                      </SendImage>
                    )}
                    {image && (
                      <WrapperDeleteImage>
                        <IconButton
                          icon={X}
                          size='sm'
                          label={t('REMOVE', 'Remove')}
                          onClick={removeImage}
                          type='reset'
                        />
                        <img
                          src={image}
                          loading='lazy'
                          alt={t('IMAGE', 'Image')}
                        />
                      </WrapperDeleteImage>
                    )}
                  </WrapperSendInput>
                  <WrapperSendMessageButton>
                    <Button
                      variant='primary'
                      type='submit'
                      icon={SendGlyph}
                      busy={sendMessage.loading}
                      disabled={sendMessage.loading || (message === '' && !image) || messages.loading}
                      ref={buttonRef}
                      aria-label={sendMessage.loading ? t('SENDING_MESSAGE', 'Sending...') : t('SEND', 'send')}
                      aria-busy={sendMessage.loading}
                    >
                      {sendMessage.loading
                        ? (
                        <span>
                          {t('SENDING_MESSAGE', 'Sending...')}
                        </span>
                          )
                        : (
                          <span>
                            {t('SEND', 'send')}
                          </span>)}
                    </Button>
                  </WrapperSendMessageButton>
                </Send>
              </>
                )}
          </SendForm>
        )}
        <AlertDialog
          title={t('ERROR', 'Error')}
          closeLabel={t('CLOSE', 'Close')}
          confirmLabel={t('OK', 'OK')}
          content={alertState.content}
          open={alertState.open}
          // redesign W0-2 r3 (W0-Q2-04): «Send» is disabled while it sends, so when the send came from it the focus is
          // gone (<body>) before the alert opens and would end on «Skip to content». It returns to the message box.
          returnFocus={() => messageInputRef.current}
          onClose={() => closeAlert()}
        />
        <Dialog
          open={!!previewImage}
          onOpenChange={(next) => { if (!next) setPreviewImage(null) }}
          size='lg'
          className='odc-image-dialog'
          title={t('IMAGE_PREVIEW', 'Image preview')}
          closeLabel={t('CLOSE', 'Close')}
        >
          {previewImage && (
            <div className='odc-image-preview'>
              <img src={previewImage} alt={getImageAlt(previewImage)} />
              <a href={previewImage} target='_blank' rel='noopener noreferrer'>
                {t('OPEN_ORIGINAL_IMAGE', 'Open original image')}
              </a>
            </div>
          )}
        </Dialog>
      </WrapperContainer>
    </MessagesContainer>
  )
}

export const Messages = (props) => {
  const MessagesProps = {
    ...props,
    asDashboard: true,
    UIComponent: MessagesUI
  }
  return <MessagesController {...MessagesProps} />
}
