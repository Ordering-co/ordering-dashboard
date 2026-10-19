import { useSyncExternalStore } from 'react'
import { getRun, isRunExpired, resolveRunStatus, subscribe } from './menuImportRuns'

/**
 * Last import run for {project, businessId, source}, re-rendering on store writes.
 * Stale and expiry rules are applied when reading: no timer, both derive from stored dates.
 * A resolved run older than a day reads as no run at all.
 */
export const useMenuImportRun = ({ project, businessId, source }) => {
  const run = useSyncExternalStore(
    subscribe,
    () => getRun({ project, businessId, source })
  )
  if (!run || isRunExpired(run)) return null
  const status = resolveRunStatus(run)
  return status === run.status ? run : { ...run, status }
}
