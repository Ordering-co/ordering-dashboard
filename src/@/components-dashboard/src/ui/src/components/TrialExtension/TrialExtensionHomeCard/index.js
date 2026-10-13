import React from 'react'

import { useLanguage } from '../../../../../index'
import { useTrialExtension } from '../../../contexts/TrialExtensionContext'
import { Button } from '../../../styles'
import { Card, Description, TextContent, Title } from './styles'

/**
 * Home page card offering the trial extension. Renders nothing unless the offer is available.
 */
export const TrialExtensionHomeCard = () => {
  const [, t] = useLanguage()
  const { available, daysRemaining, openBooking } = useTrialExtension()

  if (!available) return null

  const daysText = daysRemaining === 1
    ? t('TRIAL_EXTENSION_ENDS_IN_DAY', 'Your trial ends in :days: day.').replace(':days:', daysRemaining)
    : t('TRIAL_EXTENSION_ENDS_IN_DAYS', 'Your trial ends in :days: days.').replace(':days:', daysRemaining)

  return (
    <Card aria-labelledby='trial-extension-home-card-heading'>
      <TextContent>
        <Title id='trial-extension-home-card-heading'>
          {t('TRIAL_EXTENSION_BANNER_TITLE', 'Extend your free trial to 14 days')}
        </Title>
        <Description>
          {daysText} {t('TRIAL_EXTENSION_HOME_CARD_TEXT', 'Book a short call with our team and get 14 days in total from the start of your trial.')}
        </Description>
      </TextContent>
      <Button
        color='primary'
        borderRadius='8px'
        style={{ minHeight: '44px' }}
        onClick={() => openBooking('home')}
      >
        {t('TRIAL_EXTENSION_BOOK_CALL', 'Book a call')}
      </Button>
    </Card>
  )
}
