import React from 'react'
import { useLanguage } from '../../../../../index'
import { getActiveTrialDaysRemaining } from '../../../utils/trialExtension'
import { ProjectCurrentStatus } from '../HomePage/styles'

/**
 * Project status pill on Home. api-core keeps `current_status: 'active'` during a free trial,
 * so an active project with a trialing subscription that has not ended yet reads as a trial
 * ("Free trial — N days left", warning style) instead of "Project Active".
 */
export const ProjectStatusBadge = ({ currentStatus, trialSubscription, statusLabel, now }) => {
  const [, t] = useLanguage()

  const trialDaysLeft = currentStatus === 'active'
    ? getActiveTrialDaysRemaining(trialSubscription, now)
    : null

  if (trialDaysLeft !== null) {
    const trialLabel = trialDaysLeft === 1
      ? t('PROJECT_FREE_TRIAL_DAY_LEFT', 'Free trial — :days: day left')
      : t('PROJECT_FREE_TRIAL_DAYS_LEFT', 'Free trial — :days: days left')

    return (
      <ProjectCurrentStatus data-status='trialing'>
        {trialLabel.replace(':days:', trialDaysLeft)}
      </ProjectCurrentStatus>
    )
  }

  return (
    <ProjectCurrentStatus isActive={currentStatus === 'active'}>
      {statusLabel}
    </ProjectCurrentStatus>
  )
}
