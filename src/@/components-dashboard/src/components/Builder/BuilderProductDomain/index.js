import React, { useEffect, useRef, useState } from 'react'

import { useApi } from '../../../contexts/ApiContext'
import { useSession } from '../../../contexts/SessionContext'
import { useSocketInstance, useWebsocket } from '../../../contexts/WebsocketContext'
import {
  getBuilderPageFailure,
  getBuilderProductDomain,
  removeBuilderProductDomain,
  saveBuilderProductDomain,
  verifyBuilderProductDomain
} from '../builderApi'

/** How often a domain still being set up is read again. */
export const DOMAIN_POLL_MS = 30000

/** Waits for a burst of site updates to end before reading again. */
const SOCKET_REFRESH_MS = 1000

/** Whether a `sites_update` touched the domain or its certificate. */
const isDomainChange = (event) => Object.keys(event || {}).some(key => key === 'domain' || key.startsWith('ssl_'))

/**
 * The domains of a Builder website: its temporary one and
 * its own, a subdomain of the client's with a CNAME record to
 * `cname_target`. Cloudflare sets the own domain up in the background, so
 * while it is `pending` it is read again every 30 s and when the site's
 * `sites_update` brings its `ssl_*` fields.
 */
export const BuilderProductDomain = (props) => {
  const { UIComponent, productId, onPageFailure } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const socket = useWebsocket()
  const ioSocket = useSocketInstance(socket)
  const [domainState, setDomainState] = useState({ loading: true, domain: null, error: false })
  const [domainAction, setDomainAction] = useState(null)
  const domainRequest = useRef(0)
  const refreshTimer = useRef(null)

  const status = domainState.domain?.own?.status ?? null

  /** `silent` keeps what is shown while reading, and on a failure. */
  const getDomain = async ({ silent = false } = {}) => {
    const requestId = ++domainRequest.current
    if (!silent) setDomainState(prev => ({ ...prev, loading: true, error: false }))
    const response = await getBuilderProductDomain(ordering, token, productId)
    if (requestId !== domainRequest.current) return
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      if (!silent) setDomainState({ loading: false, domain: null, error: true })
      return
    }
    setDomainState({ loading: false, domain: response.result?.domain ?? null, error: false })
  }

  /** Answers `{ ok, errorCodes, cnameTarget, own }`; on success the state is the API's answer. */
  const settle = (response) => {
    if (response.error) {
      const pageFailure = getBuilderPageFailure(response)
      if (pageFailure) onPageFailure && onPageFailure(pageFailure)
      return { ok: false, errorCodes: response.errorCodes, cnameTarget: response.cnameTarget ?? null, own: null }
    }
    // A read still on its way is older than this answer
    domainRequest.current++
    const domain = response.result?.domain ?? null
    setDomainState({ loading: false, domain, error: false })
    return { ok: true, errorCodes: [], cnameTarget: null, own: domain?.own ?? null }
  }

  const run = async (action, call) => {
    setDomainAction(action)
    const response = await call()
    setDomainAction(null)
    return settle(response)
  }

  /** `domain` as typed: the API takes a URL or a host. */
  const saveDomain = (domain) => run('save', () => saveBuilderProductDomain(ordering, token, productId, domain))

  const removeDomain = () => run('remove', () => removeBuilderProductDomain(ordering, token, productId))

  const verifyDomain = async () => {
    const answer = await run('verify', () => verifyBuilderProductDomain(ordering, token, productId))
    // Removed meanwhile, somewhere else
    if (answer.errorCodes.includes('domain.not_set')) getDomain({ silent: true })
    return answer
  }

  const refreshSoon = () => {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => getDomain({ silent: true }), SOCKET_REFRESH_MS)
  }

  const handleSiteUpdate = (event) => {
    if (String(event?.id) !== String(productId) || !isDomainChange(event)) return
    refreshSoon()
  }

  useEffect(() => {
    if (!token || !productId) return
    getDomain()
  }, [token, productId, ordering.root])

  useEffect(() => {
    if (status !== 'pending') return
    const timer = setInterval(() => getDomain({ silent: true }), DOMAIN_POLL_MS)
    return () => clearInterval(timer)
  }, [status, productId])

  useEffect(() => {
    socket.on('sites_update', handleSiteUpdate)
    return () => socket.off('sites_update', handleSiteUpdate)
  }, [socket, productId])

  useEffect(() => {
    if (!user || !ioSocket) return
    const room = { project: ordering.project, room: 'sites', user_id: user.id, role: 'manager' }
    const join = () => socket.join(room)
    if (ioSocket.connected) join()
    ioSocket.on('connect', join)
    return () => {
      socket.leave(room)
      ioSocket.off('connect', join)
    }
  }, [ioSocket, user?.id])

  useEffect(() => () => clearTimeout(refreshTimer.current), [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          domainState={domainState}
          domainAction={domainAction}
          reloadDomain={getDomain}
          saveDomain={saveDomain}
          removeDomain={removeDomain}
          verifyDomain={verifyDomain}
        />
      )}
    </>
  )
}
