import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { getBuilderPageFailure, listBuilderBuilds } from '../builderApi'

const PAGE_SIZE = 10

/**
 * The build history of a Builder app, newest first, by
 * platform and status. Reloads its page when `version` moves (a build was
 * asked for, retried, cancelled or finished).
 */
export const BuilderAppBuilds = (props) => {
  const { UIComponent, productId, appId, version, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [filters, setFilters] = useState({ platform: null, statuses: [] })
  const [page, setPage] = useState(1)
  const [historyState, setHistoryState] = useState({ loading: true, builds: [], pagination: null, error: false })
  const historyRequest = useRef(0)

  const getHistory = async () => {
    const requestId = ++historyRequest.current
    setHistoryState(prev => ({ ...prev, loading: true, error: false }))
    const response = await listBuilderBuilds(ordering, token, productId, appId, { page, pageSize: PAGE_SIZE, ...filters })
    if (requestId !== historyRequest.current) return
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      setHistoryState(prev => ({ ...prev, loading: false, error: true }))
      return
    }
    setHistoryState({
      loading: false,
      builds: Array.isArray(response.result) ? response.result : [],
      pagination: response.pagination || null,
      error: false
    })
  }

  /** `{ platform, statuses }`; any change goes back to the first page. */
  const changeFilters = (next) => {
    setFilters(prev => ({ ...prev, ...next }))
    setPage(1)
  }

  useEffect(() => {
    if (!token || !productId || !appId) return
    getHistory()
  }, [token, productId, appId, ordering.root, page, filters, version])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          historyState={historyState}
          filters={filters}
          changeFilters={changeFilters}
          page={page}
          pageSize={PAGE_SIZE}
          changePage={setPage}
          reloadHistory={getHistory}
        />
      )}
    </>
  )
}
