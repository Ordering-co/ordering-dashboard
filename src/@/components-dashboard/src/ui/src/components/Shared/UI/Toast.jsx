import React, { useEffect, useRef } from 'react'
import { useToast, useLanguage, ToastType } from '../../../../../index'
import { ToastContainer } from './toast-styles'

export const Toast = () => {
  const [toastConfig, { hideToast }] = useToast()
  const [, t] = useLanguage()
  const toastRef = useRef()
  const hideToastRef = useRef(hideToast)
  const tRef = useRef(t)
  const tone = toastConfig?.type === ToastType.Error
    ? 'error'
    : toastConfig?.type === ToastType.Success
      ? 'success'
      : 'info'

  hideToastRef.current = hideToast
  tRef.current = t

  useEffect(() => {
    const container = toastRef.current
    if (!toastConfig || !container) return
    const { message, duration } = toastConfig
    document.querySelector('.toast-bar')?.remove()
    const toast = document.createElement('div')
    toast.classList.add('toast-bar')
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite')
    toast.setAttribute('aria-atomic', 'true')
    // tanda N: text, never HTML — some messages are API errors and no toast passes markup on purpose.
    // Same coercion innerHTML had: null reads empty, anything else through String() (an array reads «a,b»)
    // tanda O: an undefined message (a catch with no err.message) reads «Error», not «undefined»
    toast.textContent = message === null
      ? ''
      : message === undefined ? tRef.current('ERROR', 'Error') : String(message)
    container.appendChild(toast)

    const timeout = setTimeout(() => {
      toast.remove()
      hideToastRef.current()
    }, duration)

    return () => {
      clearTimeout(timeout)
      toast.remove()
    }
  }, [toastConfig, tone])

  if (!toastConfig) {
    return null
  }

  return (
    <ToastContainer
      tone={tone}
      ref={toastRef}
      id='toast-container'
    />
  )
}
