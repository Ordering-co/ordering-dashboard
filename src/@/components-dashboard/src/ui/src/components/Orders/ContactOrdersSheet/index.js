import React, { useEffect, useState } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useTheme } from 'styled-components'
import { OrdersManager } from '../OrdersManager'
import { Avatar, IconButton, Sheet } from '../../Shared/Product'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import './contact-orders-sheet.css'

/**
 * redesign W1-1 (T1-2): the orders of a driver, a customer or a business, as a lateral Product Sheet
 * (it replaces the old fixed lateral bar). The width is the Sheet's own data-* state, never an inline style:
 * 600px normal, 1100px while an order is open inside (the order opens as the Sheet on top, so Escape
 * closes only that one), full width when expanded (see contact-orders-sheet.css).
 * `open` is kept apart from the mount so the Sheet plays its exit and gives the focus back to the opener.
 */
export const ContactOrdersSheet = (props) => {
  const {
    open,
    user,
    business,
    isDriver,
    isCustomer,
    isBusiness,
    onClose,
    statusGroup,
    returnFocus
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const theme = useTheme()
  const { width } = useWindowSize()

  const [isExpand, setIsExpand] = useState(false)
  const [isOrderOpen, setIsOrderOpen] = useState(false)

  useEffect(() => {
    if (open) return
    setIsExpand(false)
    setIsOrderOpen(false)
  }, [open])

  const role = (isDriver && t('DRIVER', 'Driver')) || (isCustomer && t('CUSTOMER', 'Customer')) || (isBusiness && t('BUSINESS', 'Business')) || ''
  const name = isBusiness
    ? (business?.name ?? '')
    : [user?.name, user?.lastname].filter(Boolean).join(' ')
  const photo = isBusiness
    ? optimizeImage(business?.logo || theme.images?.dummies?.businessLogo, 'h_50,c_limit')
    : optimizeImage(user?.photo || theme.images?.icons?.noDriver, 'h_50,c_limit')

  // Same rule as before: below 1000px the order never widens the panel.
  const isWide = isOrderOpen && width >= 1000

  // redesign drivers-dashboard B2 (DD-06): `statusGroup` is opt-in. Only when it comes is it passed on, with a `key` so that a second
  // opening with another group remounts (OrdersManage reads it once, on mount). Without it: the same props as before, no new key.
  const hasStatusGroup = statusGroup !== undefined && statusGroup !== null
  const statusGroupProps = hasStatusGroup ? { statusGroup } : {}

  return (
    <Sheet
      open={!!open}
      onOpenChange={(next) => { if (!next) onClose() }}
      title={name || role}
      closeLabel={t('CLOSE', 'Close')}
      side='end'
      className='odc-contact-sheet'
      returnFocus={returnFocus} // opt-in, where the focus goes when the sheet opened from the URL
      data-wide={isWide ? '' : undefined}
      data-expanded={isExpand ? '' : undefined}
    >
      <div className='odc-contact-head'>
        <Avatar name={name} src={photo} kind={isBusiness ? 'business' : 'person'} size='lg' />
        <p className='odc-contact-role'>{role}</p>
        {width > 576 && (
          <IconButton
            icon={isExpand ? Minimize2 : Maximize2}
            label={isExpand ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
            aria-expanded={isExpand}
            onClick={() => setIsExpand(prev => !prev)}
          />
        )}
      </div>
      <OrdersManager
        key={hasStatusGroup ? statusGroup : undefined}
        {...statusGroupProps}
        isLateralBar
        isSelectedOrders
        driverId={isDriver ? user.id : null}
        customerId={isCustomer ? user.id : null}
        businessId={isBusiness ? business.id : null}
        handleCustomOrderDetail={setIsOrderOpen}
        disableSocketRoomDriver
      />
    </Sheet>
  )
}
