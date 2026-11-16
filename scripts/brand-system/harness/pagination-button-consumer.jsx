import React, { useMemo, useState } from 'react'

import { ChatBusinessesListUI } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI/ChatBusinessesList'

const logo = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
const allBusinesses = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  logo,
  name: `Fixture business ${String(index + 1).padStart(2, '0')}`
}))

export const PaginationButtonConsumerFixture = () => {
  const [loadedCount, setLoadedCount] = useState(20)
  const [loadMoreCalls, setLoadMoreCalls] = useState(0)
  const businesses = useMemo(() => allBusinesses.slice(0, loadedCount), [loadedCount])

  const loadMoreBusinesses = () => {
    setLoadMoreCalls(current => current + 1)
    setLoadedCount(allBusinesses.length)
  }

  return (
    <main data-testid='pagination-button-consumer' style={{ boxSizing: 'border-box', height: 720, minWidth: 0, padding: 24, width: '100%' }}>
      <ChatBusinessesListUI
        businessList={{ loading: false, businesses }}
        pagination={{ currentPage: 1, pageSize: 20, totalPages: 2, total: allBusinesses.length }}
        loadMoreBusinesses={loadMoreBusinesses}
      />
      <div dir='ltr'>Loaded records: <output data-testid='pagination-loaded-count'>{loadedCount}</output></div>
      <div dir='ltr'>Additional loads: <output data-testid='pagination-load-more-calls'>{loadMoreCalls}</output></div>
    </main>
  )
}
