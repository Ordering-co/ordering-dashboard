import { useEffect, useRef, useState } from 'react'

// redesign AB-B2 (decision 1; defect M-AB06): the switch of a banner (On / Off), shared by the rows of the list and the header of the
// panel. No confirmation, as `main`: the change is immediate. The controller (`handleUpdateBanner(payload, bannerId)`, AB-B1)
// resolves `{ ok, error }`. The switch is controlled by `banner.enabled`, which only changes on success, so a failure leaves it where
// it was: the interface never lies (in `main` the switch stayed flipped with the old data and nothing said so). A controller that
// resolves nothing (the legacy one) counts as done.
//
// Returns `{ pendingIds, setEnabled(banner, next) }` and renders nothing itself.
//   pendingIds   the banners whose call is in flight
//   setEnabled   resolves `{ ok, error }`, so an AsyncSwitch shows its own notice under the switch that was pressed (a row or the
//                panel header)
// A second call for a banner that is already in flight sends nothing and resolves `{ ok: true }`: there is no new value to report.
//
// redesign AB-B5 (follow-up of the B2-B4 reports): the hook used to also return an `alert` for a page-level dialog. AsyncSwitch already
// says why next to the switch, so the dialog made two notices for one failure; it is gone and the page renders no toggle dialog.

export const useBannerEnabledToggle = ({ handleUpdateBanner } = {}) => {
  const [pendingIds, setPendingIds] = useState([])
  const inFlight = useRef(new Set()) // synchronous: a second press before the render still finds the first one
  const handleRef = useRef(handleUpdateBanner)
  handleRef.current = handleUpdateBanner
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const setEnabled = async (banner, next) => {
    if (!banner || inFlight.current.has(banner.id)) return { ok: true, error: null }
    inFlight.current.add(banner.id)
    setPendingIds(ids => [...ids, banner.id])
    let result
    try {
      result = await handleRef.current?.({ enabled: next }, banner.id)
    } catch (error) {
      result = { ok: false, error: null }
    }
    inFlight.current.delete(banner.id)
    const failed = Boolean(result) && result.ok === false
    if (mounted.current) setPendingIds(ids => ids.filter(id => id !== banner.id))
    return failed ? { ok: false, error: result.error ?? null } : { ok: true, error: null }
  }

  return { pendingIds, setEnabled }
}
