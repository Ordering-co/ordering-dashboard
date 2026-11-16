// redesign (R2): the trial-extension offer as a Product InlineNotice.
import React from 'react'

import { useLanguage } from '../../../../../index'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { Button, IconButton, InlineNotice } from '../../Shared/Product'
import { Info, X } from '../../Shared/Icon'
import './trial-extension-banner.css'

/**
 * Compact banner offering the trial extension, dismissible for the session (`dismissBanner`).
 * Rendered in normal document flow above the app layout, outside the sticky <BannerStack>
 * used by the past-due and websocket banners, so it never covers a modal.
 * On narrow screens the long sentence is swapped for the days remaining, so the one line that
 * fits next to the CTA still says how long the trial has left.
 */
export const TrialExtensionBanner = () => {
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
    <InlineNotice
      tone='info'
      icon={Info}
      role='region'
      aria-label={title}
      className='odc-trial-banner'
      action={(
        <span className='odc-trial-banner-actions'>
          <Button variant='primary' onClick={() => openBooking('banner')}>
            {t('TRIAL_EXTENSION_BOOK_CALL', 'Book a call')}
          </Button>
          <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={dismissBanner} />
        </span>
      )}
    >
      <span className='odc-trial-banner-full' data-testid='trial-extension-banner-full'>
        <strong>{title}</strong>{' '}
        {daysText} {t('TRIAL_EXTENSION_BANNER_TEXT', "Book a short call with our team before it ends and we'll extend it to 14 days.")}
      </span>
      <span className='odc-trial-banner-short' data-testid='trial-extension-banner-short'>{daysText}</span>
    </InlineNotice>
  )
}
