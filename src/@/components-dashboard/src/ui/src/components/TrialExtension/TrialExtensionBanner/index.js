import React from 'react'
import { useTheme } from 'styled-components'
import { InfoCircle, X } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { Button } from '../../../styles'
import { BannerActions, BannerBar, BannerIcon, BannerText, BannerTextFull, BannerTextShort } from './styles'

/**
 * Compact banner offering the trial extension, dismissible for the session (`dismissBanner`).
 * Rendered in normal document flow above the app layout, outside the sticky <BannerStack>
 * (z-index 10000) used by the past-due and websocket banners, so it never covers a modal.
 * On narrow screens the long sentence is swapped for the days remaining, so the one line that
 * fits next to the CTA still says how long the trial has left.
 */
export const TrialExtensionBanner = () => {
  const theme = useTheme()
  const [, t] = useLanguage()
  const {
    available,
    bannerDismissed,
    daysRemaining,
    dismissBanner,
    openBooking
  } = useTrialExtension()

  if (!available || bannerDismissed) return null

  const title = t('TRIAL_EXTENSION_BANNER_TITLE', 'Extend your free trial to 14 days')
  const daysText = daysRemaining === 1
    ? t('TRIAL_EXTENSION_ENDS_IN_DAY', 'Your trial ends in :days: day.').replace(':days:', daysRemaining)
    : t('TRIAL_EXTENSION_ENDS_IN_DAYS', 'Your trial ends in :days: days.').replace(':days:', daysRemaining)

  return (
    <BannerBar role='region' aria-label={title}>
      <BannerIcon aria-hidden='true'>
        <InfoCircle size={20} color={theme?.colors?.info} />
      </BannerIcon>
      <BannerText>
        <BannerTextFull data-testid='trial-extension-banner-full'>
          <strong>{title}</strong>{' '}
          {daysText} {t('TRIAL_EXTENSION_BANNER_TEXT', "Book a short call with our team before it ends and we'll extend it to 14 days.")}
        </BannerTextFull>
        <BannerTextShort data-testid='trial-extension-banner-short'>{daysText}</BannerTextShort>
      </BannerText>
      <BannerActions>
        <Button
          color='primary'
          style={{ borderRadius: 8, padding: '0 16px', minHeight: '44px', whiteSpace: 'nowrap' }}
          onClick={() => openBooking('banner')}
        >
          {t('TRIAL_EXTENSION_BOOK_CALL', 'Book a call')}
        </Button>
        <Button
          color='secundary'
          style={{ borderRadius: 8, padding: 0, minHeight: '44px', minWidth: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={dismissBanner}
          aria-label={t('CLOSE', 'Close')}
        >
          <X size={18} aria-hidden='true' />
        </Button>
      </BannerActions>
    </BannerBar>
  )
}
