import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useApi, useLanguage, useSession } from '../../../../../index'
import { Select } from '../../../styles/Select'
import { Select as FirstSelect } from '../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../styles/MultiSelect'
import { Alert } from '../../Shared'
import { useSelectSurface } from '../../Shared/UI/selectPlacement'
import { OrderStatusRegressionModal } from '../OrderStatusRegressionModal'
import { getHiddenOrderStatuses, isFinalOrderStatusLocked } from '../../../utils'
import { Option, PlaceholderTitle, OrderStatusTypeSelectWrapper } from './styles'

export const OrderStatusTypeSelector = (props) => {
  const {
    isFirstSelect,
    defaultValue,
    deliveryType,
    mutiOrdersChange,
    orderId,
    type,
    orderControl,
    noPadding,
    noSelected,
    isFilterView,
    filterValues,
    handleUpdateOrderStatus,
    handleChangeMultiOrdersStatus,
    handleChangeOrderStatus,
    viewOnly,
    hideErrorAlert,
    placement,
    ariaLabel
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ user }] = useSession()
  const [defaultOptionValue, setDefaultOptionValue] = useState('default')
  const [filteredOrderStatuses, setFilteredOrderStatuses] = useState([])
  const [searchValue, setSearchValue] = useState(null)
  const [selectResetKey, setSelectResetKey] = useState(0)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [regressionRequest, setRegressionRequest] = useState(null)
  const [regressionLoading, setRegressionLoading] = useState(false)
  const wrapperRef = useRef(null)

  // redesign F2 (C18): inside the orders surfaces the rows are plain text and the groups are headings the
  // select draws itself; outside them the legacy blocks (rule, padding) stay.
  const c18 = !!useSelectSurface().fitTrigger
  const row = (text) => c18 ? <span>{text}</span> : <Option noPadding={noPadding}><p>{text}</p></Option>
  const heading = (text) => c18 ? <span>{text}</span> : <Option noPadding={noPadding} isSubTitle><p>{text}</p></Option>

  const placeholder = <PlaceholderTitle><p>{t('SELECT_STATUS', 'Select Status')}</p></PlaceholderTitle>
  // redesign F6h-4 (A2): the list is named with its field, not with the current value drawn in the trigger. The bulk bar's
  // field is «Change status»; the footer of the order and the filter, «Order status». A consumer can pass its own.
  const fieldLabel = ariaLabel || (mutiOrdersChange ? t('CHANGE_STATUS', 'Change status') : t('ORDER_STATUS', 'Order status'))

  const hiddenOrderStatuses = getHiddenOrderStatuses(ordering?.project)
  const isStatusLocked = !mutiOrdersChange && !isFilterView && isFinalOrderStatusLocked(ordering?.project, user?.level, defaultValue)

  const orderStatuses = [
    {
      value: 'default',
      name: t('CHANGE_STATUS', 'Change status'),
      content: row(t('CHANGE_STATUS', 'Change status')),
      disabled: true,
      showDisable: true
    },
    {
      value: 'pending',
      name: t('PENDING', 'Pending'),
      content: heading(t('PENDING', 'Pending')),
      group: c18 || undefined,
      disabled: true
    },
    {
      value: 0,
      name: t('PENDING', 'Pending'),
      content: row(t('PENDING', 'Pending')),
      color: 'primary'
    },
    {
      value: 13,
      name: t('PREORDER', 'Preorder'),
      content: row(t('PREORDER', 'Preorder')),
      color: 'primary',
      disabled: true
    },
    {
      value: 'inProgress',
      name: t('IN_PROGRESS', 'In Progress'),
      content: heading(t('IN_PROGRESS', 'In Progress')),
      group: c18 || undefined,
      disabled: true
    },
    {
      value: 7,
      name: t('ACCEPTED_BY_BUSINESS', 'Accepted by business'),
      content: row(t('ACCEPTED_BY_BUSINESS', 'Accepted by business')),
      color: 'primary'
    },
    {
      value: 4,
      name: t('PREPARATION_COMPLETED', 'Preparation completed'),
      content: row(t('PREPARATION_COMPLETED', 'Preparation completed')),
      color: 'primary'
    },
    {
      value: 8,
      name: t('ACCEPTED_BY_DRIVER', 'Accepted by driver'),
      content: row(t('ACCEPTED_BY_DRIVER', 'Accepted by driver')),
      color: 'primary'
    },
    {
      value: 3,
      name: t('ORDER_STATUS_IN_BUSINESS', 'Driver arrived to business'),
      content: row(t('ORDER_STATUS_IN_BUSINESS', 'Driver arrived to business')),
      color: 'primary'
    },
    {
      value: 9,
      name: t('PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver'),
      content: row(t('PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver')),
      color: 'primary'
    },
    {
      value: 14,
      name: t('ORDER_NOT_READY', 'Order not ready'),
      content: row(t('ORDER_NOT_READY', 'Order not ready')),
      color: 'primary'
    },
    {
      value: 18,
      name: t('ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS', 'Driver almost arrived to business'),
      content: row(t('ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS', 'Driver almost arrived to business')),
      color: 'primary'
    },
    {
      value: 19,
      name: t('ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER', 'Driver almost arrived to customer'),
      content: row(t('ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER', 'Driver almost arrived to customer')),
      color: 'primary'
    },
    {
      value: 20,
      name: t('ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS', 'Customer almost arrived to business'),
      content: row(t('ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS', 'Customer almost arrived to business')),
      color: 'primary'
    },
    {
      value: 21,
      name: t('ORDER_CUSTOMER_ARRIVED_BUSINESS', 'Customer arrived to business'),
      content: row(t('ORDER_CUSTOMER_ARRIVED_BUSINESS', 'Customer arrived to business')),
      color: 'primary'
    },
    {
      value: 22,
      name: t('ORDER_LOOKING_FOR_DRIVER', 'Looking for driver'),
      content: row(t('ORDER_LOOKING_FOR_DRIVER', 'Looking for driver')),
      color: 'primary'
    },
    {
      value: 23,
      name: t('ORDER_DRIVER_ON_WAY', 'Driver on way'),
      content: row(t('ORDER_DRIVER_ON_WAY', 'Driver on way')),
      color: 'primary'
    },
    {
      value: 24,
      name: t('ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order'),
      content: row(t('ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order')),
      color: 'primary'
    },
    {
      value: 25,
      name: t('ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company'),
      content: row(t('ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company')),
      color: 'primary'
    },
    {
      value: 26,
      name: t('ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer'),
      content: row(t('ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer')),
      color: 'primary'
    },
    {
      value: null,
      name: t('COMPLETED', 'Completed'),
      content: heading(t('COMPLETED', 'Completed')),
      group: c18 || undefined,
      disabled: true
    },
    {
      value: 1,
      name: t('COMPLETED_BY_ADMIN', 'Completed by Admin'),
      content: row(t('COMPLETED_BY_ADMIN', 'Completed by Admin')),
      color: 'primary'
    },
    {
      value: 11,
      name: t('DELIVERY_COMPLETED_BY_DRIVER', 'Delivery Completed by Driver'),
      content: row(t('DELIVERY_COMPLETED_BY_DRIVER', 'Delivery Completed by Driver')),
      color: 'primary'
    },
    {
      value: 15,
      name: t('ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer'),
      content: row(t('ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer')),
      color: 'primary'
    },
    {
      value: null,
      name: t('CANCELLED', 'Cancelled'),
      content: heading(t('CANCELLED', 'Cancelled')),
      group: c18 || undefined,
      disabled: true
    },
    {
      value: 2,
      name: t('REJECTED_BY_ADMIN', 'Rejected by Admin'),
      content: row(t('REJECTED_BY_ADMIN', 'Rejected by Admin')),
      color: 'primary'
    },
    {
      value: 5,
      name: t('REJECTED_BY_BUSINESS', 'Rejected by Business'),
      content: row(t('REJECTED_BY_BUSINESS', 'Rejected by Business')),
      color: 'primary'
    },
    {
      value: 6,
      name: t('REJECTED_BY_DRIVER', 'Rejected by driver'),
      content: row(t('REJECTED_BY_DRIVER', 'Rejected by driver')),
      color: 'primary'
    },
    {
      value: 10,
      name: t('PICK_UP_FAILED_BY_DRIVER', 'Pickup Failed by Driver'),
      content: row(t('PICK_UP_FAILED_BY_DRIVER', 'Pickup Failed by Driver')),
      color: 'primary'
    },
    {
      value: 12,
      name: t('DELIVERY_FAILED_BY_DRIVER', 'Delivery failed by driver'),
      content: row(t('DELIVERY_FAILED_BY_DRIVER', 'Delivery failed by driver')),
      color: 'primary'
    },
    {
      value: 16,
      name: t('ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer'),
      content: row(t('ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer')),
      color: 'primary'
    },
    {
      value: 17,
      name: t('ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer'),
      content: row(t('ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer')),
      color: 'primary'
    }
  ]

  const revertStatusSelection = (previousStatus) => {
    setDefaultOptionValue(previousStatus)
    setSelectResetKey((key) => key + 1)
  }

  const changeOrderStatus = async (orderStatus) => {
    if (orderStatus === 'default' || orderStatus === defaultValue || isStatusLocked) return
    const previousStatus = defaultValue ?? defaultOptionValue
    if (!mutiOrdersChange) {
      const response = await handleUpdateOrderStatus({ id: orderId, newStatus: orderStatus })
      if (response?.regressionRequired) {
        setRegressionRequest({ newStatus: orderStatus, previousStatus })
        return
      }
      if (response?.error) {
        revertStatusSelection(previousStatus)
        if (!hideErrorAlert) {
          setAlertState({ open: true, content: response.result })
        }
      }
      return
    }
    handleChangeMultiOrdersStatus(orderStatus)
  }

  const handleSubmitRegressionReason = async (reasons) => {
    setRegressionLoading(true)
    const response = await handleUpdateOrderStatus({ id: orderId, newStatus: regressionRequest.newStatus, reasons })
    setRegressionLoading(false)
    if (response?.error) {
      revertStatusSelection(regressionRequest.previousStatus)
      if (!hideErrorAlert) {
        setAlertState({ open: true, content: response.result })
      }
    }
    setRegressionRequest(null)
  }

  const handleCancelRegressionReason = () => {
    revertStatusSelection(regressionRequest.previousStatus)
    setRegressionRequest(null)
  }

  useEffect(() => {
    if (!isFilterView) {
      if (orderControl) {
        setFilteredOrderStatuses(orderStatuses)
      } else {
        let _filteredOrderStatuses = []
        let extractOrderStatus = []
        switch (deliveryType) {
          case 1:
            _filteredOrderStatuses = orderStatuses
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 2:
            extractOrderStatus = orderStatuses.slice(0, 7)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(13, 15)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 3:
            extractOrderStatus = orderStatuses.slice(0, 3)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(4, 7)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 4:
            extractOrderStatus = orderStatuses.slice(0, 7)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(13, 15)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 5:
            extractOrderStatus = orderStatuses.slice(0, 7)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(13, 15)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 7:
            _filteredOrderStatuses = orderStatuses
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 8:
            extractOrderStatus = orderStatuses.slice(0, 7)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(13, 15)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          case 9:
            extractOrderStatus = orderStatuses.slice(0, 3)
            _filteredOrderStatuses = [...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(4, 7)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(10, 11)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(20, 22)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(23, 26)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            extractOrderStatus = orderStatuses.slice(30, 31)
            _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]
            if (searchValue) {
              _filteredOrderStatuses = [..._filteredOrderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
          default:
            if (searchValue) {
              _filteredOrderStatuses = [...orderStatuses?.filter(orderStatus => orderStatus?.name.toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))]
            }
            setFilteredOrderStatuses(_filteredOrderStatuses)
            break
        }
      }
    } else {
      let _filteredOrderStatuses = []
      let extractOrderStatus = []
      extractOrderStatus = orderStatuses.slice(2, 4)
      _filteredOrderStatuses = [...extractOrderStatus]

      extractOrderStatus = orderStatuses.slice(5, 17)
      _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]

      extractOrderStatus = orderStatuses.slice(18, 21)
      _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]

      extractOrderStatus = orderStatuses.slice(22, 29)
      _filteredOrderStatuses = [..._filteredOrderStatuses, ...extractOrderStatus]

      setFilteredOrderStatuses(_filteredOrderStatuses)
    }
  }, [deliveryType, searchValue])

  useEffect(() => {
    setDefaultOptionValue(defaultValue)
  }, [defaultValue])

  const filterChangeOrderStatus = (status) => {
    handleChangeOrderStatus(status)
  }

  const [defaultFilterValues, setDefaultFilterValues] = useState([])

  useEffect(() => {
    if (isFilterView) {
      const _defaultFilterValues = [...filterValues.statuses]
      setDefaultFilterValues(_defaultFilterValues)
    }
  }, [filterValues])

  const handleChangeSearch = (searchValue) => {
    setSearchValue(searchValue)
  }

  // redesign fix-qa E6: the list of the order panel footer (the one that asks for a `placement`) has no
  // "Pending" group title above the "Pending" option: the same word twice read as two choices. The
  // title is only taken out of what is drawn; the option lists keep their positions (they are cut by index).
  const isFooterList = !!placement
  const visibleOrderStatuses = useMemo(() => {
    // (C18: the same in every list inside the orders surfaces, the bulk one of the selection bar included)
    const withoutDuplicate = isFooterList || c18
      ? filteredOrderStatuses.filter(orderStatus => orderStatus?.value !== 'pending')
      : filteredOrderStatuses
    if (!hiddenOrderStatuses.length) return withoutDuplicate
    return withoutDuplicate.filter(orderStatus => !hiddenOrderStatuses.includes(orderStatus?.value) || orderStatus?.value === defaultValue)
  }, [filteredOrderStatuses, hiddenOrderStatuses, defaultValue, isFooterList, c18])

  // redesign fix-qa E6: the footer list opens on the current status (it is long, and the status of a
  // finished order is at the bottom). The select draws the list itself and has no hook for this, so the
  // wrapper waits for a listbox to appear and brings the selected option into view (the select already
  // marks it with aria-selected and data-selected).
  useEffect(() => {
    if (!isFooterList || isFilterView) return
    const root = wrapperRef.current
    if (!root || typeof MutationObserver === 'undefined') return
    const reveal = () => {
      root.querySelector('[role="listbox"] [role="option"][aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
    }
    const opened = node => node.nodeType === 1 && (node.matches?.('[role="listbox"]') || !!node.querySelector?.('[role="listbox"]'))
    let frame = 0
    const observer = new MutationObserver(mutations => {
      if (!mutations.some(mutation => Array.from(mutation.addedNodes).some(opened))) return
      reveal()
      // the select caps the list height right after it opens: look again once that is laid out
      frame = window.requestAnimationFrame(reveal)
    })
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [isFooterList, isFilterView])

  if (isFilterView) {
    return (
      <MultiSelect
        className='order-status-multi-select'
        optionInnerMaxHeight='50vh'
        placeholder={placeholder}
        ariaLabel={fieldLabel}
        defaultValue={defaultFilterValues}
        options={filteredOrderStatuses}
        onChange={(orderStatus) => filterChangeOrderStatus(orderStatus)}
      />
    )
  } else {
    return (
      <OrderStatusTypeSelectWrapper ref={wrapperRef}>
        {isFirstSelect
          ? (
            <FirstSelect
              key={selectResetKey}
              searchBarIsCustomLayout
              searchBarIsNotLazyLoad
              searchBarPlaceholder={t('SEARCH', 'Search')}
              type={type}
              placeholder={heading(t('CHANGE_STATUS', 'Change status'))}
              optionInnerMaxHeight='50vh'
              noSelected={noSelected}
              defaultValue={defaultOptionValue}
              options={visibleOrderStatuses}
              onChange={(orderStatus) => changeOrderStatus(orderStatus)}
              className='orderStatus'
              isShowSearchBar
              searchValue={searchValue}
              handleChangeSearch={handleChangeSearch}
              isDisabled={viewOnly || isStatusLocked}
              placement={placement ?? (c18 && mutiOrdersChange ? 'top' : undefined)}
              ariaLabel={fieldLabel}
              listMaxInlineSize='var(--od-x-panel-narrow)'
            />
            )
          : (
            <Select
              key={selectResetKey}
              searchBarIsCustomLayout
              searchBarIsNotLazyLoad
              searchBarPlaceholder={t('SEARCH', 'Search')}
              type={type}
              placeholder={heading(t('CHANGE_STATUS', 'Change status'))}
              optionInnerMaxHeight='50vh'
              noSelected={noSelected}
              defaultValue={defaultOptionValue}
              options={visibleOrderStatuses}
              searchValue={searchValue}
              onChange={(orderStatus) => changeOrderStatus(orderStatus)}
              className='orderStatus'
            />
            )}
        {!hideErrorAlert && (
          <Alert
            title={t('WEB_APPNAME', 'Ordering')}
            content={alertState.content}
            acceptText={t('ACCEPT', 'Accept')}
            open={alertState.open}
            onClose={() => setAlertState({ open: false, content: [] })}
            onAccept={() => setAlertState({ open: false, content: [] })}
            closeOnBackdrop={false}
          />
        )}
        <OrderStatusRegressionModal
          open={!!regressionRequest}
          orderId={orderId}
          currentStatus={regressionRequest?.previousStatus}
          newStatus={regressionRequest?.newStatus}
          loading={regressionLoading}
          onSubmit={handleSubmitRegressionReason}
          onClose={handleCancelRegressionReason}
        />
      </OrderStatusTypeSelectWrapper>
    )
  }
}
