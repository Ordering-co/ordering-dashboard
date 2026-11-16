import React, { useContext } from 'react'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { Button, StatusBadge, cx } from '../../Shared/Product'
import { ChevronLeft } from '../../Shared/Icon'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { getOrderStatusPrefix } from '../../../utils/orderStatus'
import { getCurrenySymbol } from '../../../utils/billFormatting'
import './inbox.css'

// redesign messages B3b (decision 1A): the order in brief, on the head of the conversation: who, which order, in what state, for
// which store, with which driver, how it is delivered and for how much. «View order» opens the order panel of /orders.
// The labels of the delivery types are the ones of OrderDetailsHeader.
const DELIVERY_KINDS = [1, 7]

// the chevron points to the start of the line: it mirrors in RTL (Button takes an icon component, IconButton's flipInRtl is not on it)
const BackIcon = ({ className, ...props }) => <ChevronLeft {...props} className={cx(className, 'odc-icon-flip')} />

const fullName = person => [person?.name, person?.lastname].filter(Boolean).join(' ')

export const ConversationHeader = ({ order, onOpenOrder, onBack, backRef }) => {
  const [{ dictionary }, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [configState] = useConfig()
  const configFileState = useContext(ConfigFileContext)
  const prefixForVariable = configFileState?.[0]?.app_internal_name?.toUpperCase()
  if (!order) return null

  const deliveryTypes = {
    1: t('DELIVERY', 'Delivery'),
    2: t('PICKUP', 'Pickup'),
    3: t('EAT_IN', 'Eat in'),
    4: t('CURBSIDE', 'Curbside'),
    5: t('DRIVE_THRU', 'Drive thru'),
    7: t('CATERING_DELIVERY', 'Catering delivery'),
    8: t('CATERING_PICKUP', 'Catering pickup'),
    9: t('RESERVATION', 'Reservation')
  }

  // the number, the external id and the status text are worked out exactly as OrdersCards does
  const showExternalId = configState?.configs?.change_order_id?.value === '1'
  const orderNumber = (showExternalId && !!order.external_id) ? order.external_id : order.id
  const isReservation = parseInt(order.delivery_type, 10) === 9 && parseInt(order.status, 10) === 13
  const statusText = isReservation
    ? (dictionary?.RESERVATION ?? t('RESERVATION', 'Reservation'))
    : getOrderStatusPrefix(order.status, dictionary, prefixForVariable)

  const customerName = fullName(order.customer) || t('CUSTOMER', 'Customer')
  const driver = order.driver || order.external_driver
  const deliveryType = deliveryTypes[parseInt(order.delivery_type, 10)]
  const address = DELIVERY_KINDS.includes(parseInt(order.delivery_type, 10)) ? order.customer?.address : null
  const total = order.summary?.total ?? order.total

  return (
    <header className='odi-head' data-slot='conversation-header'>
      <div className='odi-head-main'>
        {onBack && (
          <Button ref={backRef} variant='ghost' icon={BackIcon} data-back='' onClick={onBack} className='odi-back'>
            {t('BACK', 'Back')}
          </Button>
        )}
        <h2 className='odi-name'>{customerName}</h2>
        <span className='odi-number'>#<bdi className='odc-figure'>{orderNumber}</bdi></span>
        <StatusBadge family={getOrderStatusFamily(order.status)} label={statusText} />
        <span className='odi-spacer' />
        <Button onClick={() => onOpenOrder?.(order)}>{t('VIEW_ORDER', 'View order')}</Button>
      </div>
      <ul className='odi-facts'>
        <li className='odi-fact'>
          <span className='odc-muted'>{t('BUSINESS', 'Business')}</span>
          <span className='odi-value'>{order.business?.name}</span>
        </li>
        <li className='odi-fact'>
          <span className='odc-muted'>{t('DRIVER', 'Driver')}</span>
          <span className='odi-value'>{driver ? fullName(driver) : t('NOT_ASSIGNED', 'Not assigned')}</span>
          {/* redesign messages R1 (P-03): main's card showed the company of the driver under the name */}
          {!!order.driver_company?.name && <span className='odi-value odc-muted'>{order.driver_company.name}</span>}
        </li>
        {deliveryType && (
          <li className='odi-fact'>
            <span className={address ? 'odc-muted' : 'odi-value'}>{deliveryType}</span>
            {address && <span className='odi-value'>{address}</span>}
          </li>
        )}
        {total != null && (
          <li className='odi-fact'>
            <span className='odc-muted'>{t('TOTAL', 'Total')}</span>
            <span className='odi-value odc-figure'>{parsePrice(total, { currency: getCurrenySymbol(order.currency) })}</span>
          </li>
        )}
        {/* redesign messages R1 (P-03): the proof-of-delivery code of main's card */}
        {!!order.codigoPod && (
          <li className='odi-fact'>
            <span className='odc-muted'>{t('PODS', 'Pod')}</span>
            <span className='odi-value odc-figure'>{order.codigoPod}</span>
          </li>
        )}
      </ul>
    </header>
  )
}
