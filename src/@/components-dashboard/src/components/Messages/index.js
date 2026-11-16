import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useUtils } from '../../contexts/UtilsContext'
import { capitalize } from '~ui/src/utils'
import { getHistoryComment as buildHistoryComment } from './historyComment'
import { joinDraft } from './joinDraft' // redesign tramo A r4 (W0-QA2-05)

export const Messages = (props) => {
  const {
    UIComponent,
    orderId,
    customHandleSend,
    messages: orderMessages,
    setMessages: setOrderMessages,
    asDashboard,
    order,
    handleUpdateOrderForUnreadCount
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [configState] = useConfig()
  const [{ getOrderState, parsePrice, parseDate }] = useUtils()
  const [{ user, token }] = useSession()
  const accessToken = props.accessToken || token

  const [canRead, setCanRead] = useState({ business: true, administrator: true, driver: true, customer: true })
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState({ loading: true, error: null, messages: [] })
  const [sendMessage, setSendMessages] = useState({ loading: false, error: null })
  const [readMessages, setReadMessages] = useState({ loading: true, error: null, messages: [] })
  const [image, setImage] = useState(null)
  const socket = useWebsocket()

  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value
  const getHistoryComment = (message) => buildHistoryComment({
    message,
    userLevel: user?.level,
    t,
    getOrderState,
    parsePrice,
    parseDate, // redesign W1-6 (T1-6-4a, W1-D-18): the dates of the history events are painted by parseDate, not pasted raw
    googleMapsApiKey,
    capitalize
  })

  /**
   * Method to send message
   */
  const handleSend = async () => {
    if (customHandleSend) {
      return customHandleSend(message)
    }
    // redesign W0-2 r3 (W0-P2-02): as in main, the draft (text and attachment) empties when the send STARTS, so what
    // the user types while the request is on the way is new text. If the send then fails, the draft that was sent
    // comes back. redesign tramo A r3 (W0-QA1-03): if the user typed meanwhile, nothing is lost: the box keeps the sent
    // draft, a separator and what was typed after (nothing was sent, so nothing is repeated); an attachment chosen
    // meanwhile stays, the new one wins. The separator is a space, not a line break: both consumers (ChatTab and
    // /messages) write in a single-line <input>, whose value sanitization removes line breaks and would glue the two texts.
    const sentMessage = message
    const sentImage = image
    const restoreDraft = () => {
      setMessage(current => joinDraft(sentMessage, current)) // redesign tramo A r4 (W0-QA2-05)
      setImage(current => current === null ? sentImage : current)
    }
    try {
      setSendMessages({ loading: true, error: null })
      setMessage('')
      setImage(null)
      const _canRead = []
      if (canRead.customer) {
        _canRead.push(3)
      }
      if (canRead.administrator) {
        _canRead.push(0)
      }
      if (canRead.business) {
        _canRead.push(2)
      }
      if (canRead.driver) {
        _canRead.push(4)
      }
      const body = {
        comment: message,
        type: 2,
        can_see: _canRead.join(',')
      }
      if (image) {
        body.type = 3
        body.file = image
      }
      const response = await fetch(`${ordering.root}/orders/${orderId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) })
      const { error, result } = await response.json()
      if (!error) {
        if (setOrderMessages && orderMessages) {
          setOrderMessages({
            ...orderMessages,
            messages: [
              ...orderMessages.messages,
              result
            ]
          })
        } else {
          setMessages({
            ...messages,
            messages: [
              ...messages.messages,
              result
            ]
          })
        }
      }
      // redesign W0-2 r2 (W0-Q1-07): a refusal with no text still counts as an error (it used to read as a success)
      if (error) restoreDraft() // redesign W0-2 r3 (W0-P2-02): the refused draft comes back, so the same Send retries
      setSendMessages({ loading: false, error: error ? (result || [t('ERROR', 'Error')]) : null })
    } catch (error) {
      restoreDraft() // redesign W0-2 r3 (W0-P2-02): a request that did not arrive keeps the draft too
      setSendMessages({ loading: false, error: [error.Messages] })
    }
  }

  /**
   * Method to Load message for first time
   */
  const loadMessages = async () => {
    try {
      setMessages({ ...messages, messages: [], loading: true })
      const functionFetch = asDashboard
        ? `${ordering.root}/orders/${orderId}/messages?mode=dashboard`
        : `${ordering.root}/orders/${orderId}/messages`
      const response = await fetch(functionFetch, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` } })
      const { error, result } = await response.json()
      if (!error) {
        setMessages({
          messages: result,
          loading: false,
          error: null
        })
      } else {
        setMessages({
          ...messages,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setMessages({ ...messages, loading: false, error: [error.Messages] })
    }
  }

  /**
   * Method to Load message for first time
   * @param {number} messageId order message Id
   */
  const handleReadMessages = async (messageId) => {
    if (orderMessages && setOrderMessages) return
    try {
      setReadMessages({ ...readMessages, loading: true })
      const functionFetch = `${ordering.root}/orders/${orderId}/messages/${messageId}/read?order_id=${orderId}&order_message_id=${messageId}`
      const response = await fetch(functionFetch, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` } })
      const { error, result } = await response.json()
      if (!error) {
        setReadMessages({
          messages: result,
          loading: false,
          error: null
        })
        // redesign W1-6 (T1-6-4a, W1-D-14): from the state at the moment the answer arrives, not from the one the request left with: a
        // message that came in meanwhile (socket) or a change of conversation stayed in the list before, overwritten by the old one.
        setMessages(prevState => (
          prevState.messages.some(item => item.id === messageId)
            ? { ...prevState, messages: prevState.messages.map(item => item.id === messageId ? { ...item, read: true } : item) }
            : prevState
        ))
        handleUpdateOrderForUnreadCount && handleUpdateOrderForUnreadCount(null)
        handleUpdateOrderForUnreadCount && handleUpdateOrderForUnreadCount(orderId)
      } else {
        setReadMessages({
          ...readMessages,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setReadMessages({ ...readMessages, loading: false, error: [error.Messages] })
    }
  }

  useEffect(() => {
    if (orderMessages && setOrderMessages) return
    loadMessages()
  }, [orderId])

  useEffect(() => {
    if (messages.loading || (orderMessages && setOrderMessages)) return
    const handleNewMessage = (message) => {
      if (message.order?.id === orderId || message?.order_id === orderId) {
        const found = messages.messages.find(_message => _message.id === message.id)
        if (!found) {
          setMessages(prevState => ({
            ...prevState,
            messages: [...prevState.messages, message]
          }))
        }
      }
    }
    socket.on('message', handleNewMessage)
    return () => {
      socket.off('message', handleNewMessage)
    }
  }, [messages, socket, order?.status])

  useEffect(() => {
    if (!socket?.socket) return
    const io = socket.socket
    const room = asDashboard
      ? `messages_orders_${orderId}_${user?.level}`
      : `messages_orders_${user?.id}`
    const handleJoinRoom = () => socket.join(room)
    // Join now only if connected: offline, Socket.join() would queue it and the connect listener would send it twice.
    if (io.connected) handleJoinRoom()
    io.on('connect', handleJoinRoom)
    return () => {
      socket.leave(room)
      io.off('connect', handleJoinRoom)
    }
  }, [socket?.socket, orderId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          messages={messages}
          image={image}
          canRead={canRead}
          handleSend={handleSend}
          message={message}
          handleReadMessages={handleReadMessages}
          setMessage={setMessage}
          setCanRead={setCanRead}
          sendMessage={sendMessage}
          setImage={setImage}
          getHistoryComment={getHistoryComment}
        />
      )}
    </>
  )
}

Messages.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Custom Send messageS
   * @param {object} message Message to send
   */
  handleClickSetDefault: PropTypes.func,
  /**
   * @param {object} message
   * handleCustomClick, function to get click event and return message without default behavior
   */
  customHandleSend: PropTypes.func
}
