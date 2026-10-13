import React, { useState, useEffect, useRef } from 'react'
import EnDotSingle from '@meronex/icons/en/EnDotSingle'
import ReactToPrint from 'react-to-print'
import {
  // Wallet2,
  Printer,
  Diagram3,
  ThreeDots,
  XLg as CloseIcon,
  Chat as ChatIcon,
  Dot,
  ArrowsAngleExpand,
  ArrowsAngleContract
} from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { Dropdown, DropdownButton } from 'react-bootstrap'

import { useWindowSize } from '../../../hooks/useWindowSize'
import { useLanguage, useSession, useConfig, useUtils } from '../../../../../index'
import { capitalize, getCurrenySymbol } from '../../../utils'
import { Button, IconButton as ButtonLink } from '../../../styles'
import { OrderTrackingLink } from '../OrderTrackingLink'
import {
  OrderDetailsHeaderContainer,
  UreadMessageAlert,
  ButtonGroup,
  StripeLink,
  PrinterSelect,
  PrinterSelectContainer,
  ActionSelectorWrapper
} from './styles'

export const OrderDetailsHeader = (props) => {
  const {
    order,
    handleShowOption,
    handleDeleteOrder,
    actionSidebar,
    setIsTourOpen,
    isTourOpen,
    currentTourStep,
    openMessage,
    printRef,
    isServiceOrder,
    extraOpen,
    printTicketRef,
    isExpand,
    setIsExpand,
    getPluginRefundProvider
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [{ user }] = useSession()
  const { width } = useWindowSize()
  const dropdownReference = useRef()
  const [{ configs }] = useConfig()
  const theme = useTheme()
  const [showPrinterOptions, setShowPrinterOptions] = useState(false)

  const showExternalId = configs?.change_order_id?.value === '1'

  const stripePaymethods = ['stripe', 'stripe_connect']
  const braintreePaymethods = ['braintree', 'paypal_braintree', 'google_pay_braintree', 'apple_pay_braintree']
  const isPluginRefundGateway = (gateway) =>
    typeof getPluginRefundProvider === 'function'
      ? !!getPluginRefundProvider(gateway)
      : braintreePaymethods.includes(gateway)

  const walletName = {
    cash: {
      name: t('CASH_WALLET', 'Cash Wallet')
    },
    credit_point: {
      name: t('POINTS_WALLET', 'Points Wallet')
    }
  }

  const closeSideBar = () => {
    actionSidebar(false)
    if (isTourOpen && currentTourStep === 1) setIsTourOpen(false)
  }

  const expandSideBar = () => {
    const element = document.getElementById('orderDetails')
    if (!element) return

    if (isExpand) element.style.width = '500px'
    else element.style.width = 'var(--app-width, 100vw)'
    setIsExpand(prev => !prev)
  }

  const closeSelect = (e) => {
    if (showPrinterOptions) {
      const outsideDropdown = !dropdownReference.current?.contains(e.target)
      if (outsideDropdown) {
        setShowPrinterOptions(false)
      }
    }
  }

  useEffect(() => {
    if (!showPrinterOptions) return
    document.addEventListener('click', closeSelect)
    return () => document.removeEventListener('click', closeSelect)
  }, [showPrinterOptions])

  return (
    <OrderDetailsHeaderContainer>
      <div>
        <h1>{isServiceOrder ? t('APPOINTMENT_NO', 'Appointment No.') : t('INVOICE_ORDER_NO', 'Order No')} {order.id}</h1>
        <ButtonGroup>
          {!order?.cloned_order_id && order?.customer_id && user?.level === 0 && (
            <Button
              color='lightPrimary'
              borderRadius='8px'
              className='clone'
              onClick={() => handleShowOption('clone_order')}
            >
              {t('CLONE_ORDER', 'Clone order')}
            </Button>
          )}
          {user?.level !== 5 && (
            <ButtonLink
              color='black'
              active={openMessage?.chat}
              onClick={() => handleShowOption('chat')}
              isDisabled={isTourOpen && currentTourStep === 1}
            >
              <ChatIcon />
              {order?.unread_count > 0 && (
                <UreadMessageAlert>
                  <Dot />
                </UreadMessageAlert>
              )}
            </ButtonLink>
          )}
          <PrinterSelectContainer ref={dropdownReference}>
            <ButtonLink
              color='black'
              isDisabled={isTourOpen && currentTourStep === 1}
              onClick={() => setShowPrinterOptions(!showPrinterOptions)}
            >
              <Printer />
            </ButtonLink>
            {showPrinterOptions && (
              <PrinterSelect>
                <ReactToPrint
                  trigger={() => (
                    <ButtonLink
                      color='black'
                      isDisabled={isTourOpen && currentTourStep === 1}
                      onClick={() => setShowPrinterOptions(false)}
                    >
                      {t('NORMAL', 'Normal')}
                    </ButtonLink>
                  )}
                  content={() => printRef.current}
                  removeAfterPrint
                />
                <ReactToPrint
                  trigger={() => (
                    <ButtonLink
                      color='black'
                      isDisabled={isTourOpen && currentTourStep === 1}
                      onClick={() => setShowPrinterOptions(false)}
                    >
                      {t('TICKET', 'Ticket')}
                    </ButtonLink>
                  )}
                  content={() => printTicketRef.current}
                  removeAfterPrint
                />
              </PrinterSelect>
            )}
          </PrinterSelectContainer>
          <ButtonLink
            color='black'
            active={openMessage?.history}
            onClick={() => handleShowOption('history')}
            isDisabled={isTourOpen && currentTourStep === 1}
          >
            <Diagram3 />
          </ButtonLink>
          <ActionSelectorWrapper>
            <DropdownButton
              menuAlign={theme?.rtl ? 'left' : 'right'}
              title={<ThreeDots />}
              id={theme?.rtl ? 'dropdown-menu-align-left' : 'dropdown-menu-align-right'}
            >
              <Dropdown.Item
                onClick={() => handleShowOption('metafields')}
              >
                {t('CUSTOM_FIELDS', 'Custom fields')}
              </Dropdown.Item>
              <OrderTrackingLink order={order} />
              <Dropdown.Item
                onClick={() => {
                  closeSideBar()
                  handleDeleteOrder(null, [order.id])
                }}
              >
                {t('DELETE', 'Delete')}
              </Dropdown.Item>
            </DropdownButton>
          </ActionSelectorWrapper>
          {/* <ButtonLink
            color='black'
            active={showOption === 'metafields'}
            onClick={() => handleShowOption('metafields')}
            isDisabled={isTourOpen && currentTourStep === 1}
          >
            <ThreeDots />
          </ButtonLink> */}
          {width > 576 && !extraOpen && (
            <ButtonLink
              color='black'
              onClick={() => expandSideBar()}
            >
              {isExpand ? <ArrowsAngleContract /> : <ArrowsAngleExpand />}
            </ButtonLink>
          )}
          <ButtonLink
            color='black'
            onClick={() => closeSideBar()}
          >
            <CloseIcon />
          </ButtonLink>
        </ButtonGroup>
      </div>
      {showExternalId && order?.external_id && (
        <div>
          <h2>
            {t('EXTERNAL_ID', 'External ID :')} {order?.external_id}
          </h2>
        </div>
      )}
      <p>
        {order?.payment_events?.length > 0
          ? (
              order?.payment_events?.filter(item => item.event === 'payment').map((event, i) => (
              <React.Fragment key={i}>
                <span>
                  {event?.wallet_event
                    ? walletName[event?.wallet_event?.wallet?.type]?.name
                    : event?.paymethod
                      ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
                      : t(
                        (event?.data?.gateway || order?.paymethod?.gateway)?.toUpperCase(),
                        capitalize(event?.data?.gateway || order?.paymethod?.name || '')
                      )}
                </span>
                {event?.paymethod?.gateway === 'cash' && order?.cash && (
                  <span> ({t('PAY_WITH', 'Pay with')}: {parsePrice(order?.cash, { currency: getCurrenySymbol(order?.currency) })})</span>
                )}
                {stripePaymethods.includes(event?.data?.gateway || event?.paymethod?.gateway) && (
                  <>
                    <span> (</span>
                    <StripeLink href={`https://dashboard.stripe.com/payments/${event?.data?.result?.pay_data || event?.data?.extra?.pay_data}`} target='_blank'>{event?.data?.result?.pay_data || event?.data?.extra?.pay_data}</StripeLink>
                    <span>) </span>
                    <span> ({order?.refund_data ? t('REFUNDED', 'Refunded') : t('MOBILE_SUCCESS', 'Success')}) </span>
                  </>
                )}
                {isPluginRefundGateway(event?.data?.gateway || event?.paymethod?.gateway) && order?.refund_data && (
                  <span> ({order?.refund_data === 'partially_refunded' ? t('PARTIALLY_REFUNDED', 'Partially Refunded') : t('REFUNDED', 'Refunded')})</span>
                )}
                <EnDotSingle />
              </React.Fragment>
              ))
            )
          : (
            <>
              <span>{order?.paymethod?.name}</span>
              {order?.paymethod?.gateway === 'cash' && order?.cash && (
                <span> ({t('PAY_WITH', 'Pay with')}: {parsePrice(order?.cash, { currency: getCurrenySymbol(order?.currency) })})</span>
              )}
              {stripePaymethods.includes(order?.paymethod?.gateway) && (
                <>
                  <span> (</span>
                  <StripeLink href={`https://dashboard.stripe.com/payments/${order?.pay_data}`} target='_blank'>{order?.pay_data}</StripeLink>
                  <span>) </span>
                  <span> ({order?.refund_data ? t('REFUNDED', 'Refunded') : t('MOBILE_SUCCESS', 'Success')}) </span>
                </>
              )}
              {isPluginRefundGateway(order?.paymethod?.gateway) && order?.refund_data && (
                <span> ({order?.refund_data === 'partially_refunded' ? t('PARTIALLY_REFUNDED', 'Partially Refunded') : t('REFUNDED', 'Refunded')})</span>
              )}
              <EnDotSingle />
            </>
            )}
        {!isServiceOrder && (
          <>
            {order?.delivery_type === 1 && (
              <span>
                {t('DELIVERY', 'Delivery')}
              </span>
            )}
            {order?.delivery_type === 2 && (
              <span>
                {t('PICKUP', 'Pickup')}
              </span>
            )}
            {order?.delivery_type === 3 && (
              <span>
                {t('EAT_IN', 'Eat in')}
              </span>
            )}
            {order?.delivery_type === 4 && (
              <span>
                {t('CURBSIDE', 'Curbside')}
              </span>
            )}
            {order?.delivery_type === 5 && (
              <span>
                {t('DRIVE_THRU', 'Drive thru')}
              </span>
            )}
            {order?.delivery_type === 7 && (
              <span>
                {t('CATERING_DELIVERY', 'Catering delivery')}
              </span>
            )}
            {order?.delivery_type === 8 && (
              <span>
                {t('CATERING_PICKUP', 'Catering pickup')}
              </span>
            )}
            {order?.delivery_type === 9 && (
              <span>
                {t('RESERVATION', 'Reservation')}
              </span>
            )}
          </>
        )}
      </p>
    </OrderDetailsHeaderContainer>
  )
}
