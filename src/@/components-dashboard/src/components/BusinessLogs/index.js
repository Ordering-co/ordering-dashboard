import React, { useEffect, useRef, useState } from 'react'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

const DEFAULT_PAGE_SIZE = 10

// redesign stores 5.16 (; G2-33): the controller of the logs of a store.
// - The first call asks for the page size (10), not `page_size=null`.
// - An API error keeps `logs: []` and sets `error` (the API message, or `true` when it gives none), on `content.error` and on a throw,
//   so the UI can say it instead of drawing an empty list. `reload()` asks the same page again («Try again»).
// - The state is updated with the functional form (no stale `logsList` / `paginationProps` spread), and only the answer of the
//   latest request is kept: a slow older page never replaces a newer one. A failure keeps the totals of the last good page.
export const BusinessLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    businessId,
    UIComponent,
    paginationSettings
  } = props

  const [{ token }] = useSession()
  const [ordering] = useApi()
  const pageSize = Number(paginationSettings.pageSize) >= 1 ? Number(paginationSettings.pageSize) : DEFAULT_PAGE_SIZE
  const [logsList, setLogsList] = useState({ logs: [], loading: true, error: null })

  const [paginationProps, setPaginationProps] = useState({
    currentPage: 1,
    pageSize,
    totalItems: null,
    totalPages: null
  })

  const lastRequest = useRef({ page: 1, pageSize })
  const requestId = useRef(0)

  const getBusinesssLogs = async (page = 1, size = pageSize) => {
    const id = ++requestId.current
    lastRequest.current = { page, pageSize: size }
    try {
      setLogsList(prev => ({ ...prev, loading: true, error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const response = await fetch(`${ordering.root}/business/${businessId}/logs?orderBy=-id&page=${page}&page_size=${size}`, requestOptions)
      const content = await response.json()
      if (id !== requestId.current) return

      if (content.error) {
        const message = Array.isArray(content.result) ? content.result[0] : content.result
        // an error with no text is still an error: the UI reads `true` as «say the fallback», never as an empty list
        setLogsList(prev => ({ ...prev, loading: false, logs: [], error: message || true }))
        return
      }

      setLogsList(prev => ({ ...prev, loading: false, logs: content.result ?? [], error: null }))
      setPaginationProps(prev => ({
        ...prev,
        currentPage: content?.pagination?.current_page ?? page,
        pageSize: Number(content?.pagination?.page_size) >= 1 ? Number(content.pagination.page_size) : size,
        totalPages: content?.pagination?.total_pages,
        totalItems: content?.pagination?.total,
        from: content?.pagination?.from,
        to: content?.pagination?.to
      }))
    } catch (error) {
      if (id !== requestId.current) return
      setLogsList(prev => ({ ...prev, loading: false, logs: [], error: error?.message || true }))
    }
  }

  // «Try again»: the same page and size as the last request
  const reload = () => getBusinesssLogs(lastRequest.current.page, lastRequest.current.pageSize)

  useEffect(() => {
    getBusinesssLogs(1, pageSize)
  }, [businessId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          paginationProps={paginationProps}
          getBusinessLogs={getBusinesssLogs}
          reload={reload}
        />
      )}
    </>
  )
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: DEFAULT_PAGE_SIZE, controlType: 'infinity' }
}
