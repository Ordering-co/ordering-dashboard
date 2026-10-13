import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const BusinessFees = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    businessId,
    isSearchById,
    isSearchByName
  } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const token = session?.token

  const firstRender = useRef(true)
  const [searchValue, setSearchValue] = useState(null)
  const [eventsSearchValue, setEventsSearchValue] = useState(null)

  // Fees list state
  const [feesList, setFeesList] = useState({
    loading: false,
    error: null,
    fees: []
  })

  // Fee events list state
  const [feeEventsList, setFeeEventsList] = useState({
    loading: false,
    error: null,
    events: []
  })

  // Sites state
  const [sitesState, setSitesState] = useState({
    loading: false,
    error: null,
    sites: []
  })

  // Paymethods state
  const [paymethodsState, setPaymethodsState] = useState({
    loading: false,
    error: null,
    paymethods: []
  })

  // Action state
  const [actionState, setActionState] = useState({ loading: false, error: null })

  // Pagination for fees
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1)
      ? paginationSettings.initialPage
      : 1,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null,
    from: null,
    to: null
  })

  // Pagination for events
  const [eventsPaginationProps, setEventsPaginationProps] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: null,
    totalPages: null,
    from: null,
    to: null
  })

  const handleChangeSearch = (search) => {
    setSearchValue(search)
  }

  const handleChangeEventsSearch = (search) => {
    setEventsSearchValue(search)
  }

  const calcTotalPages = (totalItems, pageSize) => {
    const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    const safeTotalItems = Number(totalItems) >= 0 ? Number(totalItems) : 0
    return Math.max(1, Math.ceil(safeTotalItems / safePageSize))
  }

  // Helper functions for fees list management
  const addFeeToList = (fee) => {
    if (!fee?.id) return
    setFeesList((prev) => {
      const current = Array.isArray(prev?.fees) ? prev.fees : []
      const without = current.filter((f) => f?.id !== fee.id)
      if (paginationProps.currentPage !== 1) {
        return { ...prev, fees: without }
      }
      const safePageSize = Number(paginationProps.pageSize) >= 1 ? Number(paginationProps.pageSize) : 10
      const next = [...without, fee].slice(-safePageSize)
      return { ...prev, fees: next }
    })
    setPaginationProps((prev) => {
      const nextTotal = (prev.totalItems ?? 0) + 1
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      return {
        ...prev,
        pageSize: safePageSize,
        totalItems: nextTotal,
        totalPages,
        currentPage: prev.currentPage ?? 1
      }
    })
  }

  const updateFeeInList = (fee) => {
    if (!fee?.id) return
    setFeesList((prev) => {
      const current = Array.isArray(prev?.fees) ? prev.fees : []
      const next = current.map((f) => (f?.id === fee.id ? { ...f, ...fee } : f))
      return { ...prev, fees: next }
    })
  }

  const removeFeesFromList = (ids) => {
    const idList = Array.isArray(ids) ? ids : []
    if (!idList.length) return
    setFeesList((prev) => {
      const current = Array.isArray(prev?.fees) ? prev.fees : []
      const next = current.filter((f) => !idList.includes(f?.id))
      return { ...prev, fees: next }
    })
    setPaginationProps((prev) => {
      const nextTotal = Math.max(0, (prev.totalItems ?? 0) - idList.length)
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      const currentPage = Math.min(prev.currentPage ?? 1, totalPages)
      return { ...prev, pageSize: safePageSize, totalItems: nextTotal, totalPages, currentPage }
    })
  }

  // Helper functions for fee events list management
  const addFeeEventToList = (event) => {
    if (!event?.id) return
    setFeeEventsList((prev) => {
      const current = Array.isArray(prev?.events) ? prev.events : []
      const without = current.filter((e) => e?.id !== event.id)
      if (eventsPaginationProps.currentPage !== 1) {
        return { ...prev, events: without }
      }
      const safePageSize = Number(eventsPaginationProps.pageSize) >= 1 ? Number(eventsPaginationProps.pageSize) : 10
      const next = [event, ...without].slice(0, safePageSize)
      return { ...prev, events: next }
    })
    setEventsPaginationProps((prev) => {
      const nextTotal = (prev.totalItems ?? 0) + 1
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      return {
        ...prev,
        pageSize: safePageSize,
        totalItems: nextTotal,
        totalPages,
        currentPage: prev.currentPage ?? 1
      }
    })
  }

  const removeFeeEventsFromList = (ids) => {
    const idList = Array.isArray(ids) ? ids : []
    if (!idList.length) return
    setFeeEventsList((prev) => {
      const current = Array.isArray(prev?.events) ? prev.events : []
      const next = current.filter((e) => !idList.includes(e?.id))
      return { ...prev, events: next }
    })
    setEventsPaginationProps((prev) => {
      const nextTotal = Math.max(0, (prev.totalItems ?? 0) - idList.length)
      const safePageSize = Number(prev.pageSize) >= 1 ? Number(prev.pageSize) : 10
      const totalPages = calcTotalPages(nextTotal, safePageSize)
      const currentPage = Math.min(prev.currentPage ?? 1, totalPages)
      return { ...prev, pageSize: safePageSize, totalItems: nextTotal, totalPages, currentPage }
    })
  }

  const getSites = async () => {
    if (!token) return
    if (session?.user?.level !== 0) return
    try {
      setSitesState((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/sites?params=id,name`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setSitesState({ loading: false, error: content?.result, sites: [] })
        return
      }
      const sites = Array.isArray(content?.result) ? content.result : []
      setSitesState({ loading: false, error: null, sites })
    } catch (err) {
      setSitesState({ loading: false, error: [err?.message || 'Unknown error'], sites: [] })
    }
  }

  const getPaymethods = async () => {
    if (!token) return
    if (session?.user?.level !== 0) return
    try {
      setPaymethodsState((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const whereCondition = JSON.stringify([{ attribute: 'enabled', value: true }])
      const response = await fetch(`${ordering.root}/paymethods?where=${whereCondition}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        setPaymethodsState({ loading: false, error: content?.result, paymethods: [] })
        return
      }
      const paymethods = Array.isArray(content?.result) ? content.result : []
      setPaymethodsState({ loading: false, error: null, paymethods })
    } catch (err) {
      setPaymethodsState({ loading: false, error: [err?.message || 'Unknown error'], paymethods: [] })
    }
  }

  const getFees = async (page, pageSize) => {
    if (!token || !businessId || feesList.loading) return
    if (session?.user?.level !== 0) {
      setFeesList((prev) => ({ ...prev, loading: false, error: ['Only administrators can manage business fees'], fees: [] }))
      return
    }
    try {
      setFeesList((prev) => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : (paginationProps.pageSize ?? 10)

      const conditions = [
        { attribute: 'type', value: 'business' },
        { attribute: 'target', value: 'business' },
        { attribute: 'business_id', value: businessId }
      ]

      if (searchValue) {
        const searchConditions = []

        if (isSearchById) {
          searchConditions.push({
            attribute: 'id',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          })
        }

        if (isSearchByName) {
          searchConditions.push({
            attribute: 'name',
            value: {
              condition: 'ilike',
              value: encodeURI(`%${searchValue}%`)
            }
          })
        }

        if (searchConditions.length) {
          conditions.push({
            conector: 'OR',
            conditions: searchConditions
          })
        }
      }

      const where = {
        conditions,
        conector: 'AND'
      }

      const fetchEndpoint = `${ordering.root}/fees?orderBy=-id&page=${safePage}&page_size=${safePageSize}&where=${JSON.stringify(where)}`
      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()

      if (content?.error) {
        setFeesList((prev) => ({
          ...prev,
          loading: false,
          error: content?.result
        }))
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      setFeesList({
        loading: false,
        error: null,
        fees: result
      })

      if (content?.pagination) {
        const serverPageSize = Number(content.pagination.page_size)
        const nextPageSize = serverPageSize >= 1 ? serverPageSize : safePageSize
        const serverTotalPages = Number(content.pagination.total_pages)
        setPaginationProps((prev) => ({
          ...prev,
          currentPage: content.pagination.current_page ?? safePage,
          pageSize: nextPageSize,
          totalItems: (Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)),
          totalPages: (serverTotalPages >= 1
            ? serverTotalPages
            : calcTotalPages((Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)), nextPageSize)),
          from: content.pagination.from ?? prev.from,
          to: content.pagination.to ?? prev.to
        }))
      } else {
        setPaginationProps((prev) => ({
          ...prev,
          currentPage: safePage,
          pageSize: safePageSize,
          totalPages: safePage,
          totalItems: result.length,
          from: 1,
          to: result.length
        }))
      }

      firstRender.current = false
    } catch (err) {
      if (err?.constructor?.name === 'Cancel') return
      setFeesList((prev) => ({
        ...prev,
        loading: false,
        error: [err?.message || 'Unknown error']
      }))
    }
  }

  const getFeeEvents = async (page, pageSize) => {
    if (!token || !businessId || feeEventsList.loading) return
    if (session?.user?.level !== 0) {
      setFeeEventsList((prev) => ({ ...prev, loading: false, error: ['Only administrators can manage business fee events'], events: [] }))
      return
    }

    try {
      setFeeEventsList((prev) => ({ ...prev, loading: true, error: null }))

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : (eventsPaginationProps.pageSize ?? 10)

      let fetchEndpoint = `${ordering.root}/business/${businessId}/fee_events?orderBy=-id&page=${safePage}&page_size=${safePageSize}`

      if (eventsSearchValue) {
        const conditions = []
        conditions.push({
          attribute: 'name',
          value: {
            condition: 'ilike',
            value: encodeURI(`%${eventsSearchValue}%`)
          }
        })
        const where = { conditions, conector: 'AND' }
        fetchEndpoint += `&where=${JSON.stringify(where)}`
      }

      const response = await fetch(fetchEndpoint, requestOptions)
      const content = await response.json()

      if (content?.error) {
        setFeeEventsList((prev) => ({
          ...prev,
          loading: false,
          error: content?.result
        }))
        return
      }

      const result = Array.isArray(content?.result) ? content.result : []
      setFeeEventsList({
        loading: false,
        error: null,
        events: result
      })

      if (content?.pagination) {
        const serverPageSize = Number(content.pagination.page_size)
        const nextPageSize = serverPageSize >= 1 ? serverPageSize : safePageSize
        const serverTotalPages = Number(content.pagination.total_pages)
        setEventsPaginationProps((prev) => ({
          ...prev,
          currentPage: content.pagination.current_page ?? safePage,
          pageSize: nextPageSize,
          totalItems: (Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)),
          totalPages: (serverTotalPages >= 1
            ? serverTotalPages
            : calcTotalPages((Number(content.pagination.total) >= 0 ? Number(content.pagination.total) : (prev.totalItems ?? result.length)), nextPageSize)),
          from: content.pagination.from ?? prev.from,
          to: content.pagination.to ?? prev.to
        }))
      } else {
        setEventsPaginationProps((prev) => ({
          ...prev,
          currentPage: safePage,
          pageSize: safePageSize,
          totalPages: safePage,
          totalItems: result.length,
          from: 1,
          to: result.length
        }))
      }
    } catch (err) {
      if (err?.constructor?.name === 'Cancel') return
      setFeeEventsList((prev) => ({
        ...prev,
        loading: false,
        error: [err?.message || 'Unknown error']
      }))
    }
  }

  const createFee = async (changes) => {
    if (!token) return
    if (!businessId) return
    if (session?.user?.level !== 0) return

    const fixed = Number(changes?.fixed) || 0
    const percentage = Number(changes?.percentage) || 0
    const isRecurring = !!changes?.recurring_period

    if (isRecurring && fixed === 0) {
      return { error: true, result: [t('RECURRING_FEE_REQUIRES_FIXED', 'Recurring fees require a fixed amount')] }
    }

    if (!isRecurring && fixed === 0 && percentage === 0) {
      return { error: true, result: [t('FEE_REQUIRES_AMOUNT', 'Fee requires a fixed amount or percentage')] }
    }

    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })

      const payload = {
        ...changes,
        type: 'business',
        target: 'business',
        business_id: businessId
      }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/fees`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      addFeeToList(content?.result)
      showToast?.(ToastType.Success, t('FEE_CREATED', 'Fee created'))
      return content
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const updateFee = async (id, changes) => {
    if (!token) return
    if (session?.user?.level !== 0) return

    const hasAmountChanges = 'fixed' in changes || 'percentage' in changes || 'recurring_period' in changes
    if (hasAmountChanges) {
      const fixed = Number(changes?.fixed) || 0
      const percentage = Number(changes?.percentage) || 0
      const isRecurring = !!changes?.recurring_period

      if (isRecurring && fixed === 0) {
        showToast?.(ToastType.Error, t('RECURRING_FEE_REQUIRES_FIXED', 'Recurring fees require a fixed amount'))
        return { error: true, result: [t('RECURRING_FEE_REQUIRES_FIXED', 'Recurring fees require a fixed amount')] }
      }

      if (!isRecurring && fixed === 0 && percentage === 0) {
        showToast?.(ToastType.Error, t('FEE_REQUIRES_AMOUNT', 'Fee requires a fixed amount or percentage'))
        return { error: true, result: [t('FEE_REQUIRES_AMOUNT', 'Fee requires a fixed amount or percentage')] }
      }
    }

    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })

      const payload = {
        ...changes,
        type: 'business',
        target: 'business'
      }

      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/fees/${id}`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      updateFeeInList(content?.result)
      showToast?.(ToastType.Success, t('CHANGES_SAVED', 'Changes saved'))
      return content
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const deleteFees = async (ids) => {
    if (!token) return
    if (session?.user?.level !== 0) return
    const list = Array.isArray(ids) ? ids : []
    if (list.length === 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const errors = []
      for (const id of list) {
        const response = await fetch(`${ordering.root}/fees/${id}`, requestOptions)
        const content = await response.json()
        if (content?.error) {
          const msg = Array.isArray(content?.result) ? content.result.join(', ') : String(content?.result || 'Error')
          errors.push(`#${id}: ${msg}`)
        }
      }

      if (errors.length) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: errors })
        return { error: true, result: errors }
      }

      setActionState({ loading: false, error: null })
      removeFeesFromList(list)
      showToast?.(ToastType.Success, t('FEES_DELETED', 'Fees deleted'))
      return { error: false, result: true }
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      const msg = [err?.message || 'Unknown error']
      setActionState({ loading: false, error: msg })
      return { error: true, result: msg }
    }
  }

  const createFeeEvent = async (changes) => {
    if (!token) return
    if (!businessId) return
    if (session?.user?.level !== 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }
      const response = await fetch(`${ordering.root}/business/${businessId}/fee_events`, requestOptions)
      const content = await response.json()
      if (content?.error) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: content?.result })
        return { error: true, result: content?.result }
      }
      setActionState({ loading: false, error: null })
      addFeeEventToList(content?.result)
      showToast?.(ToastType.Success, t('FEE_EVENT_CREATED', 'Fee event created'))
      return content
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      setActionState({ loading: false, error: [err?.message || 'Unknown error'] })
      return { error: true, result: [err?.message || 'Unknown error'] }
    }
  }

  const deleteFeeEvents = async (ids) => {
    if (!token) return
    if (!businessId) return
    if (session?.user?.level !== 0) return
    const list = Array.isArray(ids) ? ids : []
    if (list.length === 0) return
    try {
      showToast?.(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const errors = []
      for (const id of list) {
        const response = await fetch(`${ordering.root}/business/${businessId}/fee_events/${id}`, requestOptions)
        const content = await response.json()
        if (content?.error) {
          const msg = Array.isArray(content?.result) ? content.result.join(', ') : String(content?.result || 'Error')
          errors.push(`#${id}: ${msg}`)
        }
      }

      if (errors.length) {
        showToast?.(ToastType.Error, t('ERROR', 'Error'))
        setActionState({ loading: false, error: errors })
        return { error: true, result: errors }
      }

      setActionState({ loading: false, error: null })
      removeFeeEventsFromList(list)
      showToast?.(ToastType.Success, t('FEE_EVENTS_DELETED', 'Fee events deleted'))
      return { error: false, result: true }
    } catch (err) {
      showToast?.(ToastType.Error, t('ERROR', 'Error'))
      const msg = [err?.message || 'Unknown error']
      setActionState({ loading: false, error: msg })
      return { error: true, result: msg }
    }
  }

  useEffect(() => {
    if (!token || !businessId || !firstRender.current) return
    getFees(paginationProps.currentPage, paginationProps.pageSize)
    getFeeEvents(eventsPaginationProps.currentPage, eventsPaginationProps.pageSize)
  }, [token, businessId, firstRender.current])

  useEffect(() => {
    if (!token) return
    getSites()
    getPaymethods()
  }, [token])

  useEffect(() => {
    if (!token || !businessId || searchValue === null) return
    setPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
    getFees(1, paginationProps.pageSize)
  }, [searchValue])

  useEffect(() => {
    if (!token || !businessId || eventsSearchValue === null) return
    setEventsPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
    getFeeEvents(1, eventsPaginationProps.pageSize)
  }, [eventsSearchValue])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessId={businessId}
          // Fees
          feesList={feesList}
          getFees={getFees}
          createFee={createFee}
          updateFee={updateFee}
          deleteFees={deleteFees}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
          paginationProps={paginationProps}
          setPaginationProps={setPaginationProps}
          // Fee Events
          feeEventsList={feeEventsList}
          getFeeEvents={getFeeEvents}
          createFeeEvent={createFeeEvent}
          deleteFeeEvents={deleteFeeEvents}
          eventsSearchValue={eventsSearchValue}
          handleChangeEventsSearch={handleChangeEventsSearch}
          eventsPaginationProps={eventsPaginationProps}
          setEventsPaginationProps={setEventsPaginationProps}
          sitesState={sitesState}
          paymethodsState={paymethodsState}
          // Action
          actionState={actionState}
        />
      )}
    </>
  )
}

BusinessFees.propTypes = {
  UIComponent: PropTypes.elementType,
  businessId: PropTypes.number,
  paginationSettings: PropTypes.exact({
    initialPage: PropTypes.number,
    pageSize: PropTypes.number,
    controlType: PropTypes.string
  }),
  isSearchById: PropTypes.bool,
  isSearchByName: PropTypes.bool
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'pages' },
  isSearchById: true,
  isSearchByName: true,
  businessId: null
}
