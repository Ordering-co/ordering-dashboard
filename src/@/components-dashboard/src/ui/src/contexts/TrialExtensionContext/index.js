import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'styled-components'
import { useSession } from '../../../../index'
import { useProjectState } from '../ProjectContext'
import {
  buildTrialExtensionBookingUrl,
  getTrialExtensionEligibility,
  isWhiteLabelProject
} from '../../utils/trialExtension'

/**
 * Create TrialExtensionContext
 * Shared state for the "extend your free trial to 14 days" offer: eligibility, the single
 * booking modal (popup / banner / Home card all open the same modal), and per-session /
 * per-project dismiss + booked flags kept in session/local storage.
 */
export const TrialExtensionContext = createContext()

const bookedStorageKey = (projectCode) => `trial_extension_booked:${projectCode}`
const popupShownStorageKey = (projectCode) => `trial_extension_popup_shown:${projectCode}`
const bannerDismissedStorageKey = (projectCode) => `trial_extension_banner_dismissed:${projectCode}`

const getStorage = (kind) => {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch (error) {
    return null
  }
}

const safeStorageGet = (kind, key) => {
  const storage = getStorage(kind)
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch (error) {
    return null
  }
}

const safeStorageSet = (kind, key, value) => {
  const storage = getStorage(kind)
  if (!storage) return
  try {
    storage.setItem(key, value)
  } catch (error) {
    // Storage can throw (Safari private mode, quota, disabled cookies): the offer still
    // works in-memory for the rest of the session, it just won't persist across reloads.
  }
}

const BOOKED_URL_PARAM = 'trial_extension_booked'

// How often the offer re-evaluates "now" while the tab stays open (trial end, days left).
export const TRIAL_EXTENSION_CLOCK_INTERVAL_MS = 60 * 1000

/**
 * ordering-accounts' auto-login redirect appends `&trial_extension_booked=1` when the person
 * already booked the call at checkout, before ever reaching the dashboard. Read once, at
 * mount time: `token`/`project` query params may be stripped from the URL later by the app.
 */
const readBookedFromUrl = () => {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get(BOOKED_URL_PARAM) === '1'
  } catch (error) {
    return false
  }
}

/**
 * Drops `trial_extension_booked` from the current URL (keeping every other param and the
 * hash) so a reload, a shared link or a later project switch can't re-apply it.
 */
const removeBookedParamFromUrl = () => {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(BOOKED_URL_PARAM)) return
    url.searchParams.delete(BOOKED_URL_PARAM)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch (error) {
    // Non-critical: the flag was already consumed in memory and persisted for this project.
  }
}

const EMPTY_FLAGS = { projectCode: null, booked: false, justBooked: false, bannerDismissed: false }

export const TrialExtensionProvider = ({ children, config, isWhiteLabel }) => {
  const [{ auth, user }] = useSession()
  const [projectState] = useProjectState()
  const theme = useTheme()

  const projectCode = projectState?.project?.code || null
  const trialSubscription = projectState?.trialSubscription || null
  // Only the deployment flag excludes the offer; `white_label_module` does not (see isWhiteLabelProject).
  const whiteLabel = isWhiteLabelProject({ isWhiteLabel })

  // `trial_extension_booked=1` is consumed at most once, for the first project resolved.
  const bookedFromUrlPendingRef = useRef(readBookedFromUrl())

  // Per-project flags. They only apply while `flags.projectCode` matches the current project:
  // after a project switch, nothing (booked, dismissed, the auto-popup) acts on the new project
  // until its own storage has been read. This also gates the auto-popup against reading
  // `available` computed from a pre-storage-read `booked`.
  const [flags, setFlags] = useState(EMPTY_FLAGS)
  const flagsResolved = Boolean(projectCode) && flags.projectCode === projectCode
  const booked = flagsResolved && flags.booked
  const justBooked = flagsResolved && flags.justBooked
  const bannerDismissed = flagsResolved && flags.bannerDismissed

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSource, setModalSource] = useState(null)
  const popupHandledForRef = useRef(null)

  // `now` must move while the tab stays open, or the offer outlives the trial and the days
  // left freeze. Tick every minute and whenever the tab becomes visible again.
  const [now, setNow] = useState(() => Date.now())
  const hasTrial = Boolean(trialSubscription)
  useEffect(() => {
    if (!hasTrial || typeof window === 'undefined') return
    const tick = () => setNow(Date.now())
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick()
    }
    const intervalId = window.setInterval(tick, TRIAL_EXTENSION_CLOCK_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hasTrial])

  // Once the project code is known, resolve its booked/banner-dismissed flags from storage.
  useEffect(() => {
    if (!projectCode) return

    let isBooked = Boolean(safeStorageGet('local', bookedStorageKey(projectCode)))

    if (bookedFromUrlPendingRef.current) {
      bookedFromUrlPendingRef.current = false
      removeBookedParamFromUrl()
      if (!isBooked) {
        safeStorageSet('local', bookedStorageKey(projectCode), new Date().toISOString())
        isBooked = true
      }
    }

    setFlags({
      projectCode,
      booked: isBooked,
      justBooked: false,
      bannerDismissed: Boolean(safeStorageGet('session', bannerDismissedStorageKey(projectCode)))
    })
  }, [projectCode])

  // A project switch closes a modal opened for the previous project.
  useEffect(() => {
    setIsModalOpen(false)
    setModalSource(null)
  }, [projectCode])

  const eligibility = useMemo(() => getTrialExtensionEligibility({
    config,
    user,
    trialSubscription,
    booked,
    whiteLabel,
    now
  }), [config, user, trialSubscription, booked, whiteLabel, now])

  const available = flagsResolved && eligibility.available
  const { daysRemaining, trialEnd } = eligibility

  const embedDomain = typeof window !== 'undefined' ? window.location.host : ''
  const primaryColor = theme?.colors?.primary
  const textColor = theme?.colors?.headingColor
  const backgroundColor = theme?.colors?.backgroundPage

  const bookingUrl = useMemo(() => buildTrialExtensionBookingUrl({
    baseUrl: config?.booking_url,
    user,
    project: projectState?.project,
    source: 'dashboard',
    embedDomain,
    primaryColor,
    textColor,
    backgroundColor
  }), [config?.booking_url, user, projectState?.project, embedDomain, primaryColor, textColor, backgroundColor])

  const fallbackUrl = useMemo(() => buildTrialExtensionBookingUrl({
    baseUrl: config?.booking_url,
    user,
    project: projectState?.project,
    source: 'dashboard',
    primaryColor,
    textColor,
    backgroundColor
  }), [config?.booking_url, user, projectState?.project, primaryColor, textColor, backgroundColor])

  const openBooking = useCallback((source) => {
    if (!projectCode) return
    setModalSource(source || null)
    setIsModalOpen(true)
  }, [projectCode])

  const closeBooking = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const dismissBanner = useCallback(() => {
    if (!projectCode) return
    safeStorageSet('session', bannerDismissedStorageKey(projectCode), '1')
    setFlags(prev => prev.projectCode === projectCode
      ? { ...prev, bannerDismissed: true }
      : prev)
  }, [projectCode])

  const markBooked = useCallback(() => {
    if (!projectCode) return
    safeStorageSet('local', bookedStorageKey(projectCode), new Date().toISOString())
    setFlags(prev => prev.projectCode === projectCode
      ? { ...prev, booked: true, justBooked: true }
      : prev)
  }, [projectCode])

  // If the offer is withdrawn while the modal is open (the trial ends, the feature is turned
  // off), close it. A booking also makes the offer unavailable, but then the modal stays open
  // to show the success state.
  const offerWithdrawn = isModalOpen && !available && !booked
  useEffect(() => {
    if (!offerWithdrawn) return
    setIsModalOpen(false)
    setModalSource(null)
  }, [offerWithdrawn])

  // Auto-open the modal at most once per browser session and project, only once we know the
  // visitor is both authenticated and eligible, and only after this project's flags resolved.
  useEffect(() => {
    if (!auth || !projectCode || !available || popupHandledForRef.current === projectCode) return
    popupHandledForRef.current = projectCode

    const key = popupShownStorageKey(projectCode)
    if (safeStorageGet('session', key)) return

    safeStorageSet('session', key, '1')
    setModalSource('popup')
    setIsModalOpen(true)
  }, [auth, projectCode, available])

  const value = useMemo(() => ({
    available,
    booked,
    justBooked,
    daysRemaining,
    trialEnd,
    bookingUrl,
    fallbackUrl,
    isModalOpen,
    modalSource,
    openBooking,
    closeBooking,
    bannerDismissed,
    dismissBanner,
    markBooked
  }), [
    projectCode,
    available,
    booked,
    justBooked,
    daysRemaining,
    trialEnd,
    bookingUrl,
    fallbackUrl,
    isModalOpen,
    modalSource,
    openBooking,
    closeBooking,
    bannerDismissed,
    dismissBanner,
    markBooked
  ])

  return (
    <TrialExtensionContext.Provider value={value}>
      {children}
    </TrialExtensionContext.Provider>
  )
}

const DEFAULT_CONTEXT = {
  available: false,
  booked: false,
  justBooked: false,
  daysRemaining: 0,
  trialEnd: null,
  bookingUrl: '',
  fallbackUrl: '',
  isModalOpen: false,
  modalSource: null,
  openBooking: () => {},
  closeBooking: () => {},
  bannerDismissed: false,
  dismissBanner: () => {},
  markBooked: () => {}
}

export function useTrialExtension () {
  const context = useContext(TrialExtensionContext)
  return context || DEFAULT_CONTEXT
}
