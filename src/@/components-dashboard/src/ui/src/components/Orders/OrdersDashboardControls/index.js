import React from 'react'
import { useHistory } from 'react-router-dom'
import { useConfig, useLanguage, useSession } from '../../../../../index'
import { IconButton } from '../../Shared/Product'
import { Plus } from '../../Shared/Icon'
import { useLearnMenuItems } from '../../Shared/UI/LearnDropDown'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign W1-1 (T1-1): was useOrderCardsViewport (OrdersTable/OrderCard)
import { OrderStatusTypeSelector } from '../OrderStatusTypeSelector'
import { OrdersExportCSV } from '../OrdersExportCSV'
import { OrderDelete } from '../OrderDelete'
import { CreateCustomOrder } from '../CreateCustomOrder'
import {
  OrderDashboardControlsContainer,
  InnerContnet,
  WrapOrderStatusTypeSelector
} from './styles'

export const OrdersDashboardControls = (props) => {
  const {
    selectedOrderNumber,
    filterValues,
    handleDeleteMultiOrders,
    handleChangeMultiOrdersStatus,
    handleOpenCustomOrderDetail,
    handleOpenOrderDetail,
    ordersStatusGroup,
    selectedSubOrderStatus,
    franchiseId,
    variant,
    hideBulk,
    isOpenOrderDetail,
    learnOptions
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const [{ configs }] = useConfig()
  const history = useHistory()
  // redesign 5.6-B: under 768px of viewport (the cut of the cards and of the page head).
  const isPhone = useIsPhone()
  const learnItems = useLearnMenuItems(learnOptions)

  // The «+» of the phone head opens what the header button opens: CreateCustomOrder reads
  // `?add=custom_order` once (the command palette and the empty state use it too), keeping the other params.
  const handleOpenCreate = () => {
    const params = new URLSearchParams(window.location.search)
    params.set('add', 'custom_order')
    history?.replace({ pathname: history.location?.pathname ?? window.location.pathname, search: `?${params}` })
  }

  // redesign 5.2-A: on /orders the page head carries only New order and Export (the
  // bulk actions live in the selection bar of the table). /all-in-one keeps the
  // default variant with the bulk actions, as before.
  // redesign page-bugs Y (W1 review F2): /all-in-one below 1024px keeps the two bulk actions in a sticky selection bar (AllInOne)
  // instead of this row, which scrolls away with the list. `variant='bulk'` draws only those actions, with the wrappers and the
  // labels /orders gives them in its own bar (OrdersListing); `hideBulk` leaves them out of the row so there is one copy of each.
  if (variant === 'bulk') {
    const count = selectedOrderNumber ?? 0
    const canChangeStatus = (user?.level !== 5 || configs?.allow_driver_manager_batch_update_order_status?.value === '1') &&
      typeof handleChangeMultiOrdersStatus === 'function'
    const canDelete = user?.level !== 5 && typeof handleDeleteMultiOrders === 'function'
    const statusLabel = count === 1
      ? t('BULK_CHANGE_STATUS_ONE', 'Change status of 1 order')
      : t('BULK_CHANGE_STATUS_MANY', 'Change status of _count_ orders').replace('_count_', count)
    const deleteLabel = count === 1
      ? t('BULK_DELETE_ONE', 'Delete 1 order')
      : t('BULK_DELETE_MANY', 'Delete _count_ orders').replace('_count_', count)
    return (
      <>
        {canChangeStatus && (
          <span className='odc-orders-bulk' role='group' aria-label={statusLabel} title={statusLabel}>
            <WrapOrderStatusTypeSelector>
              <OrderStatusTypeSelector
                orderControl
                isFirstSelect
                noPadding
                mutiOrdersChange
                noSelected
                defaultValue='default'
                type='primary'
                handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
              />
            </WrapOrderStatusTypeSelector>
          </span>
        )}
        {canDelete && (
          <span className='odc-orders-bulk' data-tone='danger' role='group' aria-label={deleteLabel} title={deleteLabel}>
            <OrderDelete triggerVariant='selection' count={count} handleDeleteMultiOrders={handleDeleteMultiOrders} />
          </span>
        )}
      </>
    )
  }

  if (variant === 'header' && isPhone) {
    // Phones: a «+» (same condition as the button: level zero) and the «More actions» menu, which is
    // the export menu with the Learn articles after the export options. CreateCustomOrder stays
    // mounted, for its sheet and its `?add` listener, with its own button hidden (hidden host). The
    // wrappers are not `data-action`: the legacy dress of content-header.css must not reach these buttons.
    return (
      <div className='odc-header-actions' data-phone=''>
        {user?.level === 0 && (
          <div data-phone-action='create'>
            <IconButton
              icon={Plus}
              label={t('CREATE_CUSTOM_ORDER', 'Create custom order')}
              variant='primary'
              onClick={handleOpenCreate}
            />
          </div>
        )}
        <div data-phone-action='export'>
          <OrdersExportCSV
            variant='more'
            extraItems={learnItems}
            filterValues={filterValues}
            ordersStatusGroup={ordersStatusGroup}
            selectedSubOrderStatus={selectedSubOrderStatus}
            franchiseId={franchiseId}
          />
        </div>
        <div hidden>
          <CreateCustomOrder handleOpenCustomOrderDetail={handleOpenCustomOrderDetail} handleOpenOrderDetail={handleOpenOrderDetail} />
        </div>
      </div>
    )
  }

  if (variant === 'header') {
    return (
      <div className='odc-header-actions'>
        <div data-action='export'>
          <OrdersExportCSV
            filterValues={filterValues}
            ordersStatusGroup={ordersStatusGroup}
            selectedSubOrderStatus={selectedSubOrderStatus}
            franchiseId={franchiseId}
          />
        </div>
        {/* With the order panel open its footer owns the primary action (C4): this one steps back. */}
        <div data-action='create' data-emphasis={isOpenOrderDetail ? 'secondary' : undefined}>
          <CreateCustomOrder handleOpenCustomOrderDetail={handleOpenCustomOrderDetail} handleOpenOrderDetail={handleOpenOrderDetail} />
        </div>
      </div>
    )
  }

  return (
    <>
      <OrderDashboardControlsContainer>
        <InnerContnet>
          <CreateCustomOrder handleOpenCustomOrderDetail={handleOpenCustomOrderDetail} handleOpenOrderDetail={handleOpenOrderDetail} />
          <OrdersExportCSV
            filterValues={filterValues}
            ordersStatusGroup={ordersStatusGroup}
            selectedSubOrderStatus={selectedSubOrderStatus}
            franchiseId={franchiseId}
          />
          {!hideBulk && selectedOrderNumber > 0 && (
            <>
              {user?.level !== 5 && (
                <OrderDelete
                  count={selectedOrderNumber}
                  handleDeleteMultiOrders={handleDeleteMultiOrders}
                />
              )}
              {(user?.level !== 5 || configs?.allow_driver_manager_batch_update_order_status?.value === '1') && (
                <WrapOrderStatusTypeSelector>
                  <OrderStatusTypeSelector
                    orderControl
                    isFirstSelect
                    noPadding
                    mutiOrdersChange
                    noSelected
                    defaultValue='default'
                    type='primary'
                    handleChangeMultiOrdersStatus={handleChangeMultiOrdersStatus}
                  />
                </WrapOrderStatusTypeSelector>
              )}
            </>
          )}
        </InnerContnet>
      </OrderDashboardControlsContainer>
    </>
  )
}
