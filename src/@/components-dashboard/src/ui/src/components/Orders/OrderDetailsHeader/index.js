import React, { useContext, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'

import { useLanguage, useSession, useConfig, useUtils } from '../../../../../index'
import { capitalize, getCurrenySymbol, getOrderStatusPrefix } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { ConfirmAdmin } from '../../Shared'
import {
  IconButton,
  ConfirmDialog,
  Menu,
  Switch,
  StatusBadge,
  useSplitView
} from '../../Shared/Product'
import {
  ArrowLeft,
  Bike,
  Clock,
  Copy,
  Ellipsis,
  Globe,
  ListChecks,
  Maximize2,
  Minimize2,
  Printer,
  Settings,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  Calendar,
  Wallet,
  X
} from '../../Shared/Icon'
import { useOrderTrackingLink } from '../OrderTrackingLink'
import { defaultTicketSections, ticketSectionList } from '../OrderToPrintTicket/ticketSections'
import './order-details-header.css'

const STRIPE_GATEWAYS = ['stripe', 'stripe_connect']
const BRAINTREE_GATEWAYS = ['braintree', 'paypal_braintree', 'google_pay_braintree', 'apple_pay_braintree']
const NOT_PREPAID_GATEWAYS = ['cash', 'card_delivery']

// Icon of each delivery type; the label is the one the header always had.
const DELIVERY_TYPES = {
  1: { icon: Truck, key: 'DELIVERY', label: 'Delivery' },
  2: { icon: ShoppingBag, key: 'PICKUP', label: 'Pickup' },
  3: { icon: Store, key: 'EAT_IN', label: 'Eat in' },
  4: { icon: Store, key: 'CURBSIDE', label: 'Curbside' },
  5: { icon: Store, key: 'DRIVE_THRU', label: 'Drive thru' },
  7: { icon: Bike, key: 'CATERING_DELIVERY', label: 'Catering delivery' },
  8: { icon: ShoppingBag, key: 'CATERING_PICKUP', label: 'Catering pickup' },
  9: { icon: Calendar, key: 'RESERVATION', label: 'Reservation' }
}

export const OrderDetailsHeader = (props) => {
  const {
    order,
    handleShowOption,
    handleDeleteOrder,
    actionSidebar,
    setIsTourOpen,
    isTourOpen,
    currentTourStep,
    printRef,
    printTicketRef,
    isServiceOrder,
    isExpand,
    setIsExpand,
    getPluginRefundProvider,
    ticketSections,
    onTicketSectionChange,
    onTicketSectionsLoad
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const configFileState = useContext(ConfigFileContext)
  const { mode, guardPlaceChange } = useSplitView()
  const [confirmAdmin, setConfirmAdmin] = useState({ open: false, handleOnConfirm: null })
  // redesign fix-qa E5: the tracking link is two direct items of «More actions» (as in `main`), with the
  // domain dialog owned by the hook.
  const tracking = useOrderTrackingLink(order)
  // (main #480): «Ticket sections…» picks what the kitchen ticket prints, then prints it
  const [showTicketSections, setShowTicketSections] = useState(false)
  const sections = ticketSections ?? defaultTicketSections

  // redesign fix-qa E8: react-to-print focuses a hidden iframe to print and removes it afterwards, which left the
  // focus on <body>. When it is done (printed or cancelled) the focus goes back to the Print trigger.
  const headerRef = useRef(null)
  const restorePrintFocus = () => headerRef.current?.querySelector('[data-print-trigger]')?.focus()
  const printNormal = useReactToPrint({ content: () => printRef?.current, removeAfterPrint: true, onAfterPrint: restorePrintFocus })
  const printTicket = useReactToPrint({ content: () => printTicketRef?.current, removeAfterPrint: true, onAfterPrint: restorePrintFocus })

  const isPhone = mode === 'full'
  // During step 1 of the Learn tour the actions the tour does not teach stay out of reach.
  const tourLocked = !!isTourOpen && currentTourStep === 1
  const showExternalId = configs?.change_order_id?.value === '1'
  const prefixForVariable = configFileState?.[0]?.app_internal_name?.toUpperCase()

  const isPluginRefundGateway = (gateway) =>
    typeof getPluginRefundProvider === 'function'
      ? !!getPluginRefundProvider(gateway)
      : BRAINTREE_GATEWAYS.includes(gateway)

  const walletName = {
    cash: t('CASH_WALLET_NAME', 'Cash wallet'),
    credit_point: t('POINTS_WALLET', 'Points Wallet')
  }

  const closeSideBar = () => {
    actionSidebar(false)
    if (isTourOpen && currentTourStep === 1) setIsTourOpen(false)
  }

  const handleDeleteOpen = () => {
    setConfirmAdmin({
      open: true,
      // ConfirmAdmin checks the password or the code server-side (action `orders_delete`) and
      // hands over the one-time confirmation_token the DELETE now carries.
      handleOnConfirm: (token) => {
        setConfirmAdmin({ open: false, handleOnConfirm: null })
        closeSideBar()
        handleDeleteOrder(token || null, [order.id])
      }
    })
  }

  // What the status says: the exact status name, like the table. A reservation that is still
  // a preorder reads as Reservation.
  const statusLabel = (() => {
    const isReservationPreorder = parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13
    return isReservationPreorder
      ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
      : getOrderStatusPrefix(order?.status, dictionary, prefixForVariable)
  })()

  // One entry per payment, with what the line used to say for it: the method, the cash
  // amount, the Stripe dashboard link with its state and the plugin refund state.
  const payments = (() => {
    if (order?.payment_events?.length > 0) {
      return order.payment_events.filter(item => item.event === 'payment').map((event, index) => {
        const gateway = event?.data?.gateway || event?.paymethod?.gateway
        const label = event?.wallet_event
          ? walletName[event?.wallet_event?.wallet?.type]
          : event?.paymethod
            ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
            : t(
              (event?.data?.gateway || order?.paymethod?.gateway)?.toUpperCase(),
              capitalize(event?.data?.gateway || order?.paymethod?.name || '')
            )
        return {
          key: index,
          label,
          gateway,
          cash: event?.paymethod?.gateway === 'cash',
          payData: event?.data?.result?.pay_data || event?.data?.extra?.pay_data,
          notPrepaid: NOT_PREPAID_GATEWAYS.includes(event?.paymethod?.gateway)
        }
      })
    }
    return [{
      key: 'order',
      label: order?.paymethod?.name,
      gateway: order?.paymethod?.gateway,
      cash: order?.paymethod?.gateway === 'cash',
      payData: order?.pay_data,
      notPrepaid: NOT_PREPAID_GATEWAYS.includes(order?.paymethod?.gateway)
    }]
  })()

  const refundLabel = (payment) => {
    if (STRIPE_GATEWAYS.includes(payment.gateway)) {
      return order?.refund_data ? t('REFUNDED', 'Refunded') : t('MOBILE_SUCCESS', 'Success')
    }
    if (isPluginRefundGateway(payment.gateway) && order?.refund_data) {
      return order?.refund_data === 'partially_refunded' ? t('PARTIALLY_REFUNDED', 'Partially Refunded') : t('REFUNDED', 'Refunded')
    }
    return null
  }

  const deliveryType = !isServiceOrder ? DELIVERY_TYPES[order?.delivery_type] : null
  const DeliveryIcon = deliveryType?.icon

  const printItems = [
    { key: 'normal', label: t('NORMAL', 'Normal'), onSelect: () => printNormal() },
    { key: 'ticket', label: t('TICKET', 'Ticket'), onSelect: () => printTicket() },
    ...(onTicketSectionChange
      ? [{
          key: 'ticket-sections',
          label: `${t('TICKET_SECTIONS', 'Ticket sections')}…`,
          icon: Settings,
          separatorBefore: true,
          onSelect: () => {
            onTicketSectionsLoad?.()
            setShowTicketSections(true)
          }
        }]
      : [])
  ]

  const moreItems = [
    ...(!order?.cloned_order_id && order?.customer_id && user?.level === 0
      ? [{ key: 'clone', label: `${t('CLONE_ORDER', 'Clone order')}…`, icon: Copy, onSelect: () => handleShowOption('clone_order') }]
      : []),
    { key: 'fields', label: t('CUSTOM_FIELDS', 'Custom fields'), icon: ListChecks, onSelect: () => handleShowOption('metafields') },
    ...tracking.menuItems,
    ...(handleDeleteOrder
      ? [{ key: 'delete', label: `${t('DELETE_ORDER', 'Delete order')}…`, icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: handleDeleteOpen }]
      : [])
  ]

  return (
    <header ref={headerRef} className='odc-root odc-od-head'>
      <div className='odc-od-head-row'>
        {isPhone && (
          <IconButton
            icon={ArrowLeft}
            flipInRtl
            label={t('BACK_TO_ORDERS', 'Back to orders')}
            onClick={closeSideBar}
          />
        )}
        <h2 className='odc-od-title'>
          {isServiceOrder
            ? <>{t('APPOINTMENT_NO', 'Appointment No.')} <bdi dir='ltr' className='odc-mono'>{order.id}</bdi></>
            : <bdi dir='ltr' className='odc-mono'>#{order.id}</bdi>}
        </h2>
        {/* its own box, like the skeleton's, so a narrow panel can give it the whole line. */}
        <span className='odc-od-head-status'>
          <StatusBadge family={getOrderStatusFamily(order?.status)} label={statusLabel} />
        </span>
        <span className='odc-od-spacer' />
        <div className='odc-od-head-actions'>
          <Menu
            label={t('PRINT', 'Print')}
            icon={Printer}
            items={printItems}
            triggerProps={{ disabled: tourLocked, 'data-print-trigger': '' }}
          />
          <Menu
            label={t('MORE_ACTIONS', 'More actions')}
            icon={Ellipsis}
            items={moreItems}
            triggerProps={{ disabled: tourLocked }}
          />
          {!isPhone && setIsExpand && (
            <IconButton
              icon={isExpand ? Minimize2 : Maximize2}
              label={isExpand ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
              // Owner decision 22 B (2026-10-21): from the overlay the move to a page asks the panel's guard first (the chat draft)
              onClick={() => guardPlaceChange(() => setIsExpand(prev => !prev))}
            />
          )}
          {!isPhone && (
            <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={closeSideBar} />
          )}
        </div>
      </div>
      <div className='odc-od-meta' data-testid='order-meta'>
        {order?.created_at && (
          <span>
            <Clock className='odc-icon odc-od-meta-icon' />
            <span className='odc-od-meta-text'>{t('CREATED_AT', 'Created at')} <bdi dir='ltr'>{parseDate(order.created_at)}</bdi></span>
          </span>
        )}
        {deliveryType && (
          <span>
            <DeliveryIcon className='odc-icon odc-od-meta-icon' />
            <span className='odc-od-meta-text'>{t(deliveryType.key, deliveryType.label)}</span>
          </span>
        )}
        {payments.filter(payment => payment.label).map(payment => {
          const state = refundLabel(payment)
          return (
            <span key={payment.key}>
              <Wallet className='odc-icon odc-od-meta-icon' />
              <span className='odc-od-meta-text'>
                {payment.label}
                {payment.cash && order?.cash && (
                  <> ({t('PAY_WITH', 'Pay with')}: {parsePrice(order?.cash, { currency: getCurrenySymbol(order?.currency) })})</>
                )}
                {STRIPE_GATEWAYS.includes(payment.gateway) && payment.payData && (
                  <>
                    {' ('}
                    <a
                      className='odc-od-link'
                      href={`https://dashboard.stripe.com/payments/${payment.payData}`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {payment.payData}
                    </a>
                    {')'}
                  </>
                )}
                {state && <> ({state})</>}
              </span>
              {payment.notPrepaid && <StatusBadge family='pending' label={t('PAYMENT_NOT_PREPAID', 'Not prepaid')} />}
            </span>
          )
        })}
        {order?.app_id && (
          <span>
            <Globe className='odc-icon odc-od-meta-icon' />
            <span className='odc-od-meta-text'>{order.app_id}</span>
          </span>
        )}
        {showExternalId && order?.external_id && (
          <span>
            <span className='odc-od-meta-text'>{t('EXTERNAL_ID', 'External ID')}</span>
            <span className='odc-od-meta-text odc-mono'>{order.external_id}</span>
          </span>
        )}
      </div>
      {tracking.dialog}
      <ConfirmAdmin
        open={confirmAdmin.open}
        action='orders_delete'
        title={t('DELETE_ORDER_TITLE', 'Delete order #_id_?').replace('_id_', order?.id)}
        // redesign F6d (Q3-13): the button says the verb with the object, not a generic «Confirm».
        confirmLabel={t('DELETE_ORDER', 'Delete order')}
        description={t('DELETE_ORDERS_CONFIRM_DESCRIPTION', 'Type your password to confirm. This can’t be undone.')}
        onClose={() => setConfirmAdmin({ open: false, handleOnConfirm: null })}
        onConfirm={confirmAdmin.handleOnConfirm}
      />
      <ConfirmDialog
        open={showTicketSections}
        tone='primary'
        title={t('TICKET_SECTIONS', 'Ticket sections')}
        confirmLabel={t('PRINT_TICKET', 'Print ticket')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setShowTicketSections(false)}
        onConfirm={() => {
          setShowTicketSections(false)
          printTicket()
        }}
      >
        <p>{t('TICKET_SECTIONS_HINT', 'Choose the sections, then print the ticket. The total always prints.')}</p>
        <ul className='odc-od-ticket-sections'>
          {ticketSectionList.map(section => (
            <li key={section.key}>
              <Switch
                defaultChecked={sections[section.key] !== false}
                onCheckedChange={(enabled) => onTicketSectionChange?.(section.key, enabled)}
              >
                {t(section.labelKey, section.label)}
              </Switch>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </header>
  )
}
