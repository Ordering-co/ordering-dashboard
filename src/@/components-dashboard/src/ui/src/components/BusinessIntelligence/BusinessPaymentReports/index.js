import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  List as MenuIcon,
  ChevronDown as BisDownArrow,
  ChevronLeft,
  ChevronRight,
  Download as DownloadIcon
} from 'react-bootstrap-icons'
import { Calendar } from 'react-date-range'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import * as locales from 'react-date-range/dist/locale'
import { useLanguage, useSession, useApi, useUtils } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { IconButton } from '../../../styles'
import { Select } from '../../../styles/Select/FirstSelect'
import { SideBar, SpinnerLoader, Pagination, RangeCalendar } from '../../Shared'
import { BusinessPaymentInvoiceDetail } from '../BusinessPaymentInvoiceDetail'
import { EatStreetReportDetail } from '../EatStreetReportDetail'
import { BusinessSelectHeader } from '../../Stores/BusinessSelectHeader'
import { addQueryToUrl, removeQueryToUrl, getLocale } from '../../../utils'

import {
  Container,
  HeaderContainer,
  BusinessSelectorWrapper,
  BusinessNameWrapper,
  InvoiceListTable,
  Table,
  InvoiceRow,
  EmptyState,
  LoadingWrapper,
  ViewModeWrapper,
  ViewModeCard,
  GeneralReportWrapper,
  MethodSelectorWrapper,
  CalendarSection,
  PeriodInfoBox,
  PeriodInfoText,
  DownloadButton,
  CalendarHint,
  MonthGridWrapper,
  YearSelector,
  MonthGrid,
  MonthCard,
  TabsContainer,
  TabButton,
  PaginationWrapper,
  PaymentHistorySection
} from './styles'

const EXT_REPORTS_BASE = 'https://eatstreet-payment-reports.plugins.orderingplus.com'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Calculate billing period cut-off dates based on method's cycle configuration.
 */
const getCutoffDates = (method, count = 12) => {
  if (!method) return []

  const { cycle, cycle_day: cycleDay, cycle_time: cycleTime } = method
  const [hours, minutes] = (cycleTime || '00:00').split(':').map(Number)
  const now = new Date()
  const periods = []

  if (cycle === 'weekly') {
    const today = new Date(now)
    today.setHours(hours, minutes, 0, 0)

    let diff = today.getDay() - cycleDay
    if (diff < 0) diff += 7

    const latestCutoff = new Date(today)
    latestCutoff.setDate(latestCutoff.getDate() - diff)

    if (latestCutoff > now) {
      latestCutoff.setDate(latestCutoff.getDate() - 7)
    }

    for (let i = 0; i < count; i++) {
      const cutoff = new Date(latestCutoff)
      cutoff.setDate(cutoff.getDate() - (i * 7))

      const periodStart = new Date(cutoff)
      periodStart.setDate(periodStart.getDate() - 7)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: formatDateTimeForApi(periodStart),
        periodEnd: formatDateTimeForApi(cutoff)
      })
    }
  } else if (cycle === 'monthly') {
    let year = now.getFullYear()
    let month = now.getMonth()

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const day = Math.min(cycleDay, daysInMonth)
    const latestCutoff = new Date(year, month, day, hours, minutes, 0, 0)

    if (latestCutoff > now) {
      month--
      if (month < 0) {
        month = 11
        year--
      }
      const prevDaysInMonth = new Date(year, month + 1, 0).getDate()
      const prevDay = Math.min(cycleDay, prevDaysInMonth)
      latestCutoff.setFullYear(year, month, prevDay)
    }

    const curYear = latestCutoff.getFullYear()
    const curMonth = latestCutoff.getMonth()

    for (let i = 0; i < count; i++) {
      const m = curMonth - i
      let y = curYear
      let adjustedMonth = m
      while (adjustedMonth < 0) {
        adjustedMonth += 12
        y--
      }

      const dim = new Date(y, adjustedMonth + 1, 0).getDate()
      const d = Math.min(cycleDay, dim)
      const cutoff = new Date(y, adjustedMonth, d, hours, minutes, 0, 0)

      let prevM = adjustedMonth - 1
      let prevY = y
      if (prevM < 0) {
        prevM = 11
        prevY--
      }
      const prevDim = new Date(prevY, prevM + 1, 0).getDate()
      const prevD = Math.min(cycleDay, prevDim)
      const periodStart = new Date(prevY, prevM, prevD, hours, minutes, 0, 0)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: formatDateTimeForApi(periodStart),
        periodEnd: formatDateTimeForApi(cutoff)
      })
    }
  }

  return periods
}

const formatDateTimeForApi = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:00`
}

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr.replace(' ', 'T'))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' ' + dateStr.split(' ')[1]
}

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

export const BusinessPaymentReports = (props) => {
  const [languageState, t] = useLanguage()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [{ parsePrice }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const [viewMode, setViewMode] = useState('business')

  // Business reports state
  const [invoiceList, setInvoiceList] = useState({ loading: false, invoices: [], error: null })
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [openDetail, setOpenDetail] = useState(false)
  const [showSelectHeader, setShowSelectHeader] = useState(false)

  // General report state
  const [methodsState, setMethodsState] = useState({ loading: false, methods: [], error: null })
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [downloadState, setDownloadState] = useState({ loading: false, error: null })
  const [paymentHistoryPeriod, setPaymentHistoryPeriod] = useState({ start: null, end: null })
  const [paymentHistoryDownloadState, setPaymentHistoryDownloadState] = useState({ loading: false, error: null })

  // Monthly picker state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // External (EatStreet) reports state
  const [extPluginInstalled, setExtPluginInstalled] = useState(false)
  const [reportTab, setReportTab] = useState('platform')
  const [extImportState, setExtImportState] = useState({ loading: false, done: false, error: null })
  const [extReportList, setExtReportList] = useState({ loading: false, reports: [], error: null, pagination: null })
  const [extSelectedReportId, setExtSelectedReportId] = useState(null)
  const [extOpenDetail, setExtOpenDetail] = useState(false)
  const [extPage, setExtPage] = useState(1)
  const [extPageSize, setExtPageSize] = useState(10)

  const cutoffPeriods = useMemo(() => {
    if (selectedMethod?.cycle === 'weekly') {
      const startOfPrevYear = new Date(2025, 0, 1)
      const weeksNeeded = Math.ceil((Date.now() - startOfPrevYear.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 2
      return getCutoffDates(selectedMethod, weeksNeeded).filter(p => p.cutoffDate >= startOfPrevYear)
    }
    return getCutoffDates(selectedMethod, 12)
  }, [selectedMethod])

  // Set of cutoff date strings for quick lookup (YYYY-MM-DD) — used by weekly calendar
  const cutoffDateSet = useMemo(() => {
    const set = new Set()
    cutoffPeriods.forEach(p => {
      const d = p.cutoffDate
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      set.add(key)
    })
    return set
  }, [cutoffPeriods])

  // Set of available months for monthly picker — keyed by period start month "YYYY-MM"
  const monthlyAvailableSet = useMemo(() => {
    const set = new Set()
    cutoffPeriods.forEach(p => {
      const s = p.startDate
      set.add(`${s.getFullYear()}-${s.getMonth()}`)
    })
    return set
  }, [cutoffPeriods])

  // Oldest period start year (for month picker year navigation lower bound)
  const oldestYear = useMemo(() => {
    if (cutoffPeriods.length === 0) return new Date().getFullYear()
    return cutoffPeriods[cutoffPeriods.length - 1].startDate.getFullYear()
  }, [cutoffPeriods])

  // Fetch invoices
  const fetchInvoices = useCallback(async (businessId) => {
    setInvoiceList({ loading: true, invoices: [], error: null })
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      let url = `${ordering.root}/business_payment_invoices`
      if (businessId) {
        url += `?where=[{"attribute":"business_id","value":${businessId}}]`
      }
      const response = await fetch(url, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setInvoiceList({ loading: false, invoices: Array.isArray(result) ? result : [], error: null })
      } else {
        setInvoiceList({ loading: false, invoices: [], error: result })
      }
    } catch (err) {
      setInvoiceList({ loading: false, invoices: [], error: [err.message] })
    }
  }, [token, ordering])

  // Fetch payment methods
  const fetchMethods = useCallback(async () => {
    if (!token) return
    setMethodsState({ loading: true, methods: [], error: null })
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/business_payment_accounts/methods`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setMethodsState({ loading: false, methods: Array.isArray(content.result) ? content.result : [], error: null })
      } else {
        setMethodsState({ loading: false, methods: [], error: content.result })
      }
    } catch (err) {
      setMethodsState({ loading: false, methods: [], error: [err.message] })
    }
  }, [token, ordering])

  const handlePaymentHistoryDateChange = useCallback((start, end) => {
    setPaymentHistoryPeriod({ start, end })
  }, [])

  const handleDownloadPaymentHistory = useCallback(async () => {
    if (!selectedBusiness?.id || !paymentHistoryPeriod.start || !paymentHistoryPeriod.end) return
    setPaymentHistoryDownloadState({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        business_id: String(selectedBusiness.id),
        period_start: paymentHistoryPeriod.start,
        period_end: paymentHistoryPeriod.end
      })
      const response = await fetch(
        `${ordering.root}/business_payment_invoices/payment_history?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.result?.[0] || 'Download failed')
      }

      const contentType = response.headers.get('Content-Type') || ''
      if (!contentType.includes('pdf')) {
        throw new Error('Invalid response format')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payment_history_${selectedBusiness.id}_${paymentHistoryPeriod.start}_to_${paymentHistoryPeriod.end}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setPaymentHistoryDownloadState({ loading: false, error: null })
    } catch (err) {
      setPaymentHistoryDownloadState({ loading: false, error: err.message })
    }
  }, [selectedBusiness, paymentHistoryPeriod, token, ordering])

  // Download CSV
  const handleDownloadReport = useCallback(async () => {
    if (!selectedMethod || !selectedPeriod) return
    setDownloadState({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        paymethod: selectedMethod.gateway,
        period_start: selectedPeriod.periodStart,
        period_end: selectedPeriod.periodEnd
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(
        `${ordering.root}/business_payment_reports/download?${params.toString()}`,
        requestOptions
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.result?.[0] || 'Download failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const endDatePart = selectedPeriod.periodEnd.split(' ')[0]
      a.download = `payment-report-${selectedMethod.gateway}-${endDatePart}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadState({ loading: false, error: null })
    } catch (err) {
      setDownloadState({ loading: false, error: err.message })
    }
  }, [selectedMethod, selectedPeriod, token, ordering])

  // External reports API helper
  const extApiCall = useCallback(async (endpoint, params = {}) => {
    const response = await fetch(`${EXT_REPORTS_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query: { project: ordering.project, ...params } })
    })
    return response.json()
  }, [token, ordering])

  // Fetch external reports (import + list)
  const fetchExtReports = useCallback(async (restaurantId, page = 1, perPage = 10) => {
    if (!restaurantId) return

    setExtImportState({ loading: true, done: false, error: null })
    try {
      const importResult = await extApiCall(`/api/reports/import/restaurant/${restaurantId}`)
      if (importResult.error) {
        setExtImportState({ loading: false, done: false, error: importResult.result })
        return
      }
      setExtImportState({ loading: false, done: true, error: null })
    } catch (err) {
      setExtImportState({ loading: false, done: false, error: [err.message] })
      return
    }

    setExtReportList({ loading: true, reports: [], error: null, pagination: null })
    try {
      const result = await extApiCall('/api/reports/list', {
        restaurant_id: restaurantId,
        page,
        per_page: perPage
      })
      if (!result.error) {
        setExtReportList({
          loading: false,
          reports: result.data || [],
          error: null,
          pagination: result.pagination || null
        })
      } else {
        setExtReportList({ loading: false, reports: [], error: result.result || result.error, pagination: null })
      }
    } catch (err) {
      setExtReportList({ loading: false, reports: [], error: [err.message], pagination: null })
    }
  }, [extApiCall])

  // Weekly: handle calendar date selection
  const handleCalendarDateChange = useCallback((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (!cutoffDateSet.has(key)) return
    setCalendarDate(date)
    const match = cutoffPeriods.find(p => isSameDay(p.cutoffDate, date))
    if (match) {
      setSelectedPeriod(match)
    }
  }, [cutoffPeriods, cutoffDateSet])

  // Weekly: highlight days within the selected period range as a continuous pill
  const dayContentRenderer = useCallback((day) => {
    if (!selectedPeriod) return <span>{day.getDate()}</span>
    const dayOnly = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const startDay = new Date(selectedPeriod.startDate.getFullYear(), selectedPeriod.startDate.getMonth(), selectedPeriod.startDate.getDate())
    const endDay = new Date(selectedPeriod.cutoffDate.getFullYear(), selectedPeriod.cutoffDate.getMonth(), selectedPeriod.cutoffDate.getDate())

    const isInPeriod = dayOnly >= startDay && dayOnly <= endDay
    if (!isInPeriod) return <span>{day.getDate()}</span>

    const isStart = dayOnly.getTime() === startDay.getTime()
    const isEnd = dayOnly.getTime() === endDay.getTime()
    const isRowStart = day.getDay() === 0
    const isRowEnd = day.getDay() === 6

    const roundLeft = isStart || isRowStart
    const roundRight = isEnd || isRowEnd

    let cls = 'pr-mid'
    if (roundLeft && roundRight) cls = 'pr-pill'
    else if (roundLeft) cls = 'pr-start'
    else if (roundRight) cls = 'pr-end'

    if (isEnd) cls += ' pr-cutoff'

    return <span className={cls}>{day.getDate()}</span>
  }, [selectedPeriod])

  // Weekly: disable non-cutoff days
  const disabledDay = useCallback((day) => {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    return !cutoffDateSet.has(key)
  }, [cutoffDateSet])

  // Monthly: handle month selection (match by period start month)
  const handleMonthSelect = useCallback((monthIndex) => {
    const key = `${selectedYear}-${monthIndex}`
    if (!monthlyAvailableSet.has(key)) return
    const match = cutoffPeriods.find(p =>
      p.startDate.getFullYear() === selectedYear && p.startDate.getMonth() === monthIndex
    )
    if (match) {
      setSelectedPeriod(match)
    }
  }, [selectedYear, monthlyAvailableSet, cutoffPeriods])

  // Monthly: check if a month is disabled
  const isMonthDisabled = useCallback((monthIndex) => {
    const key = `${selectedYear}-${monthIndex}`
    return !monthlyAvailableSet.has(key)
  }, [selectedYear, monthlyAvailableSet])

  // Monthly: check if a month is the selected one (by period start month)
  const isMonthActive = useCallback((monthIndex) => {
    if (!selectedPeriod) return false
    return selectedPeriod.startDate.getFullYear() === selectedYear &&
      selectedPeriod.startDate.getMonth() === monthIndex
  }, [selectedPeriod, selectedYear])

  const handleOpenDetail = (invoiceId) => {
    setSelectedInvoiceId(invoiceId)
    setOpenDetail(true)
    addQueryToUrl({ invoice_id: invoiceId, business_id: selectedBusiness?.id })
  }

  const handleCloseDetail = () => {
    setSelectedInvoiceId(null)
    setOpenDetail(false)
    if (!extOpenDetail) {
      removeQueryToUrl(['invoice_id', 'business_id'])
    } else {
      removeQueryToUrl(['invoice_id'])
    }
  }

  const handleSelectHeader = () => {
    setShowSelectHeader(!showSelectHeader)
  }

  const handleClose = () => {
    setShowSelectHeader(false)
  }

  const changeBusinessState = (business) => {
    handleClose()
    setSelectedBusiness(business)
    addQueryToUrl({ business_id: business.id })
    fetchInvoices(business.id)

    // Reset external reports state
    setReportTab('platform')
    setExtPage(1)
    setExtReportList({ loading: false, reports: [], error: null, pagination: null })
    setExtImportState({ loading: false, done: false, error: null })
    setPaymentHistoryPeriod({ start: null, end: null })
    setPaymentHistoryDownloadState({ loading: false, error: null })

    // Auto-fetch external reports if plugin is installed and business has external_id
    if (extPluginInstalled && business.external_id) {
      fetchExtReports(business.external_id)
    }
  }

  const handleOpenExtDetail = (reportId) => {
    setExtSelectedReportId(reportId)
    setExtOpenDetail(true)
    addQueryToUrl({ ext_report_id: reportId, business_id: selectedBusiness?.id })
  }

  const handleCloseExtDetail = () => {
    setExtSelectedReportId(null)
    setExtOpenDetail(false)
    if (!openDetail) {
      removeQueryToUrl(['ext_report_id', 'business_id'])
    } else {
      removeQueryToUrl(['ext_report_id'])
    }
  }

  const handleExtPageChange = (page) => {
    setExtPage(page)
    if (selectedBusiness?.external_id) {
      fetchExtReports(selectedBusiness.external_id, page, extPageSize)
    }
  }

  const handleExtPageSizeChange = (pageSize) => {
    setExtPageSize(pageSize)
    setExtPage(1)
    if (selectedBusiness?.external_id) {
      fetchExtReports(selectedBusiness.external_id, 1, pageSize)
    }
  }

  const handleMethodChange = (gateway) => {
    const method = methodsState.methods.find(m => m.gateway === gateway) || null
    setSelectedMethod(method)
    setSelectedPeriod(null)
    setCalendarDate(new Date())
    setSelectedYear(new Date().getFullYear())
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return parsePrice(amount == null ? 0 : parseFloat(amount))
  }

  useEffect(() => {
    if (viewMode === 'general' && methodsState.methods.length === 0 && !methodsState.loading) {
      fetchMethods()
    }
  }, [viewMode])

  // Check if external reports plugin is installed
  useEffect(() => {
    if (!token || !ordering?.root) return
    const checkExtPlugin = async () => {
      try {
        const response = await fetch(`${ordering.root}/plugins/key/eatstreet_payment_reports`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const { error, result } = await response.json()
        if (!error && result) {
          setExtPluginInstalled(true)
        } else {
          setExtPluginInstalled(false)
        }
      } catch {
        setExtPluginInstalled(false)
      }
    }
    checkExtPlugin()
  }, [token, ordering])

  // Restore sidebar state from URL immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invoiceId = params.get('invoice_id')
    const extReportId = params.get('ext_report_id')

    if (invoiceId) {
      setSelectedInvoiceId(invoiceId)
      setOpenDetail(true)
    }
    if (extReportId) {
      setExtSelectedReportId(extReportId)
      setExtOpenDetail(true)
    }
  }, [])

  // Auto-select business from URL when token/ordering are ready
  useEffect(() => {
    if (!token || !ordering?.root || selectedBusiness) return
    const params = new URLSearchParams(window.location.search)
    const businessId = params.get('business_id')
    const extReportId = params.get('ext_report_id')
    if (!businessId) return

    const fetchAndSelectBusiness = async () => {
      try {
        const { content: { error, result } } = await ordering
          .setAccessToken(token)
          .businesses(parseInt(businessId, 10))
          .asDashboard()
          .select(['id', 'name', 'slug', 'logo', 'city', 'external_id'])
          .get()

        if (!error && result) {
          setSelectedBusiness(result)
          fetchInvoices(result.id)

          if (extPluginInstalled && result.external_id) {
            if (extReportId) {
              setReportTab('eatstreet')
            }
            fetchExtReports(result.external_id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch business from URL:', err)
      }
    }
    fetchAndSelectBusiness()
  }, [token, ordering])

  // Fetch ext reports once plugin check completes and business is already selected
  useEffect(() => {
    if (!extPluginInstalled || !selectedBusiness?.external_id) return
    if (extReportList.reports.length > 0 || extReportList.loading || extImportState.loading) return
    const params = new URLSearchParams(window.location.search)
    const extReportId = params.get('ext_report_id')
    if (extReportId) {
      setReportTab('eatstreet')
    }
    fetchExtReports(selectedBusiness.external_id)
  }, [extPluginInstalled, selectedBusiness])

  const isWeekly = selectedMethod?.cycle === 'weekly'
  const isMonthly = selectedMethod?.cycle === 'monthly'

  return (
    <>
      <Container>
        <HeaderContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('PAYMENT_REPORTS', 'Payment reports')}</h1>
        </HeaderContainer>

        <ViewModeWrapper>
          <ViewModeCard
            active={viewMode === 'business'}
            onClick={() => setViewMode('business')}
          >
            <h3>{t('REPORTS_BY_BUSINESS', 'Reports by business')}</h3>
            <p>{t('REPORTS_BY_BUSINESS_DESC', 'View invoices per business')}</p>
          </ViewModeCard>
          <ViewModeCard
            active={viewMode === 'general'}
            onClick={() => setViewMode('general')}
          >
            <h3>{t('GENERAL_REPORT', 'General report')}</h3>
            <p>{t('GENERAL_REPORT_DESC', 'Download report for all businesses')}</p>
          </ViewModeCard>
        </ViewModeWrapper>

        {viewMode === 'business' && (
          <>
            <BusinessSelectorWrapper>
              <BusinessNameWrapper>
                <h1 onClick={() => handleSelectHeader()}>
                  {selectedBusiness?.name || t('SELECT_BUSINESS', 'Select a business')}
                  {' '}<BisDownArrow className={showSelectHeader ? 'rotate-arrow' : ''} />
                </h1>
              </BusinessNameWrapper>
              {showSelectHeader && (
                <BusinessSelectHeader
                  close={handleClose}
                  isOpen={showSelectHeader}
                  changeBusinessState={changeBusinessState}
                  defaultPropsToFetch={['name', 'slug', 'logo', 'city', 'external_id']}
                />
              )}
            </BusinessSelectorWrapper>

            {extPluginInstalled && selectedBusiness?.external_id && (
              <TabsContainer>
                <TabButton
                  active={reportTab === 'platform'}
                  onClick={() => setReportTab('platform')}
                >
                  {t('REPORTS', 'Reports')}
                </TabButton>
                <TabButton
                  active={reportTab === 'eatstreet'}
                  onClick={() => setReportTab('eatstreet')}
                >
                  {t('LEGACY_REPORTS', 'Legacy Reports')}
                </TabButton>
              </TabsContainer>
            )}

            {(!extPluginInstalled || !selectedBusiness?.external_id || reportTab === 'platform') && (
              <>
                {selectedBusiness && (
                  <PaymentHistorySection>
                    <h3>{t('PAYMENT_HISTORY', 'Payment history')}</h3>
                    <p>{t('PAYMENT_HISTORY_DESC', 'Download a consolidated PDF of payment invoices for the selected date range')}</p>
                    <RangeCalendar handleChangeDate={handlePaymentHistoryDateChange} />
                    {paymentHistoryPeriod.start && paymentHistoryPeriod.end && (
                      <PeriodInfoBox>
                        <PeriodInfoText>
                          <span className='label'>{t('SELECTED_PERIOD', 'Selected period')}</span>
                          <span className='dates'>
                            {paymentHistoryPeriod.start} — {paymentHistoryPeriod.end}
                          </span>
                        </PeriodInfoText>
                        <DownloadButton
                          onClick={handleDownloadPaymentHistory}
                          disabled={paymentHistoryDownloadState.loading}
                        >
                          <DownloadIcon />
                          {paymentHistoryDownloadState.loading
                            ? t('DOWNLOADING', 'Downloading...')
                            : t('DOWNLOAD_PAYMENT_HISTORY', 'Download payment history')}
                        </DownloadButton>
                      </PeriodInfoBox>
                    )}
                    {paymentHistoryDownloadState.error && (
                      <EmptyState>
                        <p>{paymentHistoryDownloadState.error}</p>
                      </EmptyState>
                    )}
                  </PaymentHistorySection>
                )}
                {invoiceList.loading
                  ? (
                    <LoadingWrapper>
                      <SpinnerLoader />
                    </LoadingWrapper>
                    )
                  : invoiceList.invoices.length > 0
                    ? (
                      <InvoiceListTable>
                        <Table>
                          <thead>
                            <tr>
                              <th>{t('INVOICE_ID', 'ID')}</th>
                              <th>{t('PERIOD', 'Period')}</th>
                              <th>{t('PREPAID_TOTAL', 'Prepaid total')}</th>
                              <th>{t('TOTAL_CHARGES', 'Total charges')}</th>
                              <th>{t('DEPOSIT_AMOUNT', 'Deposit amount')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceList.invoices.map(invoice => (
                              <InvoiceRow
                                key={invoice.id}
                                onClick={() => handleOpenDetail(invoice.id)}
                              >
                                <td>#{invoice.id}</td>
                                <td>{formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}</td>
                                <td>{formatCurrency(invoice.order_total)}</td>
                                <td>{formatCurrency(invoice.total_charges)}</td>
                                <td>{formatCurrency(invoice.deposit_amount)}</td>
                              </InvoiceRow>
                            ))}
                          </tbody>
                        </Table>
                      </InvoiceListTable>
                      )
                    : (
                      <EmptyState>
                        <p>
                          {!selectedBusiness
                            ? t('SELECT_BUSINESS_TO_VIEW_INVOICES', 'Select a business to view invoices')
                            : t('NO_INVOICES_FOUND', 'No invoices found')}
                        </p>
                      </EmptyState>
                      )}
              </>
            )}

            {extPluginInstalled && selectedBusiness?.external_id && reportTab === 'eatstreet' && (
              <>
                {(extImportState.loading || extReportList.loading)
                  ? (
                    <p style={{ textAlign: 'center', color: '#909BA9', fontSize: 16, padding: '40px 0' }}>
                      {t('SYNCING_EXTERNAL_REPORTS', 'Syncing reports...')}
                    </p>
                    )
                  : extReportList.reports.length > 0
                    ? (
                      <InvoiceListTable>
                        <Table>
                          <thead>
                            <tr>
                              <th>{t('PERIOD', 'Period')}</th>
                              <th>{t('ORDERS', 'Orders')}</th>
                              <th>{t('PREPAID_TOTAL', 'Prepaid total')}</th>
                              <th>{t('COMMISSION', 'Commission')}</th>
                              <th>{t('TOTAL_CHARGES', 'Total charges')}</th>
                              <th>{t('DEPOSIT_AMOUNT', 'Deposit amount')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extReportList.reports.map(report => (
                              <InvoiceRow
                                key={report.id}
                                onClick={() => handleOpenExtDetail(report.id)}
                              >
                                <td>{formatDate(report.start_date)} - {formatDate(report.end_date)}</td>
                                <td>{report.num_orders}</td>
                                <td>{formatCurrency(report.order_total)}</td>
                                <td>{formatCurrency(report.commission)}</td>
                                <td>{formatCurrency(report.total_charges)}</td>
                                <td>{formatCurrency(report.deposit_amount)}</td>
                              </InvoiceRow>
                            ))}
                          </tbody>
                        </Table>
                        {extReportList.pagination && extReportList.pagination.total_pages > 1 && (
                          <PaginationWrapper>
                            <Pagination
                              currentPage={extPage}
                              totalPages={extReportList.pagination.total_pages}
                              handleChangePage={handleExtPageChange}
                              defaultPageSize={extPageSize}
                              handleChangePageSize={handleExtPageSizeChange}
                            />
                          </PaginationWrapper>
                        )}
                      </InvoiceListTable>
                      )
                    : (
                      <EmptyState>
                          <p>
                            {extImportState.error
                              ? (Array.isArray(extImportState.error) ? extImportState.error[0] : extImportState.error)
                              : extReportList.error
                                ? (Array.isArray(extReportList.error) ? extReportList.error[0] : extReportList.error)
                                : t('NO_EXTERNAL_REPORTS', 'No reports found')}
                          </p>
                        </EmptyState>
                      )}
              </>
            )}
          </>
        )}

        {viewMode === 'general' && (
          <GeneralReportWrapper>
            {methodsState.loading
              ? (
                <LoadingWrapper>
                  <SpinnerLoader />
                </LoadingWrapper>
                )
              : methodsState.error
                ? (
                  <EmptyState>
                    <p>{Array.isArray(methodsState.error) ? methodsState.error[0] : methodsState.error}</p>
                  </EmptyState>
                  )
                : (
                  <>
                    <MethodSelectorWrapper>
                      <label>{t('SELECT_PAYMENT_METHOD', 'Select a payment method')}</label>
                      <Select
                        placeholder={t('SELECT_METHOD', 'Select method...')}
                        defaultValue={selectedMethod?.gateway || ''}
                        options={methodsState.methods.map(m => ({
                          value: m.gateway,
                          content: <span>{m.name} — {m.cycle === 'weekly' ? t('WEEKLY', 'Weekly') : t('MONTHLY', 'Monthly')}</span>
                        }))}
                        onChange={handleMethodChange}
                      />
                    </MethodSelectorWrapper>

                    {selectedMethod && (
                      <CalendarSection>
                        <label>{t('SELECT_BILLING_PERIOD', 'Select a billing period')}</label>
                        <CalendarHint>
                          {isWeekly
                            ? t('SELECT_CUTOFF_DATE', 'Select a highlighted date to download the report for that period')
                            : t('SELECT_MONTH_HINT', 'Select a month to download the report for that billing period')}
                        </CalendarHint>

                        {isWeekly && (
                          <Calendar
                            locale={getLocale(languageState?.language?.code, locales)}
                            date={calendarDate}
                            onChange={handleCalendarDateChange}
                            maxDate={new Date()}
                            minDate={cutoffPeriods.length > 0 ? (() => { const d = cutoffPeriods[cutoffPeriods.length - 1].cutoffDate; return new Date(d.getFullYear(), d.getMonth(), 1) })() : undefined}
                            disabledDay={disabledDay}
                            dayContentRenderer={dayContentRenderer}
                            color='transparent'
                          />
                        )}

                        {isMonthly && (
                          <MonthGridWrapper>
                            <YearSelector>
                              <button
                                onClick={() => setSelectedYear(prev => prev - 1)}
                                disabled={selectedYear <= oldestYear}
                              >
                                <ChevronLeft />
                              </button>
                              <span>{selectedYear}</span>
                              <button
                                onClick={() => setSelectedYear(prev => prev + 1)}
                                disabled={selectedYear >= new Date().getFullYear()}
                              >
                                <ChevronRight />
                              </button>
                            </YearSelector>
                            <MonthGrid>
                              {MONTH_NAMES.map((name, idx) => (
                                <MonthCard
                                  key={idx}
                                  disabled={isMonthDisabled(idx)}
                                  active={isMonthActive(idx)}
                                  onClick={() => !isMonthDisabled(idx) && handleMonthSelect(idx)}
                                >
                                  {t(name.toUpperCase(), name)}
                                </MonthCard>
                              ))}
                            </MonthGrid>
                          </MonthGridWrapper>
                        )}

                        {selectedPeriod && (
                          <PeriodInfoBox>
                            <PeriodInfoText>
                              <span className='label'>{t('SELECTED_PERIOD', 'Selected period')}</span>
                              <span className='dates'>
                                {formatDateDisplay(selectedPeriod.periodStart)} — {formatDateDisplay(selectedPeriod.periodEnd)}
                              </span>
                            </PeriodInfoText>
                            <DownloadButton
                              onClick={handleDownloadReport}
                              disabled={downloadState.loading}
                            >
                              <DownloadIcon />
                              {downloadState.loading
                                ? t('DOWNLOADING', 'Downloading...')
                                : t('DOWNLOAD_CSV', 'Download CSV')}
                            </DownloadButton>
                          </PeriodInfoBox>
                        )}

                        {downloadState.error && (
                          <EmptyState>
                            <p>{downloadState.error}</p>
                          </EmptyState>
                        )}
                      </CalendarSection>
                    )}
                  </>
                  )}
          </GeneralReportWrapper>
        )}
      </Container>
      {openDetail && (
        <SideBar
          sidebarId='business_payment_invoice_detail'
          open={openDetail}
          onClose={handleCloseDetail}
          showExpandIcon
        >
          <BusinessPaymentInvoiceDetail
            invoiceId={selectedInvoiceId}
          />
        </SideBar>
      )}
      {extOpenDetail && (
        <SideBar
          sidebarId='ext_report_detail'
          open={extOpenDetail}
          onClose={handleCloseExtDetail}
          showExpandIcon
        >
          <EatStreetReportDetail
            reportId={extSelectedReportId}
          />
        </SideBar>
      )}
    </>
  )
}
