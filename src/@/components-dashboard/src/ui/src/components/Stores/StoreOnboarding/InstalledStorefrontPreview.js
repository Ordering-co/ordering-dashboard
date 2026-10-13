import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button } from '../../../styles'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { storefrontDraftBusiness } from '../../../../../utils/storeOnboardingStorefrontPreview'

const Viewport = styled.div`position:relative;margin:0 auto;max-width:${p => p.$phone ? `${375 * p.$scale + 2}px` : '100%'};width:100%;height:${p => p.$height * p.$scale}px;overflow:hidden;border:1px solid #dfe3e8;border-radius:${p => p.$phone ? '22px' : '8px'};background:#fff;box-shadow:0 8px 24px #18202c12;iframe{position:absolute;top:0;left:50%;width:${p => p.$phone ? 375 : 1024}px;height:${p => p.$height}px;transform:translateX(-50%) scale(${p => p.$scale});transform-origin:top center;border:0;background:#fff;}`

export const InstalledStorefrontPreview = ({ source, form, color, device, onFocusExit, onClose }) => {
  const [, t] = useStoreOnboardingLanguage()
  const viewport = useRef(null)
  const iframe = useRef(null)
  const documentTimer = useRef(null)
  const payload = useRef(null)
  payload.current = { business: storefrontDraftBusiness(form, t('STORE_ONBOARDING_RESTAURANT_PLACEHOLDER', 'Your restaurant name')), color: form.websiteColor || color }
  const callbacks = useRef(null); callbacks.current = { onFocusExit, onClose }
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retry, setRetry] = useState(0)
  const [revision, setRevision] = useState(0)
  const previousPayload = useRef({ form, color })
  useEffect(() => {
    if (previousPayload.current.form === form && previousPayload.current.color === color) return
    previousPayload.current = { form, color }
    setRevision(value => value + 1)
  }, [form, color])
  const [width, setWidth] = useState(375)
  const [availableHeight, setAvailableHeight] = useState(680)
  const phone = device === 'phone'
  const initialize = () => { if (session && iframe.current?.contentWindow) iframe.current.contentWindow.postMessage({ type: 'INIT', channel: session.channel, ...payload.current }, session.origin) }
  useEffect(() => {
    const controller = new AbortController()
    let current = true; let owned
    setSession(null); setStatus('loading')
    const release = item => fetch('/__onboarding-storefront/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: item.channel }), credentials: 'omit', keepalive: true }).catch(() => {})
    const bootTimer = setTimeout(() => controller.abort(), 30000)
    fetch('/__onboarding-storefront/boot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source), signal: controller.signal, credentials: 'omit' }).then(async response => {
      if (!response.ok) throw new Error('preview_boot_failed')
      const item = await response.json()
      const origin = new URL(item.origin)
      if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.origin !== item.origin || !/^[a-f0-9-]{36}$/i.test(item.channel)) throw new Error('invalid_preview_session')
      if (!current) { release(item); return }
      owned = item; setSession(item)
    }).catch(() => { if (current) setStatus('error') }).finally(() => clearTimeout(bootTimer))
    const receive = event => {
      if (!owned || event.source !== iframe.current?.contentWindow || event.origin !== owned.origin || event.data?.channel !== owned.channel) return
      if (event.data.type === 'READY') iframe.current.contentWindow.postMessage({ type: 'INIT', channel: owned.channel, ...payload.current }, owned.origin)
      if (event.data.type === 'RENDERED') { clearTimeout(documentTimer.current); setStatus('ready') }
      if (event.data.type === 'ESCAPE') callbacks.current.onClose?.()
      if (['FOCUS_NEXT', 'FOCUS_BACK'].includes(event.data.type)) callbacks.current.onFocusExit?.(event.data.type === 'FOCUS_BACK')
    }
    window.addEventListener('message', receive)
    return () => { current = false; window.removeEventListener('message', receive); if (owned) release(owned) }
  }, [source.url, source.apiRoot, source.code, retry])
  useEffect(() => {
    if (!session) return
    setStatus('loading')
    const timer = setTimeout(() => setStatus('error'), 45000)
    documentTimer.current = timer
    return () => clearTimeout(timer)
  }, [session, revision])
  useEffect(() => {
    const measure = () => { const bounds = viewport.current?.getBoundingClientRect(); if (bounds?.width > 0) setWidth(bounds.width); if (bounds) setAvailableHeight(Math.max(120, window.innerHeight - bounds.top - 56)) }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (viewport.current) observer?.observe(viewport.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [phone, session])
  const scale = Math.min(1, width / (phone ? 375 : 1024), phone ? availableHeight / 680 : 1)
  const height = phone ? 680 : availableHeight / scale
  return <>
    {status === 'loading' && <p role='status'>{t('LOADING', 'Loading')}</p>}
    {status === 'error' && <div role='alert'><p>{t('STORE_ONBOARDING_PREVIEW_UNAVAILABLE', 'Preview is not available for this website layout.')}</p><Button onClick={() => setRetry(value => value + 1)}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button></div>}
    {session && <Viewport ref={viewport} $phone={phone} $scale={scale} $height={height} style={{ display: status === 'error' ? 'none' : undefined }} data-device={device}>
      <iframe key={revision} ref={iframe} title={t('STORE_ONBOARDING_WEBSITE_PREVIEW', 'Website preview')} src={`${session.origin}/store/onboarding_preview`} sandbox='allow-scripts allow-same-origin' tabIndex={-1} referrerPolicy='no-referrer' onLoad={initialize} />
    </Viewport>}
  </>
}
