import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/** What the page Stripe returns to tells the window that opened it. */
const STRIPE_RETURN_MESSAGE = 'stripe_connect_account'
const POPUP_FEATURES = 'width=720,height=820,menubar=no,toolbar=no,location=no,status=no'

const toErrorList = (result, fallback) => {
  if (Array.isArray(result)) return result.length ? result.map(String) : [fallback]
  if (typeof result === 'string' && result) return [result]
  return [fallback]
}

/**
 * The Stripe account an owner gets paid on through Stripe Connect:
 * the one a business connects, or the Express account of a driver. It is the
 * account of the mode Stripe Connect is in; null while the owner has none.
 *
 * Connecting happens on Stripe, in a window of its own. The API gives the
 * address, and the page Stripe comes back to tells this window it is done.
 */
export const StripeConnectAccount = (props) => {
  const {
    UIComponent,
    ownerType,
    ownerId
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [accountState, setAccountState] = useState({ loading: true, error: null, account: null })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const controllerRef = useRef(null)
  const stripeWindowRef = useRef({ awaiting: false, stop: null })

  const isDriver = ownerType === 'driver'
  const path = `/${isDriver ? 'users' : 'business'}/${ownerId}/stripe_connect_account`

  const request = async (subpath = '', options = {}) => {
    const response = await fetch(`${ordering.root}${path}${subpath}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store',
      signal: controllerRef.current?.signal
    })
    const content = await response.json()
    return { ok: response.ok && !content?.error, content }
  }

  /**
   * Get the account
   * @param {Boolean} silent keep what is on screen while it is read again
   */
  const getAccount = async (silent = false) => {
    try {
      if (!silent) setAccountState(prev => ({ ...prev, loading: true, error: null }))
      const { ok, content } = await request()
      if (!ok) {
        setAccountState(prev => ({ ...prev, loading: false, error: toErrorList(content?.result, 'ERROR') }))
        return
      }
      setAccountState({ loading: false, error: null, account: content.result || null })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setAccountState(prev => ({ ...prev, loading: false, error: [err.message] }))
    }
  }

  const stopWatchingStripe = () => {
    stripeWindowRef.current.stop?.()
    stripeWindowRef.current.stop = null
  }

  /**
   * Read the account again, once, for the visit to Stripe that is being waited for
   */
  const readAfterStripe = () => {
    if (!stripeWindowRef.current.awaiting) return
    stripeWindowRef.current.awaiting = false
    stopWatchingStripe()
    getAccount(true)
  }

  /**
   * Wait for the visit to Stripe to end: its window says it is done, or it is
   * closed, or this window gets the focus back. Whichever comes first reads
   * the account again, and only that one.
   * A window that went through Stripe can look closed while it is still open,
   * so a closed window only counts once the person is back on this one.
   */
  const watchStripe = (popup) => {
    stopWatchingStripe()
    stripeWindowRef.current.awaiting = true
    const apiOrigin = new URL(ordering.root).origin
    const onMessage = (e) => {
      if (e.origin !== apiOrigin || e.data?.type !== STRIPE_RETURN_MESSAGE) return
      readAfterStripe()
    }
    const timer = setInterval(() => {
      if (!popup.closed) return
      if (document.hasFocus()) readAfterStripe()
      else clearInterval(timer)
    }, 500)
    window.addEventListener('message', onMessage)
    stripeWindowRef.current.stop = () => {
      clearInterval(timer)
      window.removeEventListener('message', onMessage)
    }
  }

  /**
   * Ask for the address of Stripe where the owner connects the account: its
   * sign-in for a business, its onboarding form for a driver. Asking for a
   * driver's creates their account the first time. Resolves `{ error, result }`
   * with `result.url`.
   */
  const handleGetStripeLink = async () => {
    try {
      setActionState({ loading: true, error: null })
      const { ok, content } = await request(isDriver ? '/onboarding' : '/link', { method: 'POST' })
      if (!ok || !content?.result?.url) {
        const error = toErrorList(content?.result, 'ERROR')
        setActionState({ loading: false, error })
        return { error: true, result: error }
      }
      setActionState({ loading: false, error: null })
      return { error: false, result: { url: content.result.url } }
    } catch (err) {
      if (err?.name === 'AbortError') return { error: true, result: [] }
      setActionState({ loading: false, error: [err.message] })
      return { error: true, result: [err.message] }
    }
  }

  /**
   * Open Stripe for the owner to connect the account. Resolves
   * `{ error, result }`; `result.opened` is false when the browser blocked the
   * window, and then `result.url` is the address to open by hand.
   */
  const handleOpenStripe = async () => {
    // Opened before asking for the address: a window opened after waiting is blocked
    const popup = window.open('', '_blank', POPUP_FEATURES)
    const link = await handleGetStripeLink()
    if (link.error) {
      popup?.close()
      return link
    }
    if (popup) {
      popup.location.href = link.result.url
      watchStripe(popup)
    } else {
      stripeWindowRef.current.awaiting = true
    }
    return { error: false, result: { url: link.result.url, opened: !!popup } }
  }

  /**
   * Disconnect the account of a business
   */
  const handleDisconnect = async () => {
    try {
      setActionState({ loading: true, error: null })
      const { ok, content } = await request('', { method: 'DELETE' })
      if (!ok) {
        const error = toErrorList(content?.result, 'ERROR')
        setActionState({ loading: false, error })
        return { error: true, result: error }
      }
      setAccountState({ loading: false, error: null, account: null })
      setActionState({ loading: false, error: null })
      return { error: false, result: content.result }
    } catch (err) {
      if (err?.name === 'AbortError') return { error: true, result: [] }
      setActionState({ loading: false, error: [err.message] })
      return { error: true, result: [err.message] }
    }
  }

  useEffect(() => {
    controllerRef.current = new AbortController()
    getAccount()
    const onFocus = () => readAfterStripe()
    window.addEventListener('focus', onFocus)
    return () => {
      controllerRef.current?.abort()
      window.removeEventListener('focus', onFocus)
      stopWatchingStripe()
    }
  }, [ownerType, ownerId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          accountState={accountState}
          actionState={actionState}
          getAccount={getAccount}
          handleOpenStripe={handleOpenStripe}
          handleGetStripeLink={handleGetStripeLink}
          handleDisconnect={isDriver ? undefined : handleDisconnect}
        />
      )}
    </>
  )
}

StripeConnectAccount.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Whose account it is
   */
  ownerType: PropTypes.oneOf(['business', 'driver']).isRequired,
  /**
   * Business id or driver id
   */
  ownerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired
}
