import { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { useSocketInstance, useWebsocket } from '../../../contexts/WebsocketContext'
import {
  cancelBuilderBuild,
  createBuilderInstallLink,
  getBuilderBuildDownload,
  getBuilderBuildLog,
  getBuilderLatestBuilds,
  getBuilderPageFailure,
  listBuilderBuilds,
  requestBuilderBuild,
  retryBuilderBuild
} from '../builderApi'

/** Statuses after which the attempt no longer changes. */
const FINISHED_STATUSES = ['successful', 'failed', 'cancelled']

/**
 * The Builds card shows the latest attempt of each file type (APK, AAB, ad
 * hoc…), which `/latest` doesn't say: it reads the history, newest first, a
 * page of 50 at a time, until every type has its attempt or the history ends.
 * Past ATTEMPT_PAGES pages an older type is left out.
 */
const ATTEMPT_PAGE_SIZE = 50
const ATTEMPT_PAGES = 4

/** The types the card looks for: their latest attempt is somewhere in the history. */
const ATTEMPT_TYPES = { ios: ['ad-hoc', 'app-store'], android: ['release|assemble', 'release|bundle', 'debug'] }
const attemptTypeKey = (attempt) => attempt.platform === 'android'
  ? (attempt.mode === 'debug' ? 'debug' : `release|${attempt.type === 'bundle' ? 'bundle' : 'assemble'}`)
  : attempt.mode

/** Refusals that mean the screen shows an old state of the builds. */
const STALE_CODES = ['build.in_progress', 'build.not_latest', 'build.not_retryable', 'build.not_running', 'build.source_missing']

/**
 * The builds of a Builder app: where each platform stands
 * (`GET …/builds/latest`) and the actions on its attempts. The latest state
 * follows `app_build_change`; the history reloads when `historyVersion` moves.
 */
export const useAppBuilds = ({ productId, appId, enabled, onPageFailure }) => {
  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)
  const [latestState, setLatestState] = useState({ loading: false, platforms: null, error: false })
  const [attemptsState, setAttemptsState] = useState({ loading: false, attempts: null, error: false })
  const [historyVersion, setHistoryVersion] = useState(0)
  const latestRequest = useRef(0)
  const attemptsRequest = useRef(0)
  const platformsRef = useRef(null)
  const timers = useRef({})

  platformsRef.current = latestState.platforms

  const later = (key, fn, delay) => {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(fn, delay)
  }

  const reloadHistory = () => setHistoryVersion(version => version + 1)

  const getLatest = async () => {
    if (!enabled) return
    const requestId = ++latestRequest.current
    setLatestState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderLatestBuilds(ordering, token, productId, appId)
    if (requestId !== latestRequest.current) return
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure(pageFailure)
      setLatestState(prev => ({ ...prev, loading: false, error: true }))
      return
    }
    setLatestState({ loading: false, platforms: response.result?.platforms || {}, error: false })
  }

  /** The newest attempts of the app, enough to find the latest of each file type (ATTEMPT_PAGES). */
  const getAttempts = async () => {
    if (!enabled) return
    const requestId = ++attemptsRequest.current
    setAttemptsState(prev => ({ ...prev, loading: true, error: false }))
    const attempts = []
    const missing = new Set(Object.entries(ATTEMPT_TYPES).flatMap(([platform, types]) => types.map(type => `${platform}|${type}`)))
    for (let page = 1; page <= ATTEMPT_PAGES && missing.size > 0; page++) {
      const response = await listBuilderBuilds(ordering, token, productId, appId, { page, pageSize: ATTEMPT_PAGE_SIZE })
      if (requestId !== attemptsRequest.current) return
      if (response.error) {
        const pageFailure = getBuilderPageFailure(response)
        if (pageFailure) onPageFailure(pageFailure)
        setAttemptsState(prev => ({ ...prev, loading: false, error: true }))
        return
      }
      const rows = Array.isArray(response.result) ? response.result : []
      rows.forEach(attempt => {
        attempts.push(attempt)
        missing.delete(`${attempt.platform}|${attemptTypeKey(attempt)}`)
      })
      const totalPages = Number(response.pagination?.total_pages) || 0
      if (rows.length < ATTEMPT_PAGE_SIZE || page >= totalPages) break
    }
    setAttemptsState({ loading: false, attempts, error: false })
  }

  /** `/latest` and the attempts of each file type: the card's two sources. */
  const reloadLatest = () => {
    getLatest()
    getAttempts()
  }

  /** The latest state and the history, once a burst of changes settles. */
  const refreshSoon = () => later('refresh', () => {
    reloadLatest()
    reloadHistory()
  }, 1000)

  /**
   * After a saved change: a platform whose successful build was up to date
   * may not be anymore. Waits for the edits to settle; `/latest` is costly.
   */
  const noteConfigChanged = () => {
    const platforms = platformsRef.current
    if (!platforms) return
    // a file type whose successful build is still up to date (or the platform's, on an API without the list)
    const mayChange = Object.values(platforms).some(item => item?.successful && (
      Array.isArray(item.successful_by_type)
        ? item.successful_by_type.some(entry => entry.pending_changes !== true)
        : item.pending_changes !== true
    ))
    if (mayChange) later('changes', getLatest, 1500)
  }

  const setPlatformLatest = (platform, attempt) => {
    setLatestState(prev => {
      if (!prev.platforms) return prev
      const current = prev.platforms[platform] || { successful: null, pending_changes: null }
      return { ...prev, platforms: { ...prev.platforms, [platform]: { ...current, latest: attempt } } }
    })
  }

  /** Answers `{ ok, result, errorCodes, checks }`, after replacing the page if it has to. */
  const settle = (response) => {
    if (!response.error) return { ok: true, result: response.result, errorCodes: [], checks: null }
    const pageFailure = getBuilderPageFailure(response)
    if (pageFailure) onPageFailure(pageFailure)
    if (response.errorCodes.some(code => STALE_CODES.includes(code))) {
      reloadLatest()
      reloadHistory()
    }
    return { ok: false, result: null, errorCodes: response.errorCodes, checks: response.checks ?? null }
  }

  const afterAttempt = (platform, answer) => {
    if (answer.ok) {
      setPlatformLatest(platform, answer.result)
      reloadHistory()
    }
    return answer
  }

  /** `{ mode, type }`: iOS `ad-hoc` / `app-store`; Android `release` with `assemble` / `bundle`. */
  const requestBuild = async (platform, { mode, type }) =>
    afterAttempt(platform, settle(await requestBuilderBuild(ordering, token, productId, appId, { platform, mode, type })))

  const retryBuild = async (attempt) =>
    afterAttempt(attempt.platform, settle(await retryBuilderBuild(ordering, token, productId, appId, attempt.id)))

  const cancelBuild = async (attempt) =>
    afterAttempt(attempt.platform, settle(await cancelBuilderBuild(ordering, token, productId, appId, attempt.id)))

  const getBuildLog = async (attemptId) =>
    settle(await getBuilderBuildLog(ordering, token, productId, appId, attemptId))

  const getBuildDownload = async (attemptId) =>
    settle(await getBuilderBuildDownload(ordering, token, productId, appId, attemptId))

  /** A link to install the attempt's file on a phone that lasts 24 hours. */
  const createInstallLink = async (attemptId) =>
    settle(await createBuilderInstallLink(ordering, token, productId, appId, attemptId))

  /**
   * `app_build_change` carries the platform and the changed columns of
   * `builder_app_builds`, not the attempt. A new attempt or a finished one
   * reloads; a status in between is patched onto the latest attempt. That
   * row never says `cancelled`: a cancelled build arrives as `failed` with
   * `build_cancelled`, as My Products reads it.
   */
  const handleBuildChange = (event) => {
    if (String(event?.builder_app_id) !== String(appId)) return
    const changes = Object.fromEntries((Array.isArray(event.changes) ? event.changes : []).map(item => [item.attribute, item.new]))
    if ('attempt_id' in changes) {
      refreshSoon()
      return
    }
    if (!changes.status) return
    setLatestState(prev => {
      const current = prev.platforms?.[event.platform]
      if (!current?.latest) return prev
      const errorCode = changes.error_code ?? current.latest.error_code
      const status = changes.status === 'failed' && errorCode === 'build_cancelled' ? 'cancelled' : changes.status
      const latest = { ...current.latest, status, error_code: errorCode }
      return { ...prev, platforms: { ...prev.platforms, [event.platform]: { ...current, latest } } }
    })
    if (FINISHED_STATUSES.includes(changes.status)) refreshSoon()
  }

  useEffect(() => {
    if (!enabled) return
    socket.on('app_build_change', handleBuildChange)
    return () => socket.off('app_build_change', handleBuildChange)
  }, [socket, enabled, appId])

  useEffect(() => {
    if (!enabled || !user || !ioSocket) return
    const room = { project: ordering.project, room: 'builder_app_builds', user_id: user.id, role: 'manager' }
    const join = () => socket.join(room)
    if (ioSocket.connected) join()
    ioSocket.on('connect', join)
    return () => {
      socket.leave(room)
      ioSocket.off('connect', join)
    }
  }, [ioSocket, enabled, user?.id])

  useEffect(() => {
    if (!enabled) {
      latestRequest.current++
      attemptsRequest.current++
      setLatestState({ loading: false, platforms: null, error: false })
      setAttemptsState({ loading: false, attempts: null, error: false })
      return
    }
    reloadLatest()
  }, [enabled, appId])

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  return {
    latestState,
    reloadLatest,
    attemptsState,
    reloadAttempts: getAttempts,
    historyVersion,
    noteConfigChanged,
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload,
    createInstallLink
  }
}
