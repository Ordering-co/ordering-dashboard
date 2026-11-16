import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { normalizeTimezone } from '../../utils'

// redesign reports FA3 (D10, RP-06, RP-09, RP-20, D13): data hook for the 21 reports.
// It makes the same requests as the `AdvancedReports` controller (index.js:50-145) but keeps
// a load id (stale answers are dropped), shows errors, and never keeps old data under new filters.

const INITIAL = { data: null, data1: null, error: null, error1: null, settledKey: null }

const idsParam = (name, value) => (
  value && value.length > 0 ? `&${name}=${JSON.stringify(value)}` : ''
)

/**
 * Query string of a report request. Same keys, order and format as `main`
 * (`AdvancedReports:61-69`); `filters.from`/`to` arrive as YYYY-MM-DD.
 */
export const buildReportParams = (filters) => {
  let params = `timezone=${normalizeTimezone(filters?.timeZone)}`
  if (filters?.from !== '' && filters?.to !== '') {
    params = `${params}&from=${dayjs(filters?.from).format('YYYY-MM-DD')} 00:00:00&to=${dayjs(filters?.to).format('YYYY-MM-DD')} 23:59:59`
  }
  params += idsParam('businesses_ids', filters?.businessIds)
  params += idsParam('drivers_ids', filters?.drivers_ids)
  params += idsParam('franchises_id', filters?.franchises_id)
  params += idsParam('driver_companies_ids', filters?.driver_companies_ids)
  params += idsParam('driver_groups_ids', filters?.driver_groups_ids)
  params += idsParam('delivery_types_ids', filters?.delivery_types_ids)
  params += idsParam('app_ids', filters?.app_ids)
  return params
}

const requestReport = async (url, options) => {
  try {
    const response = await fetch(url, options)
    const { error, result } = await response.json()
    if (error) return { data: null, error: result ?? true }
    return { data: result ?? null, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * `countryCode` is accepted for the page's convenience but, as in `main`, it is not an API
 * parameter: it only narrows the pills, so it neither changes the request nor triggers a load.
 */
export const useAdvancedReport = ({
  endpoint,
  endpoint1,
  filters,
  enabled = true,
  debounceMs = 600,
  // redesign ecommerce FC (A3): a report with its own query string (clicks) passes `filters → string`
  buildParams = buildReportParams
} = {}) => {
  const [ordering] = useApi()
  const [{ token, loading: sessionLoading }] = useSession()
  const [state, setState] = useState(INITIAL)

  const root = ordering?.root
  const url = endpoint ? `${root}/reports/${endpoint}?${buildParams(filters)}` : null
  const url1 = endpoint1 ? `${root}/reports/${endpoint1}?${buildParams(filters)}` : null
  // Value comparison: only what decides the requests counts (not the identity of `filters`).
  const key = JSON.stringify([url, url1])

  const loadIdRef = useRef(0)
  const timerRef = useRef(null)
  const launchedKeyRef = useRef(null)
  const latestRef = useRef({})
  latestRef.current = { url, url1, token, key }

  const launch = useCallback(() => {
    const { url: currentUrl, url1: currentUrl1, token: currentToken, key: currentKey } = latestRef.current
    if (!currentUrl) return
    const id = ++loadIdRef.current
    launchedKeyRef.current = currentKey
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      }
    }
    setState((prev) => ({ ...prev, error: null, error1: null, settledKey: null }))
    Promise.all([
      requestReport(currentUrl, options),
      currentUrl1 ? requestReport(currentUrl1, options) : Promise.resolve({ data: null, error: null })
    ]).then(([first, second]) => {
      if (id !== loadIdRef.current) return
      setState({
        data: first.data,
        data1: second.data,
        error: first.error,
        error1: second.error,
        settledKey: currentKey
      })
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      launchedKeyRef.current = null
      setState((prev) => (prev === INITIAL ? prev : INITIAL))
      return undefined
    }
    if (!url || sessionLoading) return undefined
    // The first load of a report (mount, or session ready) does not wait; later changes do.
    const wait = launchedKeyRef.current !== null && launchedKeyRef.current !== key && debounceMs > 0
    if (wait) {
      launchedKeyRef.current = key
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        launch()
      }, debounceMs)
    } else {
      launch()
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // Anything still in flight belongs to the old filters: drop it (RP-20).
      loadIdRef.current += 1
    }
  }, [key, enabled, sessionLoading, debounceMs, launch])

  const retry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    launch()
  }, [launch])

  const ready = enabled && !!endpoint
  const pending = ready && state.settledKey !== key
  const hasData = state.data !== null || state.data1 !== null

  return {
    data: state.data,
    data1: state.data1,
    loading: pending && !hasData,
    updating: pending && hasData,
    error: state.error,
    error1: state.error1,
    retry
  }
}

export default useAdvancedReport
