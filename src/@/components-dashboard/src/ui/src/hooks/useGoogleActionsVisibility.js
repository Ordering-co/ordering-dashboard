import { useEffect, useState } from 'react'
// The contexts directly, not the package index: the index re-exports the
// CommandPalette, which uses this hook, and the cycle deadlocks module loading
// where the index is mocked (CommandPalette.test.jsx).
import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { isGoogleActionsVisible } from '../../../utils/googleActions'

// One request per project and session, shared by the sidebar, the command
// palette, the Home banner and the Google page. refresh() replaces it and
// every mounted user of the hook gets the new status.
const requests = new Map()
const listeners = new Set()

const fetchStatus = (root, token, { force = false } = {}) => {
  const key = `${root}|${token}`
  if (force || !requests.has(key)) {
    const request = fetch(`${root}/google_actions/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    })
      .then(response => response.json())
      .then(({ error, result }) => (error ? null : result))
      .catch(() => null)
    request.then(status => {
      if (requests.get(key) !== request) return
      if (status === null) {
        requests.delete(key)
        return
      }
      if (force) listeners.forEach(listener => listener(key, status))
    })
    requests.set(key, request)
  }
  return requests.get(key)
}

/**
 * Google Actions Center for the project: `status` from
 * GET google_actions/status and whether its screens show (`visible`).
 * Hidden while loading, on error and for a project that cannot activate
 * and has no store on Google. `refresh()` asks once more (after a store is
 * activated or deactivated); a failed refresh keeps the last status.
 */
export const useGoogleActionsVisibility = () => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const allowed = user?.level === 0 || user?.level === 2
  const [state, setState] = useState({ loading: allowed, status: null })
  const root = ordering?.root
  const enabled = allowed && !!token && !!root

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, status: null })
      return
    }
    let active = true
    const key = `${root}|${token}`
    const listener = (changed, status) => {
      if (active && changed === key) setState({ loading: false, status })
    }
    listeners.add(listener)
    setState(prev => ({ ...prev, loading: true }))
    fetchStatus(root, token).then(status => {
      if (active) setState(prev => ({ loading: false, status: status ?? prev.status }))
    })
    return () => {
      active = false
      listeners.delete(listener)
    }
  }, [root, token, enabled])

  const refresh = () => (enabled ? fetchStatus(root, token, { force: true }) : Promise.resolve(null))

  return { ...state, visible: !state.loading && isGoogleActionsVisible(state.status), refresh }
}
