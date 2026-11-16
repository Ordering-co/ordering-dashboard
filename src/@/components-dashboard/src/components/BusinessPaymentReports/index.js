import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { addQueryToUrl, removeQueryToUrl } from '../../ui/src/utils'
import {
  billingPeriods,
  historyPresetRange,
  paymentHistoryFileName,
  paymentReportFileName,
  sortInvoicesNewestFirst
} from '../../utils/businessPayments'
import { todayDay } from '../../utils/dateRange'

// redesign business-payments FA (D2, D5, D6, D8): the one controller of /intelligence/business-payments. It makes the
// requests of the page of `main` (`main BPR` = ui/src/components/BusinessIntelligence/BusinessPaymentReports/index.js: same
// URLs, parameters, hosts, bodies and order) and only changes the shape of the state it gives the UIComponent. It renders no markup.
// Nothing is downloaded on its own: a file is asked only by `history.download()` and `report.download(period)`.
// (D-17, owner decisions): (a) the EatStreet import runs when the Legacy Reports TAB is opened with a store chosen (or the tab
// comes from the URL), never when the store is chosen on the Reports tab; (b) an account with ONE store gets it chosen by itself on load.

// main BPR:52
const EXT_REPORTS_BASE = 'https://eatstreet-payment-reports.plugins.orderingplus.com'

const EMPTY_LEGACY_LIST = { loading: false, reports: [], error: null, pagination: null }
const EMPTY_HISTORY = { from: null, to: null, preset: null, loading: false, error: null }

/** Saves a blob as a file through an `<a download>` (main BPR:338-346, 379-388). */
const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Component to manage the payment reports behavior without UI component
 */
export const BusinessPaymentReports = (props) => {
  const { UIComponent } = props

  const [{ token }] = useSession()
  const [ordering] = useApi()

  // The latest session and api, read by the loaders so they never depend on their identity
  const context = useRef({})
  context.current = { ordering, token }

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const [view, setView] = useState('business')

  // ---- the plugin (R1) ---------------------------------------------------------------------------------------
  const [plugin, setPlugin] = useState({ checked: false, installed: false })
  const pluginInstalled = useRef(false)
  pluginInstalled.current = plugin.installed

  // ---- the store ---------------------------------------------------------------------------------------------
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const selectedRef = useRef(null)
  selectedRef.current = selectedBusiness

  // ---- the invoices (R4) -------------------------------------------------------------------------------------
  const [invoiceList, setInvoiceList] = useState({ loading: false, invoices: [], error: null })
  const invoicesRequest = useRef(0)

  // ---- the payment history (R6) ------------------------------------------------------------------------------
  const [history, setHistory] = useState(EMPTY_HISTORY)
  const historyRef = useRef(history)
  historyRef.current = history

  // ---- the legacy EatStreet reports (R9) ---------------------------------------------------------------------
  const [reportTab, setReportTab] = useState('platform')
  const [extImportState, setExtImportState] = useState({ loading: false, done: false, error: null })
  const [extReportList, setExtReportList] = useState(EMPTY_LEGACY_LIST)
  const [extPage, setExtPage] = useState(1)
  const [extPageSize, setExtPageSize] = useState(10)
  const pageSizeRef = useRef(extPageSize)
  pageSizeRef.current = extPageSize
  const extRequest = useRef(0)
  // true from the store restored out of the URL until the tab of an `?ext_report_id=` is applied (or another store is chosen)
  const urlRestore = useRef(false)
  const autoSelectTried = useRef(false)

  // ---- the panels --------------------------------------------------------------------------------------------
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [extSelectedReportId, setExtSelectedReportId] = useState(null)
  const invoiceOpen = useRef(false)
  const extOpen = useRef(false)

  // ---- the general report (R7, R8) ---------------------------------------------------------------------------
  const [methodsState, setMethodsState] = useState({ loading: false, methods: [], error: null })
  const [selectedMethod, setSelectedMethod] = useState(null)
  const methodRef = useRef(null)
  methodRef.current = selectedMethod
  const [reportState, setReportState] = useState({ loadingKey: null, error: null, errorKey: null })
  const methodsRequest = useRef(0)

  const periods = useMemo(() => billingPeriods(selectedMethod), [selectedMethod])

  // ---- R4: the invoices of a store ---------------------------------------------------------------------------
  // main BPR:255-279. The answer of a store chosen before (an older request) is discarded.
  const fetchInvoices = useCallback(async (businessId) => {
    const id = ++invoicesRequest.current
    setInvoiceList({ loading: true, invoices: [], error: null })
    try {
      const { ordering: api, token: bearer } = context.current
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`
        }
      }
      let url = `${api.root}/business_payment_invoices`
      if (businessId) {
        url += `?where=[{"attribute":"business_id","value":${businessId}}]`
      }
      const response = await fetch(url, requestOptions)
      const { error, result } = await response.json()
      if (!mounted.current || id !== invoicesRequest.current) return
      if (!error) {
        setInvoiceList({ loading: false, invoices: Array.isArray(result) ? result : [], error: null })
      } else {
        // BP-07: an error is not an empty list
        setInvoiceList({ loading: false, invoices: [], error: result || true })
      }
    } catch (err) {
      if (!mounted.current || id !== invoicesRequest.current) return
      setInvoiceList({ loading: false, invoices: [], error: [err.message] })
    }
  }, [])

  const retryInvoices = useCallback(() => {
    if (selectedRef.current) fetchInvoices(selectedRef.current.id)
  }, [fetchInvoices])

  // ---- R7: the payment methods -------------------------------------------------------------------------------
  // main BPR:282-303. D5: with a list and no method chosen, the first one is chosen (no request).
  const fetchMethods = useCallback(async () => {
    const { ordering: api, token: bearer } = context.current
    if (!bearer) return
    const id = ++methodsRequest.current
    setMethodsState({ loading: true, methods: [], error: null })
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`
        }
      }
      const response = await fetch(`${api.root}/business_payment_accounts/methods`, requestOptions)
      const content = await response.json()
      if (!mounted.current || id !== methodsRequest.current) return
      if (!content.error) {
        const methods = Array.isArray(content.result) ? content.result : []
        setMethodsState({ loading: false, methods, error: null })
        setSelectedMethod(prev => prev || methods[0] || null)
      } else {
        setMethodsState({ loading: false, methods: [], error: content.result || true })
      }
    } catch (err) {
      if (!mounted.current || id !== methodsRequest.current) return
      setMethodsState({ loading: false, methods: [], error: [err.message] })
    }
  }, [])

  // main BPR:592-598
  const selectMethod = useCallback((gateway) => {
    const method = methodsState.methods.find(m => m.gateway === gateway) || null
    setSelectedMethod(method)
    setReportState(prev => (prev.loadingKey ? prev : { loadingKey: null, error: null, errorKey: null }))
  }, [methodsState.methods])

  // ---- R6: the payment history PDF ---------------------------------------------------------------------------
  const setPreset = useCallback((preset) => {
    const range = historyPresetRange(preset, todayDay())
    if (!range) return
    setHistory(prev => ({ ...prev, from: range.from, to: range.to, preset }))
  }, [])

  const setRange = useCallback(({ from, to }) => {
    setHistory(prev => ({ ...prev, from: from || null, to: to || null, preset: null }))
  }, [])

  // main BPR:309-351
  const downloadHistory = useCallback(async () => {
    const business = selectedRef.current
    const { from, to } = historyRef.current
    if (!business?.id || !from || !to) return
    setHistory(prev => ({ ...prev, loading: true, error: null }))
    try {
      const { ordering: api, token: bearer } = context.current
      const params = new URLSearchParams({
        business_id: String(business.id),
        period_start: from,
        period_end: to
      })
      const response = await fetch(
        `${api.root}/business_payment_invoices/payment_history?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${bearer}`
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
      saveBlob(blob, paymentHistoryFileName(business.id, from, to))
      if (mounted.current) setHistory(prev => ({ ...prev, loading: false, error: null }))
    } catch (err) {
      if (mounted.current) setHistory(prev => ({ ...prev, loading: false, error: err.message }))
    }
  }, [])

  // ---- R8: the payment report CSV of a period ----------------------------------------------------------------
  // main BPR:354-393
  const downloadReport = useCallback(async (period) => {
    const method = methodRef.current
    if (!method || !period) return
    setReportState({ loadingKey: period.key, error: null, errorKey: null })
    try {
      const { ordering: api, token: bearer } = context.current
      const params = new URLSearchParams({
        paymethod: method.gateway,
        period_start: period.periodStart,
        period_end: period.periodEnd
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearer}`
        }
      }
      const response = await fetch(
        `${api.root}/business_payment_reports/download?${params.toString()}`,
        requestOptions
      )

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.result?.[0] || 'Download failed')
      }

      const blob = await response.blob()
      saveBlob(blob, paymentReportFileName(method.gateway, period.periodEnd))
      if (mounted.current) setReportState({ loadingKey: null, error: null, errorKey: null })
    } catch (err) {
      if (mounted.current) setReportState({ loadingKey: null, error: err.message, errorKey: period.key })
    }
  }, [])

  // ---- R9: the legacy EatStreet reports ----------------------------------------------------------------------
  // External reports API helper. main BPR:396-406
  const extApiCall = useCallback(async (endpoint, params = {}) => {
    const { ordering: api, token: bearer } = context.current
    const response = await fetch(`${EXT_REPORTS_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`
      },
      body: JSON.stringify({ query: { project: api.project, ...params } })
    })
    return response.json()
  }, [])

  // Fetch external reports (import + list). main BPR:408-445. The answer of a store chosen before is discarded.
  const fetchExtReports = useCallback(async (restaurantId, page = 1, perPage = 10) => {
    if (!restaurantId) return

    const id = ++extRequest.current
    const stale = () => !mounted.current || id !== extRequest.current

    setExtImportState({ loading: true, done: false, error: null })
    try {
      const importResult = await extApiCall(`/api/reports/import/restaurant/${restaurantId}`)
      if (stale()) return
      if (importResult.error) {
        setExtImportState({ loading: false, done: false, error: importResult.result })
        return
      }
      setExtImportState({ loading: false, done: true, error: null })
    } catch (err) {
      if (stale()) return
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
      if (stale()) return
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
      if (stale()) return
      setExtReportList({ loading: false, reports: [], error: [err.message], pagination: null })
    }
  }, [extApiCall])

  // main BPR:577-582
  const setPage = useCallback((page) => {
    setExtPage(page)
    const business = selectedRef.current
    if (business?.external_id) {
      fetchExtReports(business.external_id, page, pageSizeRef.current)
    }
  }, [fetchExtReports])

  // main BPR:584-590
  const setPageSize = useCallback((pageSize) => {
    setExtPageSize(pageSize)
    setExtPage(1)
    const business = selectedRef.current
    if (business?.external_id) {
      fetchExtReports(business.external_id, 1, pageSize)
    }
  }, [fetchExtReports])

  // ---- choosing a store --------------------------------------------------------------------------------------
  // main BPR:541-559 (`changeBusinessState`) without closing any dropdown: the picker closes itself.
  const select = useCallback((business) => {
    setSelectedBusiness(business)
    selectedRef.current = business
    addQueryToUrl({ business_id: business.id })
    fetchInvoices(business.id)

    // Reset external reports state
    // A request of the store chosen before is discarded
    extRequest.current += 1
    setReportTab('platform')
    setExtPage(1)
    setExtReportList(EMPTY_LEGACY_LIST)
    setExtImportState({ loading: false, done: false, error: null })
    setHistory(EMPTY_HISTORY)
    urlRestore.current = false
    // (D-17 a): EatStreet is not asked here. The effect below asks when the Legacy Reports tab is open with this store.
  }, [fetchInvoices])
  const selectRef = useRef(select)
  selectRef.current = select

  // ---- the panels --------------------------------------------------------------------------------------------
  // main BPR:517-531. D8: one panel at a time, so opening this one closes the legacy one (and takes only its own parameter out of the URL).
  const openDetail = useCallback((invoiceId) => {
    if (extOpen.current) {
      extOpen.current = false
      setExtSelectedReportId(null)
      removeQueryToUrl(['ext_report_id'])
    }
    invoiceOpen.current = true
    setSelectedInvoiceId(invoiceId)
    const business = selectedRef.current
    addQueryToUrl(business?.id ? { invoice_id: invoiceId, business_id: business.id } : { invoice_id: invoiceId })
  }, [])

  const closeDetail = useCallback(() => {
    invoiceOpen.current = false
    setSelectedInvoiceId(null)
    // redesign only the parameter of this document goes; `business_id` stays so a reload keeps the store chosen
    // (main dropped it with the last document, and a reload then came back to «Select business»)
    removeQueryToUrl(['invoice_id'])
  }, [])

  // main BPR:561-575
  const openExtDetail = useCallback((reportId) => {
    if (invoiceOpen.current) {
      invoiceOpen.current = false
      setSelectedInvoiceId(null)
      removeQueryToUrl(['invoice_id'])
    }
    extOpen.current = true
    setExtSelectedReportId(reportId)
    const business = selectedRef.current
    addQueryToUrl(business?.id ? { ext_report_id: reportId, business_id: business.id } : { ext_report_id: reportId })
  }, [])

  const closeExtDetail = useCallback(() => {
    extOpen.current = false
    setExtSelectedReportId(null)
    // redesign as closeDetail, `business_id` stays
    removeQueryToUrl(['ext_report_id'])
  }, [])

  // ---- effects -----------------------------------------------------------------------------------------------
  // main BPR:614-618
  useEffect(() => {
    if (view === 'general' && methodsState.methods.length === 0 && !methodsState.loading) {
      fetchMethods()
    }
  }, [view])

  // Check if external reports plugin is installed. main BPR:620-643
  useEffect(() => {
    if (!token || !ordering?.root) return
    const checkExtPlugin = async () => {
      let installed = false
      try {
        const response = await fetch(`${ordering.root}/plugins/key/eatstreet_payment_reports`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const { error, result } = await response.json()
        installed = !error && !!result
      } catch {
        installed = false
      }
      if (mounted.current) setPlugin({ checked: true, installed })
    }
    checkExtPlugin()
  }, [token, ordering])

  // Restore sidebar state from URL immediately. main BPR:645-659
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invoiceId = params.get('invoice_id')
    const extReportId = params.get('ext_report_id')

    if (invoiceId) {
      invoiceOpen.current = true
      setSelectedInvoiceId(invoiceId)
    }
    if (extReportId) {
      extOpen.current = true
      setExtSelectedReportId(extReportId)
    }
  }, [])

  // Auto-select business from URL when token/ordering are ready. main BPR:661-694
  useEffect(() => {
    if (!token || !ordering?.root || selectedRef.current) return
    const params = new URLSearchParams(window.location.search)
    const businessId = params.get('business_id')
    if (!businessId) return

    const fetchAndSelectBusiness = async () => {
      setRestoring(true)
      try {
        const { content: { error, result } } = await ordering
          .setAccessToken(token)
          .businesses(parseInt(businessId, 10))
          .asDashboard()
          .select(['id', 'name', 'slug', 'logo', 'city', 'external_id'])
          .get()

        if (!mounted.current) return
        if (!error && result) {
          setSelectedBusiness(result)
          selectedRef.current = result
          fetchInvoices(result.id)
          // the tab of an `?ext_report_id=` is applied by the effect below, once the plugin is known (a)
          urlRestore.current = true
        }
      } catch (err) {
        console.error('Failed to fetch business from URL:', err)
      } finally {
        if (mounted.current) setRestoring(false)
      }
    }
    fetchAndSelectBusiness()
  }, [token, ordering])

  // A store restored from the URL with `?ext_report_id=` opens the Legacy Reports tab, once the plugin check says it exists.
  // main BPR:696-706 (the tab part; the request is the next effect's)
  useEffect(() => {
    if (!urlRestore.current || !plugin.installed || !selectedBusiness?.external_id) return
    urlRestore.current = false
    const params = new URLSearchParams(window.location.search)
    if (params.get('ext_report_id')) setReportTab('eatstreet')
  }, [plugin.installed, selectedBusiness])

  // (D-17 a): the EatStreet import (and then the list) runs when the Legacy Reports tab is open with a store that has an
  // `external_id` and the plugin is installed: when the tab is opened, when the plugin answer arrives late, or when the store changes
  // with the tab open. A store already loaded (or loading) is not asked again when the tab is opened again; a failed import is.
  const extExternalId = plugin.installed ? selectedBusiness?.external_id : null
  useEffect(() => {
    if (reportTab !== 'eatstreet' || !extExternalId) return
    if (extReportList.reports.length > 0 || extReportList.loading || extImportState.loading || extImportState.done) return
    fetchExtReports(extExternalId, 1, pageSizeRef.current)
  }, [reportTab, extExternalId, selectedBusiness?.id])

  // (D-17 b): an account with exactly one store gets it chosen by itself, unless the URL already names one. One small read
  // on load (page_size 2, the fields of the URL restore), with the same filter as the picker's list (the enabled stores this user sees).
  useEffect(() => {
    if (!token || !ordering?.root || autoSelectTried.current) return
    autoSelectTried.current = true
    if (selectedRef.current || new URLSearchParams(window.location.search).get('business_id')) return

    const autoSelectSingleBusiness = async () => {
      try {
        const { content: { error, result, pagination } } = await ordering
          .setAccessToken(token)
          .businesses()
          .select(['id', 'name', 'slug', 'logo', 'city', 'external_id'])
          .asDashboard()
          .where({ conditions: [{ attribute: 'enabled', value: true }], conector: 'AND' })
          .get({ query: { page: 1, page_size: 2 } })

        // a store chosen by hand while this was out wins
        if (!mounted.current || selectedRef.current || error) return
        if (Array.isArray(result) && result.length === 1 && (pagination?.total ?? 1) === 1) {
          selectRef.current(result[0])
        }
      } catch (err) {
        // the picker still works: nothing is chosen
      }
    }
    autoSelectSingleBusiness()
  }, [token, ordering])

  // ---- the state the UI reads --------------------------------------------------------------------------------
  const sortedInvoices = useMemo(() => sortInvoicesNewestFirst(invoiceList.invoices), [invoiceList.invoices])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          view={view}
          setView={setView}
          plugin={plugin}
          business={{ selected: selectedBusiness, select, restoring }}
          invoices={{ loading: invoiceList.loading, error: invoiceList.error, items: sortedInvoices, retry: retryInvoices }}
          history={{
            from: history.from,
            to: history.to,
            preset: history.preset,
            setPreset,
            setRange,
            download: downloadHistory,
            loading: history.loading,
            error: history.error
          }}
          legacy={{
            available: plugin.installed && !!selectedBusiness?.external_id,
            tab: reportTab,
            setTab: setReportTab,
            importing: extImportState.loading,
            importError: extImportState.error,
            list: extReportList,
            page: extPage,
            pageSize: extPageSize,
            setPage,
            setPageSize
          }}
          detail={{ invoiceId: selectedInvoiceId, open: openDetail, close: closeDetail }}
          legacyDetail={{ reportId: extSelectedReportId, open: openExtDetail, close: closeExtDetail }}
          methods={{ loading: methodsState.loading, error: methodsState.error, items: methodsState.methods, retry: fetchMethods }}
          method={selectedMethod}
          selectMethod={selectMethod}
          periods={periods}
          report={{
            download: downloadReport,
            loadingKey: reportState.loadingKey,
            error: reportState.error,
            errorKey: reportState.errorKey
          }}
        />
      )}
    </>
  )
}

BusinessPaymentReports.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
