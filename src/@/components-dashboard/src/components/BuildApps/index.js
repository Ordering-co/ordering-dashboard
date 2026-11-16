import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'
import { ToastType, useToast } from '../../contexts/ToastContext'
import { openBuildLogs } from './buildLogs'
import { createAppInstallLink, getAppDownloadLink } from './artifactLinks'
import { listAppBuildAttempts } from './buildAttempts'

/** The statuses a build no longer changes from. */
const FINISHED_BUILD_STATUSES = ['successful', 'failed', 'error_request']

export const BuildApps = (props) => {
  const { UIComponent, appId, app, updateAppValues } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)
  const [, { showToast }] = useToast()

  // redesign my-products B1 (M-MP-06): the socket handler reads these, not the values of the render it was made in.
  const appRef = useRef(app)
  const appIdRef = useRef(appId)
  const updateAppValuesRef = useRef(updateAppValues)
  appRef.current = app
  appIdRef.current = appId
  updateAppValuesRef.current = updateAppValues

  const [buildAppState, setBuildAppState] = useState({ loading: false, result: null, error: null })
  const [downloadAppState, setDownloadAppState] = useState({ loading: false, result: null, error: null })
  // a download link is being asked for (read on click, not from the render the click was made in)
  const downloading = useRef(false)
  // The attempts of the app (the last builds of each file type), read when the Builds section asks for them: `attempts` is null
  // until they arrive. `asked` is the app they were asked for, so opening the section twice asks once.
  const [buildAttemptsState, setBuildAttemptsState] = useState({ loading: false, attempts: null, error: false })
  const attemptsRequest = useRef({ id: 0, asked: null })
  const attemptsTimer = useRef(null)
  const [businessesList, setBusinessesList] = useState({ loading: true, businesses: [], error: null })

  const requestBase = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.token}`
    }
  }

  /**
   * Method to update App options (name, version...)
   */
  const updateProductApp = async (values) => {
    const requestOptions = {
      ...requestBase,
      headers: {
        ...requestBase.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values)
    }
    const response = await fetch(`${ordering.root}/builder/apps/${appId}`, requestOptions)
    const { error, result } = await response.json()
    return { error, result }
  }

  /**
   * Method to update Images and colors from theme.json
   */
  const updateBaseActions = async ({ body, type, id }) => {
    if (!id) return { error: true }

    const requestOptions = {
      ...requestBase,
      headers: {
        ...requestBase.headers,
        ...(type === 'colors' ? { 'Content-Type': 'application/json' } : {})
      },
      body
    }
    const response = await fetch(`${ordering.root}/builder/apps/${appId}/base_actions/${id}`, requestOptions)
    const { error, result } = await response.json()
    return { error, result }
  }

  /**
   * Method to update App constants
   */
  const updateBaseContants = async ({ body, id }) => {
    if (!id) return { error: true }

    const requestOptions = {
      ...requestBase,
      headers: {
        ...requestBase.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
    const response = await fetch(`${ordering.root}/builder/apps/${appId}/base_constants/${id}`, requestOptions)
    const { error, result } = await response.json()
    return { error, result }
  }

  /**
   * Method to update credentials for Android & iOS
   */
  const updateProductAppCredentials = async ({ body, platform }) => {
    const requestOptions = { ...requestBase, body }
    const response = await fetch(`${ordering.root}/builder/apps/${appId}/credentials/${platform}`, requestOptions)
    const { error, result } = await response.json()
    return { error, result }
  }

  /**
   * Method to open build app logs
   */
  const getBuildLogs = async ({ platform }) => {
    const { error, message } = await openBuildLogs({ root: ordering.root, appId, platform, token: session?.token })
    if (error) showToast(ToastType.Error, message)
  }

  /**
   * The app's build attempts, newest first, for the file types of the Builds section. Asked for once per app; `reload` asks again
   * (a build was requested or ended). The answer of a request that is no longer the last one is dropped.
   */
  const loadBuildAttempts = async ({ reload = false } = {}) => {
    const id = appIdRef.current
    if (!id || !session?.token) return
    if (!reload && attemptsRequest.current.asked === id) return
    const requestId = ++attemptsRequest.current.id
    // the attempts of another app are not this one's
    const another = attemptsRequest.current.asked !== id
    attemptsRequest.current.asked = id
    setBuildAttemptsState(prev => ({ loading: true, attempts: another ? null : prev.attempts, error: false }))
    const answer = await listAppBuildAttempts({ root: ordering.root, token: session?.token, appId: id })
    if (requestId !== attemptsRequest.current.id) return
    setBuildAttemptsState(prev => answer.ok
      ? { loading: false, attempts: answer.attempts, error: false }
      : { ...prev, loading: false, error: true })
  }

  /** Reads the attempts again once a burst of changes settles, when the Builds section has asked for them. */
  const reloadBuildAttemptsSoon = () => {
    if (attemptsRequest.current.asked !== appIdRef.current) return
    clearTimeout(attemptsTimer.current)
    attemptsTimer.current = setTimeout(() => loadBuildAttempts({ reload: true }), 1000)
  }

  /**
   * Method to create a build app from API. Answers `{ ok }` too, for the dialog that asked for it.
   */
  const buildApp = async (bodyToSend) => {
    if (!bodyToSend) return
    const appId = bodyToSend.appId
    delete bodyToSend.appId
    try {
      setBuildAppState({ ...buildAppState, loading: true })
      const requestOptions = {
        ...requestBase,
        headers: {
          ...requestBase.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyToSend)
      }
      const response = await fetch(`${ordering.root}/builder/apps/${appId}/run/build`, requestOptions)
      const { error, result } = await response.json()

      if (!error) {
        // redesign my-products B1 (M-MP-06): replace or add the build without mutating the app's list.
        const builds = [...(app?.builds ?? [])]
        const indexToUpdate = builds.findIndex(build => build.platform === result?.platform)
        if (indexToUpdate !== -1) {
          builds[indexToUpdate] = { ...builds[indexToUpdate], ...result }
        } else {
          builds.push(result)
        }
        updateAppValues({ builds })
        reloadBuildAttemptsSoon()
      }

      setBuildAppState({
        ...buildAppState,
        loading: false,
        error: error ? result : null,
        result: error ? [result] : result
      })
      return { ok: !error }
    } catch (err) {
      setBuildAppState({
        ...buildAppState,
        loading: false,
        error: err?.message ?? err
      })
      return { ok: false }
    }
  }

  // redesign my-products B1 (M-MP-13): a failed removal says so (an error answer or a failed request).
  const deleteCertificates = async ({ platform }) => {
    try {
      const response = await fetch(`${ordering.root}/builder/apps/${appId}/credentials/${platform}/run/remove_local`, requestBase)
      const { error, result } = await response.json()
      if (error) {
        showToast(ToastType.Error, Array.isArray(result) ? result[0] : result)
      } else {
        showToast(ToastType.Success, result)
      }
    } catch (err) {
      showToast(ToastType.Error, err?.message ?? String(err))
    }
  }

  /**
   * Download the app's latest file of the platform, mode and file through a signed link of 15 minutes, asked for on click (the
   * public `downloads/*` route is not used). Answers `{ ok, errorCodes }` so the UI says why it failed.
   *
   * One download at a time, as the Builder's Builds card (`downloadingId`): a click while a link is being asked for is ignored and
   * answers null, so `downloadAppState` is always the state of the one in progress.
   *
   * The link is opened in this tab on purpose. The storage answers it as an attachment (api-core signs it with
   * `ResponseContentDisposition`), so the browser downloads the file and the Dashboard stays. The other ways are not better:
   * - a new tab (`target='_blank'` or `window.open`) is opened after the request, outside the
   *   click, and Safari blocks it as a pop-up: nothing would be downloaded there;
   * - a hidden frame keeps the Dashboard when the storage answers an error instead of the file, but then nobody sees that error
   *   (the page cannot read a frame of another origin): the button would do nothing, with no way to say why.
   * What is left is a storage that answers an error page to a link signed a moment ago: the browser shows it in place of the
   * Dashboard, and Back returns to it.
   */
  const downloadApp = async ({ type, platform, mode, file }) => {
    if (downloading.current) return null
    downloading.current = true
    setDownloadAppState({ loading: true, type, result: null, error: null })
    const answer = await getAppDownloadLink({ root: ordering.root, token: session?.token, appId, platform, mode, file })
    if (answer.ok) {
      const link = document.createElement('a')
      link.href = answer.result.url
      link.rel = 'noopener noreferrer'
      link.click()
    }
    downloading.current = false
    setDownloadAppState({ loading: false, type: null, result: null, error: answer.ok ? null : answer.errorCodes })
    return { ok: answer.ok, errorCodes: answer.errorCodes }
  }

  /**
   * A signed link of 24 hours that installs the app's latest APK or ad hoc IPA on a phone, for the QR: `{ ok, result, errorCodes }`.
   */
  const createInstallLink = ({ platform, mode, file }) =>
    createAppInstallLink({ root: ordering.root, token: session?.token, appId, platform, mode, file })

  /**
   * Method to send app to play store directly
   */
  const sendAppToStore = () => { } // 'missing endpoint'

  // redesign my-products B1 (M-MP-06): the socket updates the build of that platform, never the root of the
  // app, and reads the app of the last render (the handler is registered once, so it must not close over an old one).
  const handleBuildApp = (event) => {
    if (event?.builder_app_id !== appIdRef.current) return
    const builds = [...(appRef.current?.builds ?? [])]
    const indexToUpdate = builds.findIndex(build => build.platform === event?.platform)
    const changes = event?.changes?.reduce((obj, item) => ({
      ...obj,
      [item.attribute]: item.new ?? builds[indexToUpdate]?.[item.attribute]
    }), {})
    if (indexToUpdate !== -1) {
      builds[indexToUpdate] = { ...builds[indexToUpdate], ...changes }
    } else {
      builds.push({ platform: event?.platform, ...changes })
    }
    updateAppValuesRef.current?.({
      builds,
      ...(changes?.built_apps !== undefined ? { built_apps: changes.built_apps } : {})
    })
    // a new attempt or one that ended: the last build of its file type is another
    if (changes?.attempt_id !== undefined || FINISHED_BUILD_STATUSES.includes(changes?.status)) reloadBuildAttemptsSoon()
  }

  /**
 * Method to get businesses from API
 */
  const getBusinesses = async () => {
    try {
      setBusinessesList({ ...businessesList, loading: false })
      let where = null
      const conditions = []
      conditions.push({
        attribute: 'enabled',
        value: true
      })
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      const { content: { error, result } } = await ordering
        .setAccessToken(session.token)
        .businesses()
        .select(['name', 'logo', 'slug'])
        .where(where)
        .asDashboard()
        .get()
      if (!error) {
        setBusinessesList({ ...businessesList, loading: false, businesses: result })
      }
    } catch (err) {
      setBusinessesList({ ...businessesList, loading: false, error: [err.message] })
    }
  }

  /**
   * Sockets implementations
   */
  useEffect(() => {
    socket.on('app_build_change', handleBuildApp)

    return () => {
      socket.off('app_build_change', handleBuildApp)
    }
  }, [socket, session])

  useEffect(() => {
    if (!session?.user || !ioSocket) return
    const room = {
      project: ordering.project,
      room: 'builder_app_builds',
      user_id: session?.user?.id,
      role: 'manager'
    }
    const handleJoinRoom = () => socket.join(room)
    if (ioSocket.connected) handleJoinRoom()
    ioSocket.on('connect', handleJoinRoom)

    return () => {
      socket.leave(room)
      ioSocket.off('connect', handleJoinRoom)
    }
  }, [ioSocket, session])

  useEffect(() => () => {
    clearTimeout(attemptsTimer.current)
    // an answer on its way is for a controller that is gone; one that comes back (React's StrictMode in development) asks again
    attemptsRequest.current = { id: attemptsRequest.current.id + 1, asked: null }
  }, [])

  useEffect(() => {
    if (app?.base?.code === 'app_marketplace_x') {
      getBusinesses()
    }
  }, [app?.base?.code])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          app={app}
          downloadAppState={downloadAppState}
          buildAppState={buildAppState}
          setBuildAppState={setBuildAppState}
          buildApp={buildApp}
          sendAppToStore={sendAppToStore}
          downloadApp={downloadApp}
          createInstallLink={createInstallLink}
          buildAttemptsState={buildAttemptsState}
          loadBuildAttempts={loadBuildAttempts}
          getBuildLogs={getBuildLogs}
          updateProductApp={updateProductApp}
          updateBaseActions={updateBaseActions}
          updateBaseContants={updateBaseContants}
          updateProductAppCredentials={updateProductAppCredentials}
          deleteCertificates={deleteCertificates}
          businessesList={businessesList}
        />
      )}
    </>
  )
}

BuildApps.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
