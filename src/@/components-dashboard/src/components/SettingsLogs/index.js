import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

const DEFAULT_PAGE_SIZE = 10
// one page of admins is enough to name who changed a setting (only admins can)
const AUTHORS_PAGE_SIZE = 100

export const NO_FILTERS = { configIds: [], authorIds: [], from: null, to: null }

const idList = (value) => (Array.isArray(value) ? value.filter(id => Number.isInteger(id) && id >= 1) : [])
const dayOrNull = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value : null)

/** the filters as the API applies them: every one goes in the `where` of GET /configs/logs. */
export const effectiveFilters = (filters) => ({
  configIds: idList(filters?.configIds),
  authorIds: idList(filters?.authorIds),
  from: dayOrNull(filters?.from),
  to: dayOrNull(filters?.to)
})

/** The `where` of GET /configs/logs. The days are compared with the stamp as stored, as the list shows it (`utc: false`). */
export const whereOf = (filters) => [
  ...(filters.configIds.length ? [{ attribute: 'config_id', value: filters.configIds }] : []),
  ...(filters.authorIds.length ? [{ attribute: 'author_id', value: filters.authorIds }] : []),
  ...(filters.from ? [{ attribute: 'created_at', value: { condition: '>=', value: `${filters.from} 00:00:00` } }] : []),
  ...(filters.to ? [{ attribute: 'created_at', value: { condition: '<=', value: `${filters.to} 23:59:59` } }] : [])
]

/**
 * Component to get settings logs without UI component
 *
 * redesign settings-logs (; M-SL5, M-SL6), as the store's logs controller (5.16 ):
 * - The first call asks for the page size (10), not `page_size=null`.
 * - The request carries the session token, as every other controller (the API answered without it: M-SL9, for the owner).
 * - An API error keeps `logs: []` and sets `error` (the API message, or `true` when it gives none), on `content.error` and on a
 *   throw, so the UI can say it instead of drawing «No data». `reload()` asks the same page again («Try again»).
 * - The state is updated with the functional form (no stale spread), and only the answer of the latest request is kept: a slow
 *   older page never replaces a newer one. A failure keeps the totals of the last good page.
 * - `initialFilters` (setting, author, days) start the list; `changeFilters()` asks page 1 with new ones. Only the filters
 *   the API applies are kept (`effectiveFilters`); `getSettingsLog(id)` finds one log outside the page and `authorsList` names the
 *   admins.
 */
export const SettingsLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings,
    initialFilters
  } = props

  const [{ token }] = useSession()
  const [ordering] = useApi()
  const pageSize = Number(paginationSettings?.pageSize) >= 1 ? Number(paginationSettings.pageSize) : DEFAULT_PAGE_SIZE
  const initialPage = Number(paginationSettings?.initialPage) >= 1 ? Number(paginationSettings.initialPage) : 1

  const [logsList, setLogsList] = useState({ logs: [], loading: true, error: null })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: initialPage,
    pageSize,
    totalItems: null,
    totalPages: null
  })

  const [filters, setFilters] = useState(() => effectiveFilters(initialFilters))
  const [authorsList, setAuthorsList] = useState({ users: [], loading: true, error: null })

  const lastRequest = useRef({ page: initialPage, pageSize, filters })
  const requestId = useRef(0)

  const request = (path) => fetch(`${ordering.root}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  }).then(response => response.json())

  const logsPath = (page, size, nextFilters) => {
    const paging = `orderBy=-id&page=${page}&page_size=${size}`
    const where = whereOf(nextFilters)
    return `/configs/logs?${paging}${where.length ? `&where=${encodeURIComponent(JSON.stringify(where))}` : ''}`
  }

  /**
   * Method to get settings logs from API
   */
  const getSettingsLogs = async (page = 1, size = pageSize, nextFilters = lastRequest.current.filters) => {
    const id = ++requestId.current
    const nextSize = Number(size) >= 1 ? Number(size) : pageSize
    lastRequest.current = { page, pageSize: nextSize, filters: nextFilters }
    try {
      setLogsList(prev => ({ ...prev, loading: true, error: null }))
      const content = await request(logsPath(page, nextSize, nextFilters))
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
        pageSize: Number(content?.pagination?.page_size) >= 1 ? Number(content.pagination.page_size) : nextSize,
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

  // «Try again»: the same page, size and filters as the last request
  const reload = () => getSettingsLogs(lastRequest.current.page, lastRequest.current.pageSize)

  /** New filters: page 1 of them, at the same size. */
  const changeFilters = (next) => {
    const nextFilters = effectiveFilters(next)
    setFilters(nextFilters)
    return getSettingsLogs(1, lastRequest.current.pageSize, nextFilters)
  }

  /** One log by its id (a link to a log that is not on the page). null when there is none or on a failure. */
  const getSettingsLog = async (logId) => {
    try {
      const where = encodeURIComponent(JSON.stringify([{ attribute: 'id', value: logId }]))
      const content = await request(`/configs/logs?where=${where}&page=1&page_size=1`)
      const log = !content?.error && Array.isArray(content?.result) ? content.result[0] : null
      // an API that ignores `where` answers some other log
      return log?.id === logId ? log : null
    } catch (error) {
      return null
    }
  }

  const getAuthors = async () => {
    setAuthorsList(prev => ({ ...prev, loading: true, error: null }))
    try {
      const where = encodeURIComponent(JSON.stringify([{ attribute: 'level', value: [0] }]))
      const content = await request(`/users?where=${where}&params=id,name,lastname,email&orderBy=name&page=1&page_size=${AUTHORS_PAGE_SIZE}`)
      if (content?.error) {
        setAuthorsList({ users: [], loading: false, error: (Array.isArray(content.result) ? content.result[0] : content.result) || true })
        return
      }
      setAuthorsList({ users: content?.result ?? [], loading: false, error: null })
    } catch (error) {
      setAuthorsList({ users: [], loading: false, error: error?.message || true })
    }
  }

  useEffect(() => {
    getSettingsLogs(initialPage, pageSize, filters)
    getAuthors()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          paginationProps={paginationProps}
          getSettingsLogs={getSettingsLogs}
          reload={reload}
          filters={filters}
          changeFilters={changeFilters}
          getSettingsLog={getSettingsLog}
          authorsList={authorsList}
        />
      )}
    </>
  )
}

SettingsLogs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Pagination settings to config pagination behavior
   * {initialPage, pageSize, controlType}
   * initialPage: Initial page to show
   * pageSize: Number of logs to show per page
   * controlType: Can be 'infinity' or 'pages'
   * - infinity: Will show all logs in one page
   * - pages: Will show logs with pages
   */
  paginationSettings: PropTypes.shape({
    initialPage: PropTypes.number,
    pageSize: PropTypes.number,
    controlType: PropTypes.string
  }),
  /**
   * the filters of the first page { configIds, authorIds, from, to } (days as YYYY-MM-DD)
   */
  initialFilters: PropTypes.object
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: DEFAULT_PAGE_SIZE, controlType: 'infinity' }
}
