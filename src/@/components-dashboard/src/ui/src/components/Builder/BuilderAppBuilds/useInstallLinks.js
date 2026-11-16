import { useEffect, useRef, useState } from 'react'

/** The time left of an install link is redrawn every 30 seconds. */
export const INSTALL_TICK = 30000

/**
 * The 24 hour links that install a file on a phone (the QR), by the key of
 * what each one installs: `{ loading, link, errorCodes }`. Shared by the
 * Builder's Builds card (by attempt) and My Products (by platform, mode and
 * file). `create(target)` answers `{ ok, result, errorCodes }`, `result`
 * being `{ url, expires_at, platform, mode, file }`. A link still valid is
 * kept; `renew` asks for a new one. One request per key at a time: a renewal
 * that arrives while one is on its way waits for it and is asked for then
 * (the answer on its way may name the build before, whose link the API
 * refuses with `build.artifact_replaced`), so that answer is never drawn.
 * Once the component is unmounted an answer is ignored and nothing else is
 * asked for.
 */
export const useInstallLinks = (create, keyOf) => {
  const [installLinks, setInstallLinks] = useState({})
  const linksRef = useRef(installLinks)
  // the request on its way of each key: `{ renew }`, the target of the renewal that waits for it (null: none)
  const requests = useRef({})
  const mounted = useRef(true)
  linksRef.current = installLinks

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const requestInstallLink = async (target, { renew = false } = {}) => {
    const key = keyOf(target)
    if (!create) return
    const onItsWay = requests.current[key]
    if (onItsWay) {
      if (renew) onItsWay.renew = target
      return
    }
    const current = linksRef.current[key]
    const expiresAt = Date.parse(current?.link?.expires_at)
    if (!renew && current?.link && expiresAt > Date.now()) return
    const request = { renew: null }
    requests.current[key] = request
    setInstallLinks(prev => ({ ...prev, [key]: { loading: true, link: null, errorCodes: [] } }))
    let answer = await create(target)
    while (mounted.current && request.renew) {
      const again = request.renew
      request.renew = null
      answer = await create(again)
    }
    delete requests.current[key]
    if (!mounted.current) return
    const link = answer?.ok && answer.result?.url ? answer.result : null
    setInstallLinks(prev => ({
      ...prev,
      [key]: { loading: false, link, errorCodes: link ? [] : (answer?.errorCodes || []) }
    }))
  }

  return { installLinks, requestInstallLink }
}

/**
 * How long an install link has left: `{ now, expiresAt, expired }`, redrawn
 * every INSTALL_TICK and at the moment it expires.
 */
export const useLinkCountdown = (link) => {
  const [now, setNow] = useState(() => Date.now())
  const expiresAt = link ? Date.parse(link.expires_at) : NaN
  const expired = !!link && !(expiresAt > now)

  useEffect(() => {
    if (!link || expired) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), INSTALL_TICK)
    // redraws at the moment it expires too, not up to a tick later
    const end = setTimeout(() => setNow(Date.now()), Math.max(0, expiresAt - Date.now()))
    return () => {
      clearInterval(tick)
      clearTimeout(end)
    }
  }, [link, expired])

  return { now, expiresAt, expired }
}
