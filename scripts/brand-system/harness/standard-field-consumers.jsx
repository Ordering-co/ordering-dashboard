import React, { useEffect, useMemo, useState } from 'react'

import { SchoolUserStudents } from '../../../src/@/components-dashboard/src/ui/src/components/Schools/SchoolUserStudents'
// (O-7): the open lists read the --od-x-layer-* roles, loaded app-wide by src/index.js; as in the app
import '../../../src/brand/candidates.css'

const fixtureRoot = 'https://school-standard-field.fixture.invalid'
const schools = [
  { id: 101, name: 'North Academy' },
  { id: 102, name: 'South Academy with a long localized name' }
]
const grades = [{ id: 301, name: 'Grade 3' }, { id: 302, name: 'Grade 4' }]
const classrooms = [{ id: 201, name: 'Room A' }, { id: 202, name: 'Room B' }]

const response = body => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})

const createOrdering = () => ({
  root: fixtureRoot,
  businesses: () => {
    const query = {
      asDashboard: () => query,
      select: () => query,
      where: () => query,
      get: async () => ({
        content: {
          result: schools,
          pagination: { total_pages: 1 }
        }
      })
    }
    return query
  }
})

export const StandardFieldConsumersFixture = () => {
  const ordering = useMemo(createOrdering, [])
  const [ready, setReady] = useState(false)
  const [requests, setRequests] = useState([])
  const [writes, setWrites] = useState([])
  const [toasts, setToasts] = useState([])

  globalThis.__OD_SCHOOL_STANDARD_FIELD_FIXTURE__ = {
    ordering,
    showToast: (type, message) => setToasts(current => [...current, { type, message }])
  }

  useEffect(() => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url)
      if (url.origin !== fixtureRoot) return originalFetch(input, init)

      const method = init.method || 'GET'
      setRequests(current => [...current, `${method} ${url.pathname}`])

      if (method === 'GET' && url.pathname.endsWith('/grades')) {
        return response({ error: false, result: grades })
      }
      if (method === 'GET' && url.pathname.endsWith('/classrooms')) {
        return response({ error: false, result: classrooms })
      }
      if (method === 'GET' && url.pathname.endsWith('/students')) {
        return response({ error: false, result: [] })
      }
      if (method === 'POST' && url.pathname.endsWith('/students')) {
        const payload = JSON.parse(init.body)
        setWrites(current => [...current, { method, pathname: url.pathname, payload }])
        return response({ error: false, result: { id: 9001, ...payload } })
      }
      return response({ error: true, result: ['Unexpected synthetic school request'] })
    }
    setReady(true)
    return () => {
      globalThis.fetch = originalFetch
      delete globalThis.__OD_SCHOOL_STANDARD_FIELD_FIXTURE__
    }
  }, [])

  return (
    <main data-testid='standard-field-consumers' style={{ boxSizing: 'border-box', minWidth: 0, padding: 24, width: '100%' }}>
      {ready && <SchoolUserStudents userId={7001} />}
      <output data-testid='school-requests'>{JSON.stringify(requests)}</output>
      <output data-testid='school-writes'>{JSON.stringify(writes)}</output>
      <output data-testid='school-toasts'>{JSON.stringify(toasts)}</output>
    </main>
  )
}
