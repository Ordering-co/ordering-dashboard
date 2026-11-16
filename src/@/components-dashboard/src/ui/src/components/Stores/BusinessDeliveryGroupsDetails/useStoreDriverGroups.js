import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi, useSession } from '../../../../../index'

// redesign stores 5.7 (G3-27): the driver groups a store is in. GET /drivergroups answers every group of the project and carries,
// on each, `business: [ids]`; the API ignores a `where` on that field and pages its answer. So the hook asks for every page and
// keeps, here, the groups that list the store.
const PARAMS = 'id,name,type,enabled,administrator_id,administrators,drivers,driver_companies,business'
const PAGE_SIZE = 100
// A guard against an API that never says it is done; 100 pages of 100 groups is far past any project.
const MAX_PAGES = 100

// A store in `business` is an id or, in some answers, an object with one.
const idOf = (item) => (item !== null && typeof item === 'object' ? item.id : item)

/** Whether a group of GET /drivergroups lists the store (`business` holds numbers, strings or `{ id }` objects). */
export const groupHasBusiness = (group, businessId) => {
  if (businessId === null || businessId === undefined || !Array.isArray(group?.business)) return false
  return group.business.some(item => {
    const id = idOf(item)
    return id !== null && id !== undefined && String(id) === String(businessId)
  })
}

const messageOf = (result, fallback) => {
  if (Array.isArray(result)) return result.filter(Boolean).join(', ') || fallback
  if (typeof result === 'string' && result) return result
  return fallback
}

/**
 * The driver groups the store is in, read-only.
 *
 * @param {{ id: number | string } | null} business the store
 * @returns {{ groups: object[], loading: boolean, error: string | null, reload: () => void }}
 */
export const useStoreDriverGroups = (business) => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const businessId = business?.id

  const [state, setState] = useState({ groups: [], loading: businessId != null, error: null })
  // The latest request wins: a store that changes, or a «Retry» while one is still on its way, never lets an old answer in.
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    const isCurrent = () => mountedRef.current && request === requestRef.current
    if (businessId === null || businessId === undefined) {
      setState({ groups: [], loading: false, error: null })
      return
    }
    setState(previous => ({ groups: previous.groups, loading: true, error: null }))
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      const found = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await fetch(`${ordering.root}/drivergroups?page=${page}&page_size=${PAGE_SIZE}&params=${PARAMS}`, { method: 'GET', headers })
        const content = await response.json()
        if (!isCurrent()) return
        if (content?.error || !Array.isArray(content?.result)) {
          throw new Error(messageOf(content?.result, `HTTP ${response.status}`))
        }
        found.push(...content.result.filter(group => groupHasBusiness(group, businessId)))
        const pagination = content.pagination
        if (!pagination || pagination.total_pages == null || Number(pagination.current_page) >= Number(pagination.total_pages)) break
      }
      setState({ groups: found, loading: false, error: null })
    } catch (err) {
      if (!isCurrent()) return
      setState({ groups: [], loading: false, error: err?.message || String(err) })
    }
  }, [ordering?.root, token, businessId])

  useEffect(() => {
    load()
  }, [load])

  return { groups: state.groups, loading: state.loading, error: state.error, reload: load }
}
