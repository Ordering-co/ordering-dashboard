import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket } from '../../contexts/WebsocketContext'
import { useEvent } from '../../contexts/EventContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useUtils } from '../../contexts/UtilsContext'
import { useConfig } from '../../contexts/ConfigContext'
import { isOrderStatusRegressionError } from '../../utils'

export const OrderDetails = (props) => {
  const {
    orderId,
    propsToFetch,
    asDashboard,
    hashKey,
    userCustomerId,
    isDisableLoadMessages,
    drivers,
    UIComponent,
    handleOpenOrderDetail
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()
  const [events] = useEvent()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ parsePrice }] = useUtils()
  const [configState] = useConfig()
  const isRegressionValidationEnabled = configState?.configs?.order_status_regression_validation_enabled?.value === '1'

  const [orderState, setOrderState] = useState({ order: null, loading: !props.order, error: null })
  const [messageErrors, setMessageErrors] = useState({ status: null, loading: false, error: null })
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })
  const [messages, setMessages] = useState({ loading: true, error: null, messages: [] })
  const [messagesReadList, setMessagesReadList] = useState(false)
  const [customerInfoState, setCustomerInfoState] = useState({ error: null, customer: {}, loading: false })
  const [addressState, setAddressState] = useState({})
  const [cloneState, setCloneState] = useState({ type: 1, loading: false })
  const [showReservationAlert, setShowReservationAlert] = useState(false)
  const requestsState = {}

  const socket = useWebsocket()

  const accessToken = props.accessToken || token

  /**
   * Method to format a price number
   * @param {Number} price
   */
  const formatPrice = price => price && parsePrice(price)

  /**
   * Method to Load message for first time
   */
  const loadMessages = async () => {
    try {
      setMessages({ ...messages, loading: true })
      const url = `${ordering.root}/orders/${orderId}/messages?mode=dashboard`
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` } })
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
   * Method to update customer info to order from API
   */
  const handleUpdateCustomerInfo = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const customer = { ...orderState?.order?.customer, ...customerInfoState?.customer, ...addressState }

      const { content } = await ordering.setAccessToken(token).orders(orderId).save({ customer })

      if (!content.error) {
        showToast(ToastType.Success, t('CUSTOMER_INFO_UPDATED', 'Customer info updated'))
        const updatedOrder = { ...orderState?.order, ...content?.result }
        setOrderState({
          ...orderState,
          loading: false,
          order: updatedOrder
        })
      } else {
        showToast(ToastType.Error, content?.result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
   * Method to update assigmentComment to order from API
   * @param {object} commentInfo assigned comment and driver id
   */
  const handleUpdateComment = async (commentInfo) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))

      const { content } = await ordering.setAccessToken(token).orders(orderId).save({ manual_driver_assignment_comment: commentInfo?.comment, driver_id: commentInfo?.driverId })

      if (!content.error) {
        showToast(ToastType.Success, t('ORDER_DRIVER_ASSIGNED', 'Driver assigned to order'))
      } else {
        showToast(ToastType.Error, content?.result)
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  /**
   * Method to send a message
   * @param {string} spot
   */
  const sendMessage = async (spot) => {
    try {
      setMessageErrors({
        ...messageErrors,
        loading: true
      })
      const { status } = await fetch(`${ordering.root}/orders/${orderId}/messages`, {
        method: 'post',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          can_see: '0,2,3',
          comment: `I am on the parking number: ${spot}`,
          order_id: orderId,
          type: 2
        })
      })
      setMessageErrors({
        ...messageErrors,
        loading: false,
        status
      })
    } catch (e) {
      setMessageErrors({
        ...messageErrors,
        loading: false,
        error: [e.message]
      })
    }
  }

  /**
   * handler send message with spot info
   * @param {number} param0
   */
  const handlerSubmitSpotNumber = ({ spot }) => {
    sendMessage(spot)
  }

  /**
   * Method to get order from API
   */
  const getOrder = async (_orderId = orderId, callbacks) => {
    const options = {}
    if (hashKey) {
      options.headers = {
        'X-uuid-access-X': hashKey
      }
    }
    if (userCustomerId) {
      options.query = {
        mode: 'dashboard'
      }
    }
    try {
      setOrderState({
        ...orderState,
        loading: true
      })
      let functionFetch
      if (propsToFetch) {
        functionFetch = asDashboard
          ? ordering.setAccessToken(token).orders(_orderId).asDashboard().select(propsToFetch)
          : ordering.setAccessToken(token).orders(_orderId).select(propsToFetch)
      } else {
        functionFetch = asDashboard
          ? ordering.setAccessToken(token).orders(_orderId).asDashboard()
          : ordering.setAccessToken(token).orders(_orderId)
      }
      const source = {}
      requestsState.page = source
      const { content: { result } } = await functionFetch.get({ cancelToken: source })
      const order = Array.isArray(result) ? null : result
      setOrderState({
        ...orderState,
        loading: false,
        order
      })
      callbacks?.handleOpenOrderDetail && callbacks?.handleOpenOrderDetail(order)
    } catch (e) {
      setOrderState({
        ...orderState,
        loading: false,
        error: [e.message]
      })
    }
  }
  /**
   * Method to change order status from API
   * @param {object} order orders id and new status
   */
  const handleUpdateOrderStatus = async (order) => {
    try {
      setActionStatus({ loading: true, error: null })
      const response = await fetch(`${ordering.root}/orders/${order?.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Internal-Product-X': ordering.appInternalName
        },
        body: JSON.stringify({ status: order.newStatus, ...(order.reasons && { reasons: order.reasons }) })
      })
      const content = await response.json()
      if (content.error) {
        const errorMessages = Array.isArray(content.result) ? content.result : [content.result]
        if (isRegressionValidationEnabled && !order.reasons && isOrderStatusRegressionError(content.error_codes)) {
          setActionStatus({ loading: false, error: null })
          return { error: true, regressionRequired: true, result: errorMessages }
        }
        setActionStatus({ loading: false, error: errorMessages, errorSource: 'orderStatus' })
        return { error: true, result: errorMessages }
      }
      if (order?.id === orderState?.order?.id) {
        delete content.result.total
        delete content.result.subtotal
        if (!order?.driver && order?.driver_id) {
          const updatedDriver = drivers.find(driver => driver.id === order.driver_id)
          if (updatedDriver) {
            order.driver = { ...updatedDriver }
          }
        }
        setOrderState({
          ...orderState,
          order: Object.assign(orderState.order, content.result)
        })
        if (content.result?.status === 7 && content.result?.reservation) {
          setShowReservationAlert(true)
        }
      }
      setActionStatus({ loading: false, error: null })
      return { error: false }
    } catch (err) {
      const errorMessages = [err.message]
      setActionStatus({ loading: false, error: errorMessages, errorSource: 'orderStatus' })
      return { error: true, result: errorMessages }
    }
  }

  const readMessages = async () => {
    const messageId = messages?.messages[messages?.messages?.length - 1]?.id
    try {
      const response = await fetch(`${ordering.root}/orders/${orderId}/messages/${messageId}/read`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const { result } = await response.json()

      setMessagesReadList(result)
    } catch {}
  }

  const handleRefundPaymentsStripe = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOption = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderState.order?.id,
          business_id: orderState.order?.business_id,
          gateway: orderState.order?.paymethod?.gateway
        })
      }
      const response = await fetch(`${ordering.root}/payments/stripe/refund`, requestOption)
      const content = await response.json()
      setActionStatus({
        loading: false,
        error: content.error ? content.result : null
      })
      if (!content.error) {
        setOrderState({
          ...orderState,
          order: { ...orderState.order, refund_data: content.result }
        })
        showToast(ToastType.Success, t('ORDER_REFUNDED', 'Order refunded'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  const pluginRefundProviders = [
    {
      host: 'credibanco.plugins.orderingplus.com',
      partial: false,
      paymethods: ['credibanco']
    }
  ]

  const getPluginRefundProvider = (gateway) =>
    pluginRefundProviders.find(p => p.paymethods.includes(gateway)) || null

  const handleRefundPaymentsPlugin = async (amount) => {
    try {
      const provider = getPluginRefundProvider(orderState.order?.paymethod?.gateway)
      if (!provider) {
        setActionStatus({ ...actionStatus, loading: false, error: ['Unsupported gateway'], errorSource: 'refund' })
        return
      }

      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })

      const body = {
        cart_uuid: orderState.order?.uuid,
        order_id: orderState.order?.id
      }
      if (provider.partial) {
        body.order_total = orderState.order?.summary?.total ?? orderState.order?.total
        if (amount) body.amount = amount
      }

      const response = await fetch(
        `https://${provider.host}/${ordering.project}/api/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      )
      const content = await response.json()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (content.error) {
        setActionStatus({
          loading: false,
          error: [content.result?.message || 'Refund failed'],
          errorSource: 'refund'
        })
        return
      }

      const refundData = content.result
      const status = refundData?.status

      const updatedOrder = { ...orderState.order, refund_data: refundData }
      setOrderState({ ...orderState, order: updatedOrder })
      getOrder()

      if (status === 'already_refunded') {
        setActionStatus({ loading: false, error: null })
        showToast(ToastType.Info, refundData?.message || t('ORDER_ALREADY_REFUNDED', 'This order has already been refunded.'))
        return
      }

      setActionStatus({ loading: false, error: null })
      const actionMsg = status === 'success' && refundData?.action === 'voided'
        ? t('ORDER_VOIDED', 'Order payment voided')
        : t('ORDER_REFUNDED', 'Order refunded')
      showToast(ToastType.Success, actionMsg)
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message], errorSource: 'refund' })
    }
  }

  const handleOrderRefund = async (data) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionStatus({ ...actionStatus, loading: true })
      const requestOption = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Internal-Product-X': ordering.appInternalName
        },
        body: JSON.stringify(data)
      }
      const response = await fetch(`${ordering.root}/orders/${orderState.order?.id}/refund`, requestOption)
      const content = await response.json()
      setActionStatus({
        loading: false,
        error: content.error ? content.result : null,
        errorSource: content.error ? 'refund' : null
      })
      if (!content.error) {
        const isV2Shape = content.result && !Array.isArray(content.result) && Array.isArray(content.result?.order_payment_events)
        const refundData = isV2Shape ? [...content.result.order_payment_events] : [...content.result]
        if (data?.order_payment_event_id) {
          const sourceEvent = orderState?.order?.payment_events?.find(event => event?.id === data.order_payment_event_id)
          if (sourceEvent) {
            refundData.map(item => {
              if (item?.order_payment_event_id === data?.order_payment_event_id) {
                item.paymethod = sourceEvent?.paymethod
              }
              return item
            })
          }
        }
        const updatedPaymentEvents = [...(orderState.order?.payment_events || []), ...refundData]
        const baseOrder = isV2Shape && content.result?.order
          ? { ...orderState.order, ...content.result.order }
          : orderState.order
        setOrderState({
          ...orderState,
          order: { ...baseOrder, payment_events: updatedPaymentEvents }
        })
        showToast(ToastType.Success, t('ORDER_REFUNDED', 'Order refunded'))
      }
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  const handleChangeCustomerInfoState = (changes) => {
    setCustomerInfoState({
      ...customerInfoState,
      customer: {
        ...customerInfoState?.customer,
        ...changes
      }
    })
  }

  const handleCloneOrder = async () => {
    try {
      setCloneState({
        ...cloneState,
        loading: true
      })
      let body = {
        user_id: orderState?.order?.customer_id
      }
      if (cloneState.type === 1) {
        const productsCode = orderState?.order?.products.map(product => product.code)
        body = {
          ...body,
          products_code: JSON.stringify(productsCode)
        }
      }
      const response = await fetch(`${ordering.root}/orders/${orderId}/clone`, {
        body: JSON.stringify(body),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-app-x': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName,
          'X-Socket-Id-X': socket?.getId()
        }
      })
      const { result, error } = await response.json()
      if (error) {
        setOrderState({
          ...orderState,
          loading: false,
          error: result
        })
        setCloneState({
          ...cloneState,
          loading: false
        })
        return
      }
      await getOrder(result?.id, { handleOpenOrderDetail })
      setCloneState({
        ...cloneState,
        loading: false
      })
    } catch (e) {
      setCloneState({
        ...cloneState,
        loading: false
      })
      setOrderState({
        ...orderState,
        loading: false,
        error: [e.message]
      })
    }
  }

  useEffect(() => {
    if (props.order) {
      setOrderState({
        ...orderState,
        order: props.order
      })
    }
    if (!props.order) {
      getOrder()
      return () => {
        if (requestsState.page) {
          requestsState.page.cancel()
        }
      }
    }
  }, [orderId])

  useEffect(() => {
    if (orderState.loading || loading) return
    const handleUpdateOrder = (order) => {
      if (order?.id !== orderState?.order?.id) return
      delete order.total
      delete order.subtotal
      if (!order?.driver && order?.driver_id) {
        const updatedDriver = drivers.find(driver => driver.id === order.driver_id)
        if (updatedDriver) {
          order.driver = { ...updatedDriver }
        }
      }
      setOrderState({
        ...orderState,
        order: Object.assign(orderState.order, order)
      })
    }
    socket.on('update_order', handleUpdateOrder)
    return () => {
      socket.off('update_order', handleUpdateOrder)
    }
  }, [orderState.order, socket, loading, drivers])

  useEffect(() => {
    const handleCustomerReviewed = (review) => {
      setOrderState({
        ...orderState,
        order: { ...orderState.order, user_review: review }
      })
    }
    events.on('customer_reviewed', handleCustomerReviewed)
    return () => {
      events.off('customer_reviewed', handleCustomerReviewed)
    }
  }, [orderState])

  useEffect(() => {
    if (!isDisableLoadMessages) {
      loadMessages()
    }
  }, [orderId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          order={orderState}
          customerInfoState={customerInfoState}
          handleChangeCustomerInfoState={handleChangeCustomerInfoState}
          messageErrors={messageErrors}
          actionStatus={actionStatus}
          formatPrice={formatPrice}
          handlerSubmit={handlerSubmitSpotNumber}
          handleUpdateOrderStatus={handleUpdateOrderStatus}
          messages={messages}
          setMessages={setMessages}
          messagesReadList={messagesReadList}
          readMessages={readMessages}
          handleRefundPaymentsStripe={handleRefundPaymentsStripe}
          handleRefundPaymentsPlugin={handleRefundPaymentsPlugin}
          getPluginRefundProvider={getPluginRefundProvider}
          handleOrderRefund={handleOrderRefund}
          handleUpdateCustomerInfo={handleUpdateCustomerInfo}
          handleUpdateComment={handleUpdateComment}
          addressState={addressState}
          setAddressState={setAddressState}
          cloneState={cloneState}
          setCloneState={setCloneState}
          handleCloneOrder={handleCloneOrder}
          showReservationAlert={showReservationAlert}
          setShowReservationAlert={setShowReservationAlert}
        />
      )}
    </>
  )
}

OrderDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of drivers props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string),
  /**
   * This must be contains orderId to fetch
   */
  orderId: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  /**
   * Order, this must be contains an object with all order info
   */
  order: PropTypes.object
}
