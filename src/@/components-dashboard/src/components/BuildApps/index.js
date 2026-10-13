import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useWebsocket, useSocketInstance } from '../../contexts/WebsocketContext'
import { ToastType, useToast } from '../../contexts/ToastContext'
import { openBuildLogs } from './buildLogs'

export const BuildApps = (props) => {
  const { UIComponent, appId, app, updateAppValues } = props

  const [ordering] = useApi()
  const [session] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)
  const [, { showToast }] = useToast()

  const [buildAppState, setBuildAppState] = useState({ loading: false, result: null, error: null })
  const [downloadAppState, setDownloadAppState] = useState({ loading: false, result: null, error: null })
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
   * Method to create a build app from API
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
        const builds = app?.builds
        const indexToUpdate = builds?.findIndex(build => build.platform === result?.platform)
        if (indexToUpdate !== -1) {
          builds[indexToUpdate] = { ...builds[indexToUpdate], ...result }
        } else {
          builds.push(result)
        }
        updateAppValues({ builds })
      }

      setBuildAppState({
        ...buildAppState,
        loading: false,
        error: error ? result : null,
        result: error ? [result] : result
      })
    } catch (err) {
      setBuildAppState({
        ...buildAppState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  const deleteCertificates = async ({ platform }) => {
    try {
      const response = await fetch(`${ordering.root}/builder/apps/${appId}/credentials/${platform}/run/remove_local`, requestBase)
      const { error, result } = await response.json()
      if (!error) {
        showToast(ToastType.Success, result)
      }
    } catch (err) { }
  }

  /**
   * Method to get app download
   */
  const downloadApp = async ({ type, url, appName, ext }) => {
    try {
      setDownloadAppState({ ...downloadAppState, loading: true, type })
      const response = await fetch(url)

      const blob = await response.blob()
      const _url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = _url
      a.download = `${appName ?? 'app'}${ext}`
      a.click()
      window.URL.revokeObjectURL(_url)

      setDownloadAppState({ ...downloadAppState, loading: false })
    } catch (err) {
      setDownloadAppState({
        ...downloadAppState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  /**
   * Method to send app to play store directly
   */
  const sendAppToStore = () => { } // 'missing endpoint'

  const handleBuildApp = (event) => {
    if (event?.builder_app_id === appId) {
      const builds = app?.builds
      const indexToUpdate = builds?.findIndex(build => build.platform === event?.platform)
      if (indexToUpdate !== -1) {
        const changes = event?.changes?.reduce((obj, item) => ({
          ...obj,
          [item.attribute]: item.new ?? builds[indexToUpdate]?.[item.attribute]
        }), {})
        builds[indexToUpdate] = {
          ...builds[indexToUpdate],
          ...changes
        }
        const values = { builds }
        if (changes?.built_apps) {
          values.built_apps = changes?.built_apps
        }
        updateAppValues(changes)
      }
    }
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
