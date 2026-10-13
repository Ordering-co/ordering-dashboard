import React, { useEffect, useRef, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import {
  DOCS_CONNECT_MAX_AGE_MS,
  installDocsConnectionBridge,
  isDashboardDocsSessionReady
} from './bridge'
import { getDocsConnectMode } from './mode'

export {
  DOCS_CONNECT_PURPOSES,
  getDocsConnectMode,
  getDocsConnectPurpose,
  getDocsConnectView
} from './mode'

/** Read once at boot: the login redirect drops the query string later. */
export const docsConnectMode = typeof window === 'undefined'
  ? getDocsConnectMode('')
  : getDocsConnectMode(window.location.search)
const docsConnectNonce = docsConnectMode.nonce
const docsConnectStartedAt = Date.now()

export const DocsConnection = ({ UIComponent, ...props }) => {
  const [session, actions] = useSession()
  const [ordering] = useApi()
  const [requested, setRequested] = useState(false)
  const [approved, setApproved] = useState(false)
  const [connected, setConnected] = useState(false)
  const [expired, setExpired] = useState(false)
  const sessionRef = useRef(session)
  const projectRef = useRef(ordering?.project)
  const approvalRef = useRef(null)
  sessionRef.current = session
  projectRef.current = ordering?.project

  const ready = isDashboardDocsSessionReady(session, ordering?.project)
  const connect = () => {
    if (!isDashboardDocsSessionReady(sessionRef.current, projectRef.current)) return
    approvalRef.current = {
      token: sessionRef.current.token,
      project: projectRef.current,
      userId: sessionRef.current.user.id
    }
    setApproved(true)
  }
  const changeAccount = () => {
    approvalRef.current = null
    setApproved(false)
    return actions.logout()
  }

  useEffect(() => {
    const uninstall = installDocsConnectionBridge({
      nonce: docsConnectNonce,
      startedAt: docsConnectStartedAt,
      getSession: () => sessionRef.current,
      getProject: () => projectRef.current,
      getApproval: () => approvalRef.current,
      onRequest: () => setRequested(true),
      onConnected: () => {
        setRequested(false)
        setConnected(true)
      }
    })
    return uninstall
  }, [])

  useEffect(() => {
    if (!docsConnectNonce) return
    const remaining = docsConnectStartedAt + DOCS_CONNECT_MAX_AGE_MS - Date.now()
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    approvalRef.current = null
    setApproved(false)
  }, [session.token, session.project, session.user?.id, ordering?.project])

  return UIComponent
    ? (
      <UIComponent
        {...props}
        auth={Boolean(session.auth)}
        approved={approved}
        connected={connected}
        expired={expired}
        project={ordering?.project}
        user={session.user}
        ready={ready}
        requested={requested}
        connect={connect}
        changeAccount={changeAccount}
      />
      )
    : null
}
