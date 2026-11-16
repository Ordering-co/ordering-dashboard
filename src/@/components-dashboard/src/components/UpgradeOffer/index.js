import React, { useEffect, useState } from 'react'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

/**
 * Fetches the one-time legacy-upgrade offer: `GET /billing/subscriptions/upgrade-offer`.
 * `offer` is `null` while there is nothing to show — not eligible, not the project owner (billing
 * already scopes that), or any network/response error. Never surfaced to the user as an error.
 * Runs once per token/project root, not on every navigation (the identity rarely changes while the
 * app stays open).
 */
export const UpgradeOffer = (props) => {
  const { UIComponent } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [offer, setOffer] = useState(null)

  useEffect(() => {
    if (!token) {
      setOffer(null)
      return
    }
    let active = true
    fetch(`${ordering.root}/billing/subscriptions/upgrade-offer`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return
        const result = ok && data?.error === false ? data?.result : null
        setOffer(result && typeof result === 'object' ? result : null)
      })
      .catch(() => { if (active) setOffer(null) })
    return () => { active = false }
  }, [token, ordering.root])

  return (
    <>
      {UIComponent && <UIComponent {...props} offer={offer} />}
    </>
  )
}
