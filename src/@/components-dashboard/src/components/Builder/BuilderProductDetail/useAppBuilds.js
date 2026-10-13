import { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { useSocketInstance, useWebsocket } from '../../../contexts/WebsocketContext'
import {
  cancelBuilderBuild,
  getBuilderBuildDownload,
  getBuilderBuildLog,
  getBuilderLatestBuilds,
  getBuilderPageFailure,
  requestBuilderBuild,
  retryBuilderBuild
} from '../builderApi'

/** Statuses after which the attempt no longer changes. */
const FINISHED_STATUSES = ['successful', 'failed', 'cancelled']

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
  const [historyVersion, setHistoryVersion] = useState(0)
  const latestRequest = useRef(0)
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

  /** The latest state and the history, once a burst of changes settles. */
  const refreshSoon = () => later('refresh', () => {
    getLatest()
    reloadHistory()
  }, 1000)

  /**
   * After a saved change: a platform whose successful build was up to date
   * may not be anymore. Waits for the edits to settle; `/latest` is costly.
   */
  const noteConfigChanged = () => {
    const platforms = platformsRef.current
    if (!platforms) return
    const mayChange = Object.values(platforms).some(item => item?.successful && item.pending_changes !== true)
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
      getLatest()
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
      setLatestState({ loading: false, platforms: null, error: false })
      return
    }
    getLatest()
  }, [enabled, appId])

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  return {
    latestState,
    reloadLatest: getLatest,
    historyVersion,
    noteConfigChanged,
    requestBuild,
    retryBuild,
    cancelBuild,
    getBuildLog,
    getBuildDownload
  }
}
