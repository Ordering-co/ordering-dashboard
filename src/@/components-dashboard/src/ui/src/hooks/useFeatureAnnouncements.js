import { useCallback, useEffect, useState } from 'react'
// The contexts directly, not the package index (as useGoogleActionsVisibility)
import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { canOpenDashboardRoute } from '../../../utils/dashboardNavigation'
import { getActiveAnnouncements } from '../../../utils/featureAnnouncements'
import { useGoogleActionsVisibility } from './useGoogleActionsVisibility'

// One list per project and person in this browser, as «Hide guide» (odc-home-guide-hidden)
const storageKey = (project, userId) => `odc-home-news-dismissed:${project}:${userId}`

const readDismissed = (key) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

/**
 * The «What's new» cards this person sees on the Home (utils/featureAnnouncements.js), and `dismiss(id)`, which hides one for
 * this project and person in this browser. The context each announcement's `when` reads: `googleActions` (the project's
 * GET google_actions/status, shared with the rest of the dashboard).
 */
export const useFeatureAnnouncements = () => {
  const [ordering] = useApi()
  const [{ user }] = useSession()
  const { status: googleActions } = useGoogleActionsVisibility()
  const key = storageKey(ordering?.project, user?.id)
  const [dismissed, setDismissed] = useState(() => readDismissed(key))

  useEffect(() => { setDismissed(readDismissed(key)) }, [key])

  const dismiss = useCallback((id) => {
    setDismissed(previous => {
      const next = previous.includes(id) ? previous : [...previous, id]
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [key])

  const announcements = getActiveAnnouncements({
    context: { googleActions },
    canOpen: (url) => canOpenDashboardRoute(url, user?.level),
    dismissed
  })

  return { announcements, dismiss }
}
