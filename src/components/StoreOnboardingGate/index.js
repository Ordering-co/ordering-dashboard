import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button } from '~ui'
import { useHistory, useLocation } from 'react-router-dom'
import { useApi, useSession } from '~components'
import { useStoreOnboardingLanguage } from '../../@/components-dashboard/src/utils/useStoreOnboardingLanguage'
import { StoreOnboarding } from '../../pages/StoreOnboarding'
import { deleteDraftMedia } from '../../@/components-dashboard/src/utils/storeOnboardingDraftMedia'
import { draftKey, readDraft, isOnboardingEligible } from '../../@/components-dashboard/src/utils/storeOnboarding'
import { createOnboardingApi } from '../../@/components-dashboard/src/utils/storeOnboardingApi'

const GateStatus = styled.main`padding:64px 24px;max-width:600px;margin:auto;button{margin-right:8px;}`

export const StoreOnboardingGate = ({ children }) => {
  const [ordering] = useApi()
  const [{ auth, token, user, loading }, { logout }] = useSession()
  const [, t] = useStoreOnboardingLanguage()
  const history = useHistory()
  const { pathname } = useLocation()
  const eligible = !loading && isOnboardingEligible({ development: import.meta.env.DEV, hostname: window.location.hostname, auth, level: user?.level, root: ordering.root, userId: user?.id })
  const key = draftKey(ordering.root, user?.id)
  const identity = `${key}:${token}`
  const ownerIdentity = useRef(identity); ownerIdentity.current = identity
  const apiRoot = useRef(ordering.root); apiRoot.current = ordering.root
  const hasDraft = () => { try { return Boolean(localStorage.getItem(key)) } catch { return false } }
  const [state, setState] = useState({ identity, status: 'checking', blocking: hasDraft() })
  const [retry, setRetry] = useState(0)
  const status = state.identity === identity ? state.status : 'checking'
  const clearProgress = async (raw, signal) => {
    let removed = false
    const remove = () => {
      if (signal?.aborted || localStorage.getItem(key) !== raw) return false
      localStorage.removeItem(key)
      removed = true
      return true
    }
    try { await deleteDraftMedia(key, remove) } catch { if (!removed) remove() }
    return removed
  }
  useEffect(() => {
    if (!eligible) return
    const receive = event => {
      if (event.key !== key || !event.newValue || !hasDraft()) return
      setState(previous => previous.identity === identity && ['checking', 'error'].includes(previous.status) && !previous.blocking
        ? { ...previous, blocking: true }
        : previous)
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [eligible, identity, key])
  useEffect(() => {
    if (!eligible) return
    const abort = new AbortController()
    setState(previous => ({ identity, status: 'checking', blocking: (previous.identity === identity && previous.blocking) || hasDraft() }))
    const check = async () => {
      try {
        const raw = localStorage.getItem(key)
        const draft = readDraft(localStorage, key)
        const required = await createOnboardingApi({ root: apiRoot.current, token }).discover(draft, abort.signal)
        if (abort.signal.aborted) return
        if (localStorage.getItem(key) !== raw) { setRetry(n => n + 1); return }
        if (required === 'reset-required' || required === 'reset-ready' || (raw && !draft)) {
          const reset = () => clearProgress(raw, abort.signal)
          const removed = navigator.locks ? await navigator.locks.request(key, { signal: abort.signal }, reset) : await reset()
          if (abort.signal.aborted) return
          if (!removed) { setRetry(n => n + 1); return }
        }
        setState({ identity, status: required && required !== 'reset-ready' ? 'required' : 'ready', blocking: Boolean(required && required !== 'reset-ready') })
      } catch {
        if (!abort.signal.aborted) setState(previous => ({ ...previous, identity, status: 'error' }))
      }
    }
    check()
    return () => abort.abort()
  }, [eligible, identity, key, token, retry])
  useEffect(() => {
    if (eligible && status === 'required' && pathname !== '/onboarding/store') history.replace('/onboarding/store')
  }, [eligible, status, pathname, history])
  const complete = async destination => {
    try {
      const raw = localStorage.getItem(key)
      const cleared = await clearProgress(raw)
      if (ownerIdentity.current !== identity) return
      if (!cleared) throw new Error('draft_changed')
    } catch { if (ownerIdentity.current === identity) setState(previous => ({ ...previous, identity, status: 'error' })); return }
    setState({ identity, status: 'ready' })
    history.replace(destination === 'orders' ? '/orders' : '/home')
  }
  if (!eligible || status === 'ready' || ((status === 'checking' || status === 'error') && !((state.identity === identity && state.blocking) || hasDraft()))) return <>{children}</>
  if (status === 'required') return <StoreOnboarding key={identity} storageKey={key} onComplete={complete} />
  return (
    <GateStatus>
      {status === 'error'
        ? <><p role='alert'>{t('STORE_ONBOARDING_DISCOVERY_ERROR', 'We could not check your store setup. Your progress has been preserved. Try again to continue.')}</p><Button onClick={() => setRetry(n => n + 1)}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button><Button onClick={logout}>{t('STORE_ONBOARDING_LOGOUT', 'Log out')}</Button></>
        : <p role='status'>{t('STORE_ONBOARDING_CHECKING', 'Preparing your restaurant setup…')}</p>}
    </GateStatus>
  )
}
