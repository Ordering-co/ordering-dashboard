import React from 'react'
import { useLanguage } from '../../../../../index'
import { getActiveTrialDaysRemaining } from '../../../utils/trialExtension'
// redesign home C2 (HM-09, auditor 15): the badge is the Product StatusBadge, no longer main's styled pill. By file, to stay out of the barrel.
import { StatusBadge } from '../../Shared/Product/Status'

/**
 * Project status badge on Home. api-core keeps `current_status: 'active'` during a free trial,
 * so an active project with a trialing subscription that has not ended yet reads as a trial
 * ("Free trial — N days left", review family) instead of "Project Active".
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

    // redesign home C2 (HM-09): a trial reads as review, the family that asks to look
    return <StatusBadge family='review' data-status='trialing' label={trialLabel.replace(':days:', trialDaysLeft)} />
  }

  // redesign home C2 (HM-09, HM-13): active is done; past due and any other status are cancel. The label comes from the caller
  return <StatusBadge family={currentStatus === 'active' ? 'done' : 'cancel'} label={statusLabel} />
}
