import React, { useEffect, useRef, useState } from 'react'
import { useApi, useLanguage } from '../../../../index'
import { focusPageStart } from '../../../../utils/focusPageStart'
import { IconButton, InlineNotice } from '../Shared/Product'
import { Info, X } from '../Shared/Icon'
import './banners.css'

// the "use a computer" notice for phones, moved from a fixed box over the page (SidebarMenu) into the BannerStack.
// Same trigger and copy as before; the close is remembered in this browser, per project. A storage error leaves it as it was:
// shown on every load and closable.
const PHONE_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

const readDismissed = key => {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export const PhoneNotice = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const storageKey = `ordering:phone-notice-dismissed:${ordering?.project ?? ''}`
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey))
  // The ✕ goes away with the notice; when it had the focus, the start of the page takes it (as in WebsocketConnectionBanner)
  const focusAfterClose = useRef(false)

  useEffect(() => {
    if (!dismissed || !focusAfterClose.current) return
    focusAfterClose.current = false
    focusPageStart(null)
  }, [dismissed])

  if (dismissed || !PHONE_AGENT.test(navigator.userAgent)) return null

  return (
    <InlineNotice
      tone='info'
      icon={Info}
      action={(
        <IconButton
          icon={X}
          label={t('CLOSE', 'Close')}
          onClick={(event) => {
            focusAfterClose.current = document.activeElement === event.currentTarget
            try {
              window.localStorage.setItem(storageKey, '1')
            } catch {}
            setDismissed(true)
          }}
        />
      )}
    >
      {t('FOR_THE_BEST_EXPERIENCE_WHILE_SETTING_UP', 'For the best experience while setting up your project, we recommend using a computer.')}
    </InlineNotice>
  )
}
