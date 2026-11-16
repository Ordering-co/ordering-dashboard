import { useEffect, useRef, useState } from 'react'
import { useSettingsHubForm } from './SettingsHubFormContext'

// redesign settings B: what a Settings form tells the hub, and the short «Saved» notice every form shares.

/** How long the «Saved» status stays on the save bar. */
export const SAVED_NOTICE_MS = 4000

/**
 * Tells the hub whether this form has unsaved changes and whether it is saving, so the hub can guard leaving the section
 * (owner decision 17). Without the hub's provider it does nothing. The report is dropped when the form unmounts.
 *
 * @param {string} sectionKey the category key the form edits
 * @param {{ dirty: boolean, saving: boolean }} state
 */
export const useHubFormReport = (sectionKey, { dirty, saving } = {}) => {
  const hub = useSettingsHubForm()
  const reportRef = useRef(null)
  reportRef.current = hub?.report || null
  const reportedKey = useRef(null)

  useEffect(() => {
    const report = reportRef.current
    if (reportedKey.current && reportedKey.current !== sectionKey) report?.(reportedKey.current, null)
    reportedKey.current = sectionKey
    report?.(sectionKey, { dirty: !!dirty, saving: !!saving })
  }, [sectionKey, dirty, saving])

  useEffect(() => () => {
    reportRef.current?.(reportedKey.current, null)
    reportedKey.current = null
  }, [])
}

/**
 * True for {@link SAVED_NOTICE_MS} after a save that ended well. `saving` is the controller's flag; `succeeded` is read
 * on the render where `saving` turns false (no error and nothing left to save). A new save clears it at once.
 */
export const useSavedNotice = ({ saving, succeeded, duration = SAVED_NOTICE_MS } = {}) => {
  const [saved, setSaved] = useState(false)
  const wasSaving = useRef(false)

  useEffect(() => {
    if (saving) {
      wasSaving.current = true
      setSaved(false)
      return
    }
    if (!wasSaving.current) return
    wasSaving.current = false
    if (succeeded) setSaved(true)
  }, [saving, succeeded])

  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), duration)
    return () => clearTimeout(timer)
  }, [saved, duration])

  return saved
}
