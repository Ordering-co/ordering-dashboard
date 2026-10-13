import React, { useEffect, useMemo, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { BusinessFees as BusinessFeesController, useLanguage, useUtils, useConfig } from '../../../../../index'
import { CheckSquareFill, Square, ArrowClockwise } from 'react-bootstrap-icons'

import { Button, Switch } from '../../../styles'
import { Alert, Confirm, Modal, Pagination, SearchBar } from '../../Shared'
import { BusinessFeeForm } from '../BusinessFeeForm'

import {
  BusinessFeesContainer,
  HeaderContainer,
  HeaderTitleContainer,
  TabsContainer,
  TabButton,
  ActionsWrapper,
  Table,
  Thead,
  Tbody,
  PagesBottomContainer,
  StatusWrapper,
  CheckBoxWrapper,
  FeeIdWrapper,
  FeeNameWrapper,
  Badge,
  EmptyWrapper,
  AmountWrapper,
  EventFormContainer,
  EventFormHeader,
  EventTypeSelector,
  EventTypeOption,
  EventFormField,
  AmountInputWrapper,
  EventFormHint,
  EventFormActions,
  RefreshButton
} from './styles'

const BusinessFeesUI = (props) => {
  const {
    businessId,
    // Fees
    feesList,
    getFees,
    createFee,
    updateFee,
    deleteFees,
    searchValue,
    handleChangeSearch,
    paginationProps,
    setPaginationProps,
    // Fee Events
    feeEventsList,
    getFeeEvents,
    createFeeEvent,
    deleteFeeEvents,
    eventsSearchValue,
    handleChangeEventsSearch,
    eventsPaginationProps,
    setEventsPaginationProps,
    // Dropdowns
    sitesState,
    paymethodsState,
    // Action
    actionState
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const [{ configs }] = useConfig()
  const currencySymbol = configs?.format_number_currency?.value || '$'
  const [activeTab, setActiveTab] = useState('fees')

  const deliveryTypeOptions = useMemo(() => ([
    { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
    { value: 'delivery', content: t('DELIVERY', 'Delivery') },
    { value: 'pickup', content: t('PICKUP', 'Pickup') },
    { value: 'eatin', content: t('EATING', 'Eat in') },
    { value: 'curbside', content: t('CURBSIDE', 'Curbside') },
    { value: 'drive_thru', content: t('DRIVE_THRU', 'Drive thru') },
    { value: 'seat_delivery', content: t('SEAT_DELIVERY', 'Seat delivery') },
    { value: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery') },
    { value: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup') },
    { value: 'reservation', content: t('RESERVATION', 'Reservation') }
  ]), [t])

  const recurringPeriodOptions = useMemo(() => ([
    { value: '', content: t('SELECT_PERIOD', 'Select period') },
    { value: 'weekly', content: t('WEEKLY', 'Weekly') },
    { value: 'monthly', content: t('MONTHLY', 'Monthly') }
  ]), [t])

  const weekDayNames = useMemo(() => [
    t('SUNDAY', 'Sunday'),
    t('MONDAY', 'Monday'),
    t('TUESDAY', 'Tuesday'),
    t('WEDNESDAY', 'Wednesday'),
    t('THURSDAY', 'Thursday'),
    t('FRIDAY', 'Friday'),
    t('SATURDAY', 'Saturday')
  ], [t])

  const formatRecurringInfo = (fee) => {
    if (!fee?.recurring_period) return '-'
    const period = fee.recurring_period === 'weekly'
      ? t('WEEKLY', 'Weekly')
      : t('MONTHLY', 'Monthly')

    if (fee.recurring_day == null) return period

    const day = fee.recurring_period === 'weekly'
      ? weekDayNames[fee.recurring_day]
      : t('DAY_N', 'Day {{day}}').replace('{{day}}', fee.recurring_day)

    return day ? `${period} - ${day}` : period
  }

  const sitesOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
    const list = Array.isArray(sitesState?.sites) ? sitesState.sites : []
    return base.concat(list.map((s) => ({ value: s.id, content: s.name || String(s.id) })))
  }, [sitesState?.sites, t])

  const paymethodsOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_PAYMENT_METHODS', 'All payment methods') }]
    const list = Array.isArray(paymethodsState?.paymethods) ? paymethodsState.paymethods : []
    return base.concat(list.map((p) => ({ value: p.id, content: p.name || String(p.id) })))
  }, [paymethodsState?.paymethods, t])

  const [isOpenFeeForm, setIsOpenFeeForm] = useState(false)
  const [isEditFee, setIsEditFee] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirmState, setConfirmState] = useState({ open: false, content: '', handleOnAccept: null })

  const [feeFormState, setFeeFormState] = useState({
    name: '',
    description: '',
    enabled: true,
    fixed: '',
    percentage: '',
    delivery_type: 'all',
    site_id: 'all',
    paymethod_id: 'all',
    recurring_period: '',
    recurring_day: '',
    taxable: true
  })

  const [isOpenEventForm, setIsOpenEventForm] = useState(false)
  const [eventFormState, setEventFormState] = useState({
    event_type: 'manual_charge',
    name: '',
    total_amount: ''
  })

  const [selectedFeeIds, setSelectedFeeIds] = useState([])
  const [selectedEventIds, setSelectedEventIds] = useState([])

  const handleOpenAlert = (content) => {
    const normalized = Array.isArray(content)
      ? content
      : content
        ? [String(content)]
        : []
    setAlertState({ open: true, content: normalized })
  }

  const isAllFeesChecked = useMemo(() => {
    const items = Array.isArray(feesList?.fees) ? feesList.fees : []
    if (items.length === 0) return false
    return items.every((f) => selectedFeeIds.includes(f.id))
  }, [feesList?.fees, selectedFeeIds])

  const handleToggleFeeId = (e, id) => {
    e?.stopPropagation?.()
    if (!id) return
    setSelectedFeeIds((prev) => {
      const exists = prev.includes(id)
      if (exists) return prev.filter((x) => x !== id)
      return prev.concat(id)
    })
  }

  const handleSelectAllFees = (e) => {
    e?.stopPropagation?.()
    const items = Array.isArray(feesList?.fees) ? feesList.fees : []
    if (items.length === 0) return
    setSelectedFeeIds((prev) => {
      const nextIds = items.map((f) => f.id)
      const allSelected = nextIds.every((id) => prev.includes(id))
      return allSelected ? [] : nextIds
    })
  }

  const handleClickDeleteSelectedFees = () => {
    if (selectedFeeIds.length === 0) return
    setConfirmState({
      open: true,
      content: t('QUESTION_DELETE_FEES', 'Are you sure to delete these fees?'),
      handleOnAccept: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        const res = await deleteFees?.(selectedFeeIds)
        if (res?.error) return
        setSelectedFeeIds([])
      }
    })
  }

  const handleChangeFeesPage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setPaginationProps((prev) => ({ ...prev, currentPage: nextPage }))
    getFees(nextPage, paginationProps.pageSize)
  }

  const handleChangeFeesPageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setPaginationProps((prev) => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getFees(1, nextPageSize)
  }

  const handleResetFeeForm = () => {
    setIsEditFee(false)
    setEditingFeeId(null)
    setFeeFormState({
      name: '',
      description: '',
      enabled: true,
      fixed: '',
      percentage: '',
      delivery_type: 'all',
      site_id: 'all',
      paymethod_id: 'all',
      recurring_period: '',
      recurring_day: '',
      taxable: true
    })
  }

  const handleOpenCreateFee = () => {
    if (!businessId) {
      handleOpenAlert(t('BUSINESS_REQUIRED', 'Business is required'))
      return
    }
    handleResetFeeForm()
    setIsOpenFeeForm(true)
  }

  const handleOpenEditFee = (id) => {
    const fee = (feesList?.fees || []).find((f) => Number(f?.id) === Number(id)) || null
    if (!fee) {
      handleOpenAlert(t('NOT_FOUND', 'Not found'))
      return
    }

    handleResetFeeForm()
    setIsEditFee(true)
    setEditingFeeId(id)
    setIsOpenFeeForm(true)

    const isRecurrent = !!fee?.recurring_period
    let recurringDayValue = ''
    if (isRecurrent) {
      if (fee?.recurring_day != null) {
        recurringDayValue = String(fee.recurring_day)
      } else {
        recurringDayValue = fee?.recurring_period === 'weekly' ? '0' : '1'
      }
    }

    setFeeFormState({
      name: fee?.name ?? '',
      description: fee?.description ?? '',
      enabled: !!fee?.enabled,
      fixed: fee?.fixed != null ? String(fee.fixed) : '',
      percentage: fee?.percentage != null ? String(fee.percentage) : '',
      delivery_type: fee?.delivery_type ?? 'all',
      site_id: fee?.site_id ?? 'all',
      paymethod_id: fee?.paymethod_id ?? 'all',
      recurring_period: fee?.recurring_period ?? '',
      recurring_day: recurringDayValue,
      taxable: typeof fee?.taxable !== 'undefined' ? fee.taxable : true
    })
  }

  const buildFeePayload = () => {
    const name = String(feeFormState.name || '').trim()
    if (!name) return { error: true, result: t('NAME_IS_REQUIRED', 'Name is required') }
    if (name.length > 100) return { error: true, result: t('NAME_MAX_100', 'Name max 100 chars') }

    const fixed = feeFormState.fixed !== '' ? Number(feeFormState.fixed) : 0
    if (Number.isNaN(fixed)) return { error: true, result: t('INVALID_FIXED_VALUE', 'Invalid fixed value') }

    const isRecurrent = !!feeFormState.recurring_period

    let percentage = 0
    if (!isRecurrent) {
      percentage = feeFormState.percentage !== '' ? Number(feeFormState.percentage) : 0
      if (Number.isNaN(percentage)) return { error: true, result: t('INVALID_PERCENTAGE_VALUE', 'Invalid percentage value') }
      if (percentage < 0 || percentage > 100) return { error: true, result: t('PERCENTAGE_RANGE', 'Percentage must be between 0 and 100') }
    }

    let recurringDay = null
    if (isRecurrent) {
      recurringDay = feeFormState.recurring_day !== '' ? Number(feeFormState.recurring_day) : null
      if (recurringDay === null || Number.isNaN(recurringDay)) {
        return { error: true, result: t('RECURRING_DAY_REQUIRED', 'Recurring day is required') }
      }
    }

    const payload = {
      name,
      description: String(feeFormState.description || '').trim(),
      enabled: !!feeFormState.enabled,
      fixed,
      percentage: isRecurrent ? 0 : percentage,
      delivery_type: isRecurrent ? null : (feeFormState.delivery_type === 'all' ? null : feeFormState.delivery_type),
      site_id: isRecurrent ? null : (feeFormState.site_id === 'all' ? null : feeFormState.site_id),
      paymethod_id: isRecurrent ? null : (feeFormState.paymethod_id === 'all' ? null : feeFormState.paymethod_id),
      recurring_period: isRecurrent ? feeFormState.recurring_period : null,
      recurring_day: isRecurrent ? recurringDay : null,
      taxable: typeof feeFormState.taxable !== 'undefined' ? !!feeFormState.taxable : true
    }

    return { error: false, result: payload }
  }

  const handleSubmitFee = async () => {
    const built = buildFeePayload()
    if (built.error) {
      handleOpenAlert(built.result)
      return
    }

    const payload = built.result
    const res = isEditFee
      ? await updateFee?.(editingFeeId, payload)
      : await createFee?.(payload)

    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : (res?.result ? [String(res.result)] : [t('ERROR', 'Error')])
      handleOpenAlert(msg)
      return
    }
    setIsOpenFeeForm(false)
  }

  const handleToggleFeeEnabled = async (id, enabled) => {
    const res = await updateFee?.(id, { enabled: !!enabled })
    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : [t('ERROR', 'Error')]
      handleOpenAlert(msg)
    }
  }

  const isAllEventsChecked = useMemo(() => {
    const items = Array.isArray(feeEventsList?.events) ? feeEventsList.events : []
    // Only select manual events
    const manualEvents = items.filter((e) => e.event_type !== 'order_fee')
    if (manualEvents.length === 0) return false
    return manualEvents.every((e) => selectedEventIds.includes(e.id))
  }, [feeEventsList?.events, selectedEventIds])

  const handleToggleEventId = (e, id, eventType) => {
    e?.stopPropagation?.()
    if (!id) return
    if (eventType === 'order_fee') {
      handleOpenAlert(t('ORDER_FEE_CANNOT_DELETE', 'Order fees cannot be deleted'))
      return
    }
    setSelectedEventIds((prev) => {
      const exists = prev.includes(id)
      if (exists) return prev.filter((x) => x !== id)
      return prev.concat(id)
    })
  }

  const handleSelectAllEvents = (e) => {
    e?.stopPropagation?.()
    const items = Array.isArray(feeEventsList?.events) ? feeEventsList.events : []
    const manualEvents = items.filter((ev) => ev.event_type !== 'order_fee')
    if (manualEvents.length === 0) return
    setSelectedEventIds((prev) => {
      const nextIds = manualEvents.map((ev) => ev.id)
      const allSelected = nextIds.every((id) => prev.includes(id))
      return allSelected ? [] : nextIds
    })
  }

  const handleClickDeleteSelectedEvents = () => {
    if (selectedEventIds.length === 0) return
    setConfirmState({
      open: true,
      content: t('QUESTION_DELETE_FEE_EVENTS', 'Are you sure to delete these fee events?'),
      handleOnAccept: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        const res = await deleteFeeEvents?.(selectedEventIds)
        if (res?.error) return
        setSelectedEventIds([])
      }
    })
  }

  const handleChangeEventsPage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setEventsPaginationProps((prev) => ({ ...prev, currentPage: nextPage }))
    getFeeEvents(nextPage, eventsPaginationProps.pageSize)
  }

  const handleChangeEventsPageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setEventsPaginationProps((prev) => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getFeeEvents(1, nextPageSize)
  }

  const handleResetEventForm = () => {
    setEventFormState({
      event_type: 'manual_charge',
      name: '',
      total_amount: ''
    })
  }

  const handleOpenCreateEvent = () => {
    if (!businessId) {
      handleOpenAlert(t('BUSINESS_REQUIRED', 'Business is required'))
      return
    }
    handleResetEventForm()
    setIsOpenEventForm(true)
  }

  const buildEventPayload = () => {
    const name = String(eventFormState.name || '').trim()
    if (!name) return { error: true, result: t('NAME_IS_REQUIRED', 'Name is required') }

    const totalAmount = Number(eventFormState.total_amount)
    if (Number.isNaN(totalAmount) || totalAmount === 0) {
      return { error: true, result: t('INVALID_AMOUNT', 'Invalid amount') }
    }

    // For credits, the amount should be negative
    const finalAmount = eventFormState.event_type === 'manual_credit'
      ? -Math.abs(totalAmount)
      : Math.abs(totalAmount)

    const payload = {
      event_type: eventFormState.event_type,
      name,
      total_amount: finalAmount
    }

    return { error: false, result: payload }
  }

  const handleSubmitEvent = async () => {
    const built = buildEventPayload()
    if (built.error) {
      handleOpenAlert(built.result)
      return
    }

    const payload = built.result
    const res = await createFeeEvent?.(payload)

    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : (res?.result ? [String(res.result)] : [t('ERROR', 'Error')])
      handleOpenAlert(msg)
      return
    }
    setIsOpenEventForm(false)
  }

  useEffect(() => {
    if (!actionState?.error || actionState?.loading) return
    handleOpenAlert(actionState.error)
  }, [actionState?.error, actionState?.loading])

  const formatCurrency = (amount) => {
    const num = Number(amount)
    if (Number.isNaN(num)) return '-'
    return parsePrice(num)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const utcDate = dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`
    const date = new Date(utcDate)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <BusinessFeesContainer>
        <HeaderContainer>
          <HeaderTitleContainer>
            <h1>{t('BUSINESS_FEES', 'Business Fees')}</h1>
          </HeaderTitleContainer>
        </HeaderContainer>

        <TabsContainer>
          <TabButton
            active={activeTab === 'fees'}
            onClick={() => {
              if (activeTab !== 'fees') {
                handleChangeEventsSearch('')
                setActiveTab('fees')
              }
            }}
          >
            {t('FEES', 'Fees')}
          </TabButton>
          <TabButton
            active={activeTab === 'events'}
            onClick={() => {
              if (activeTab !== 'events') {
                handleChangeSearch('')
                setActiveTab('events')
              }
            }}
          >
            {t('FEE_EVENTS', 'Fee Events')}
          </TabButton>
          <RefreshButton
            onClick={() => {
              if (activeTab === 'fees') {
                getFees(paginationProps?.currentPage, paginationProps?.pageSize)
              } else {
                getFeeEvents(eventsPaginationProps?.currentPage, eventsPaginationProps?.pageSize)
              }
            }}
            disabled={feesList?.loading || feeEventsList?.loading}
            title={t('REFRESH', 'Refresh')}
          >
            <ArrowClockwise />
          </RefreshButton>
        </TabsContainer>

        {/* ========== Fees Tab ========== */}
        {activeTab === 'fees' && (
          <>
            <HeaderContainer>
              <SearchBar
                placeholder={t('SEARCH', 'Search')}
                onSearch={handleChangeSearch}
                search={searchValue}
                lazyLoad
              />
              <ActionsWrapper>
                <Button
                  color='lightPrimary'
                  borderRadius='8px'
                  disabled={selectedFeeIds.length === 0 || actionState?.loading}
                  onClick={handleClickDeleteSelectedFees}
                >
                  {t('DELETE', 'Delete')}
                </Button>
                <Button
                  color='primary'
                  borderRadius='8px'
                  onClick={handleOpenCreateFee}
                  disabled={actionState?.loading || !businessId}
                >
                  {t('ADD_NEW', 'Add new')}
                </Button>
              </ActionsWrapper>
            </HeaderContainer>

            {feesList?.loading
              ? (
                  <div style={{ marginTop: 20 }}>
                    <Skeleton height={40} count={8} />
                  </div>
                )
              : (
                  <>
                    {(feesList?.fees?.length > 0)
                      ? (
                          <Table>
                            <Thead>
                              <tr>
                                <th style={{ width: 45 }}>
                                  <CheckBoxWrapper onClick={handleSelectAllFees} isChecked={isAllFeesChecked}>
                                    {isAllFeesChecked ? <CheckSquareFill /> : <Square />}
                                  </CheckBoxWrapper>
                                </th>
                                <th>ID</th>
                                <th>{t('NAME', 'Name')}</th>
                                <th>{t('TYPE', 'Type')}</th>
                                <th>{t('AMOUNT', 'Amount')}</th>
                                <th>{t('STATUS', 'Status')}</th>
                              </tr>
                            </Thead>
                            <Tbody>
                              {(feesList?.fees || []).map((fee) => {
                                const isChecked = selectedFeeIds.includes(fee?.id)
                                const isRecurrent = !!fee?.recurring_period
                                return (
                                  <tr
                                    key={fee.id}
                                    role='row'
                                    tabIndex={0}
                                    onClick={() => handleOpenEditFee(fee.id)}
                                  >
                                    <td>
                                      <CheckBoxWrapper
                                        isChecked={isChecked}
                                        onClick={(e) => handleToggleFeeId(e, fee.id)}
                                      >
                                        {isChecked ? <CheckSquareFill /> : <Square />}
                                      </CheckBoxWrapper>
                                    </td>
                                    <td>
                                      <FeeIdWrapper>{fee.id}</FeeIdWrapper>
                                    </td>
                                    <td><FeeNameWrapper>{fee?.name}</FeeNameWrapper></td>
                                    <td>
                                      {isRecurrent
                                        ? formatRecurringInfo(fee)
                                        : t('PER_ORDER', 'Per order')}
                                    </td>
                                    <td>
                                      {isRecurrent
                                        ? (fee?.fixed != null ? formatCurrency(fee.fixed) : '-')
                                        : `${fee?.fixed != null ? formatCurrency(fee.fixed) : formatCurrency(0)} + ${fee?.percentage != null ? fee.percentage : 0}%`}
                                    </td>
                                    <td>
                                      <StatusWrapper>
                                        <p>{t('ENABLE', 'Enable')}</p>
                                        <span
                                          className='enable_control'
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          role='button'
                                          tabIndex={-1}
                                        >
                                          <Switch
                                            defaultChecked={!!fee?.enabled}
                                            onChange={(val) => handleToggleFeeEnabled(fee.id, val)}
                                          />
                                        </span>
                                      </StatusWrapper>
                                    </td>
                                  </tr>
                                )
                              })}
                            </Tbody>
                          </Table>
                        )
                      : (
                          <EmptyWrapper>
                            {t('NO_FEES', 'No fees found')}
                          </EmptyWrapper>
                        )}

                    <PagesBottomContainer>
                      <Pagination
                        currentPage={paginationProps?.currentPage}
                        totalPages={paginationProps?.totalPages}
                        defaultPageSize={paginationProps?.pageSize}
                        handleChangePage={handleChangeFeesPage}
                        handleChangePageSize={handleChangeFeesPageSize}
                      />
                    </PagesBottomContainer>
                  </>
                )}
          </>
        )}

        {/* ========== Fee Events Tab ========== */}
        {activeTab === 'events' && (
          <>
            <HeaderContainer>
              <SearchBar
                placeholder={t('SEARCH', 'Search')}
                onSearch={handleChangeEventsSearch}
                search={eventsSearchValue}
                lazyLoad
              />
              <ActionsWrapper>
                <Button
                  color='lightPrimary'
                  borderRadius='8px'
                  disabled={selectedEventIds.length === 0 || actionState?.loading}
                  onClick={handleClickDeleteSelectedEvents}
                >
                  {t('DELETE', 'Delete')}
                </Button>
                <Button
                  color='primary'
                  borderRadius='8px'
                  onClick={handleOpenCreateEvent}
                  disabled={actionState?.loading || !businessId}
                >
                  {t('ADD_MANUAL', 'Add manual')}
                </Button>
              </ActionsWrapper>
            </HeaderContainer>

            {feeEventsList?.loading
              ? (
                  <div style={{ marginTop: 20 }}>
                    <Skeleton height={40} count={8} />
                  </div>
                )
              : (
                  <>
                    {(feeEventsList?.events?.length > 0)
                      ? (
                          <Table>
                            <Thead>
                              <tr>
                                <th style={{ width: 45 }}>
                                  <CheckBoxWrapper onClick={handleSelectAllEvents} isChecked={isAllEventsChecked}>
                                    {isAllEventsChecked ? <CheckSquareFill /> : <Square />}
                                  </CheckBoxWrapper>
                                </th>
                                <th style={{ width: '30%' }}>{t('NAME', 'Name')}</th>
                                <th style={{ width: '20%' }}>{t('TYPE', 'Type')}</th>
                                <th style={{ width: '20%' }}>{t('AMOUNT', 'Amount')}</th>
                                <th style={{ width: '25%' }}>{t('DATE', 'Date')}</th>
                              </tr>
                            </Thead>
                            <Tbody>
                              {(feeEventsList?.events || []).map((event) => {
                                const isOrderFee = event?.event_type === 'order_fee'
                                const isChecked = selectedEventIds.includes(event?.id)
                                const amount = Number(event?.total_amount)
                                const isNegative = amount < 0
                                const isPositive = amount > 0

                                return (
                                  <tr
                                    key={event.id}
                                    className={isOrderFee ? 'readonly' : ''}
                                    onClick={(e) => isOrderFee ? null : handleToggleEventId(e, event.id, event?.event_type)}
                                  >
                                    <td>
                                      <CheckBoxWrapper
                                        isChecked={isChecked}
                                      >
                                        {isChecked ? <CheckSquareFill /> : <Square />}
                                      </CheckBoxWrapper>
                                    </td>
                                    <td><FeeNameWrapper style={{ maxWidth: '100%', WebkitLineClamp: 2 }}>{event?.name}</FeeNameWrapper></td>
                                    <td>
                                      <Badge type={event?.event_type}>
                                        {event?.event_type === 'order_fee' && t('ORDER_FEE', 'Order Fee')}
                                        {event?.event_type === 'manual_charge' && t('MANUAL_CHARGE', 'Manual Charge')}
                                        {event?.event_type === 'manual_credit' && t('MANUAL_CREDIT', 'Manual Credit')}
                                      </Badge>
                                    </td>
                                    <td>
                                      <AmountWrapper isNegative={isNegative} isPositive={isPositive}>
                                        {formatCurrency(event?.total_amount)}
                                      </AmountWrapper>
                                    </td>
                                    <td>{formatDate(event?.created_at)}</td>
                                  </tr>
                                )
                              })}
                            </Tbody>
                          </Table>
                        )
                      : (
                          <EmptyWrapper>
                            {t('NO_FEE_EVENTS', 'No fee events found')}
                          </EmptyWrapper>
                        )}

                    <PagesBottomContainer>
                      <Pagination
                        currentPage={eventsPaginationProps?.currentPage}
                        totalPages={eventsPaginationProps?.totalPages}
                        defaultPageSize={eventsPaginationProps?.pageSize}
                        handleChangePage={handleChangeEventsPage}
                        handleChangePageSize={handleChangeEventsPageSize}
                      />
                    </PagesBottomContainer>
                  </>
                )}
          </>
        )}
      </BusinessFeesContainer>

      {/* Fee Form Modal */}
      {isOpenFeeForm && (
        <Modal
          width='700px'
          height='650px'
          open={isOpenFeeForm}
          onClose={() => setIsOpenFeeForm(false)}
          padding='0'
        >
          <BusinessFeeForm
            isEdit={isEditFee}
            actionLoading={actionState?.loading}
            formState={feeFormState}
            setFormState={setFeeFormState}
            handleSubmit={handleSubmitFee}
            deliveryTypeOptions={deliveryTypeOptions}
            recurringPeriodOptions={recurringPeriodOptions}
            sitesOptions={sitesOptions}
            paymethodsOptions={paymethodsOptions}
          />
        </Modal>
      )}

      {/* Manual Event Form Modal */}
      {isOpenEventForm && (
        <Modal
          width='480px'
          open={isOpenEventForm}
          onClose={() => setIsOpenEventForm(false)}
          padding='0'
        >
          <EventFormContainer>
            <EventFormHeader>
              <h2>{t('ADD_MANUAL_FEE_EVENT', 'Add Manual Fee Event')}</h2>
            </EventFormHeader>

            <EventTypeSelector>
              <EventTypeOption
                isSelected={eventFormState.event_type === 'manual_charge'}
                isCharge
                onClick={() => setEventFormState((prev) => ({ ...prev, event_type: 'manual_charge' }))}
              >
                <div className='icon'>↑</div>
                <div className='label'>{t('CHARGE', 'Charge')}</div>
                <div className='description'>{t('ADD_CHARGE_DESC', 'Add a charge to business')}</div>
              </EventTypeOption>
              <EventTypeOption
                isSelected={eventFormState.event_type === 'manual_credit'}
                onClick={() => setEventFormState((prev) => ({ ...prev, event_type: 'manual_credit' }))}
              >
                <div className='icon'>↓</div>
                <div className='label'>{t('CREDIT', 'Credit')}</div>
                <div className='description'>{t('ADD_CREDIT_DESC', 'Add a credit to business')}</div>
              </EventTypeOption>
            </EventTypeSelector>

            <EventFormField>
              <label>
                {t('NAME', 'Name')}<span>*</span>
              </label>
              <input
                type='text'
                value={eventFormState.name}
                onChange={(e) => setEventFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('ENTER_EVENT_NAME', 'e.g., Setup fee, Adjustment, Refund...')}
              />
            </EventFormField>

            <EventFormField>
              <label>
                {t('AMOUNT', 'Amount')}<span>*</span>
              </label>
              <AmountInputWrapper>
                <span className='currency-symbol'>{currencySymbol}</span>
                <input
                  type='number'
                  step='0.01'
                  min='0'
                  value={eventFormState.total_amount}
                  onChange={(e) => setEventFormState((prev) => ({ ...prev, total_amount: e.target.value }))}
                  placeholder='0.00'
                />
              </AmountInputWrapper>
              <EventFormHint isCredit={eventFormState.event_type === 'manual_credit'}>
                {eventFormState.event_type === 'manual_credit'
                  ? t('CREDIT_HINT', 'This amount will be credited to the business balance')
                  : t('CHARGE_HINT', 'This amount will be charged to the business')}
              </EventFormHint>
            </EventFormField>

            <EventFormActions>
              <Button
                color='secundaryDark'
                borderRadius='8px'
                onClick={() => setIsOpenEventForm(false)}
              >
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button
                color='primary'
                borderRadius='8px'
                onClick={handleSubmitEvent}
                disabled={actionState?.loading}
              >
                {actionState?.loading ? t('SAVING', 'Saving...') : t('SAVE', 'Save')}
              </Button>
            </EventFormActions>
          </EventFormContainer>
        </Modal>
      )}

      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />

      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirmState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirmState.open}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onAccept={confirmState.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const BusinessFees = (props) => {
  const businessId = props?.businessId
  const businessFeesProps = {
    ...props,
    businessId,
    UIComponent: BusinessFeesUI
  }

  return <BusinessFeesController {...businessFeesProps} />
}
