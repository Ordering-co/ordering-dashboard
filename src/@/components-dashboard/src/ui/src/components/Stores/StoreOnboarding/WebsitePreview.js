import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../../../styles'
import { Phone, Display } from 'react-bootstrap-icons'
import { Modal } from '../../Shared/Modal'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { WebsitePreviewFrame, WebsitePreviewHeader } from './styles'
import { InstalledStorefrontPreview } from './InstalledStorefrontPreview'

const WebsitePreviewContent = ({ onClose, form, color, appearance = {}, retryAppearance }) => {
  const frame = useRef(null)
  const close = useRef(null)
  const [device, setDevice] = useState('phone')
  useEffect(() => {
    const timer = setTimeout(() => close.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [])
  const [, t] = useStoreOnboardingLanguage()
  const trapFocus = event => {
    if (event.key !== 'Tab') return
    const controls = Array.from(frame.current?.querySelectorAll('button:not(:disabled)') || [])
    const first = controls[0]; const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <WebsitePreviewFrame ref={frame} role='dialog' aria-modal='true' aria-labelledby='onboarding-website-preview-title' onKeyDown={trapFocus}>
    <WebsitePreviewHeader><h2 id='onboarding-website-preview-title'>{t('STORE_ONBOARDING_WEBSITE_PREVIEW', 'Website preview')}</h2><Button ref={close} color='primary' outline borderRadius='8px' onClick={onClose}>{t('CLOSE', 'Close')}</Button></WebsitePreviewHeader>
    <p className='preview-note'>{t('STORE_ONBOARDING_BUSINESS_PREVIEW_HINT', 'Preview your business page with your installed website design and saved menu.')}</p>
    {appearance.loading
      ? <p role='status'>{t('LOADING', 'Loading')}</p>
      : appearance.error || !appearance.preview
        ? <div role='alert'><p>{t('STORE_ONBOARDING_APPEARANCE_ERROR', 'We could not load your website appearance. Try again to choose its color.')}</p><Button onClick={retryAppearance}>{t('STORE_ONBOARDING_RETRY', 'Try again')}</Button></div>
        : <>
      <div className='preview-devices' role='group' aria-label={t('STORE_ONBOARDING_WEBSITE_PREVIEW', 'Website preview')}>{[['phone', Phone, t('PHONE', 'Phone')], ['web', Display, t('WEB', 'Web')]].map(([value, Icon, label]) => <Button key={value} color='primary' outline={device !== value} aria-pressed={device === value} borderRadius='8px' onClick={() => setDevice(value)}><Icon aria-hidden='true' /> {label}</Button>)}</div>
      <InstalledStorefrontPreview form={form} source={appearance.preview} color={color} device={device} onClose={onClose} onFocusExit={back => (back ? frame.current?.querySelector('.preview-devices button:last-child') : close.current)?.focus()} />
    </>}
  </WebsitePreviewFrame>
}

export const WebsitePreview = ({ open, onClose, ...props }) => <Modal open={open} onClose={onClose} width='1160px' maxWidth='95vw' height='90dvh' padding='24px' hideCloseDefault><WebsitePreviewContent {...props} onClose={onClose} /></Modal>
