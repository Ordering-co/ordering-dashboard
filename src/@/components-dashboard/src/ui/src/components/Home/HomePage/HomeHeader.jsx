import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { getCurrentDiffDays } from '../../../utils'
import { Button, IconButton, InlineNotice, Skeleton } from '../../Shared/Product'
import { ExternalLink, Menu as MenuIcon } from '../../Shared/Icon'
import { ProjectStatusBadge } from '../ProjectStatusBadge'
import './home.css'

// redesign home C1 (HM-07): the greeting is the only h1 of the page, by the local hour of the browser
const getGreeting = (t, name, now = new Date()) => {
  if (!name) return t('WELCOME_TO_ORDERING', 'Welcome to Ordering.co')
  const hour = now.getHours()
  const template = hour < 12
    ? t('HOME_GREETING_MORNING', 'Good morning, :name:')
    : hour < 18
      ? t('HOME_GREETING_AFTERNOON', 'Good afternoon, :name:')
      : t('HOME_GREETING_EVENING', 'Good evening, :name:')
  return template.replace(':name:', name)
}

/**
 * Header of Home (redesign home C1, D1, HM-07, HM-12, HM-13, auditor 1): menu button when the menu is collapsed, the greeting (h1),
 * the date and the project status, «Visit my Website» and, when the account is past due, the notice of `main` with its days.
 * Without a project status there is neither badge nor website button, as in `main`.
 */
export const HomeHeader = ({ user, projectStatus, isCollapse, onShowMenu, onVisitWebsite }) => {
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()

  const loading = Boolean(projectStatus?.loading)
  const project = projectStatus?.project
  const currentStatus = project?.current_status
  const pastDue = !loading && currentStatus === 'past_due'

  // redesign home C1 (HM-13, auditor 1): the badge says the short word; the long sentence of `main` is the notice below
  const statusLabel = currentStatus === 'active'
    ? t('PROJECT_ACTIVE', 'Project Active')
    : currentStatus === 'past_due'
      ? t('HOME_PROJECT_PAST_DUE', 'Payment past due')
      : undefined

  const pastDueText = t('PROJECT_PAST_DUE_PAYMENT', 'Your account will be suspended in the next _days_ days due to your billing status, please check it to avoid any issues.')
  const until = project?.current_status_until
  const notice = until ? pastDueText.replace('_days_', getCurrentDiffDays(until)) : pastDueText

  return (
    <header className='odc-home-header' data-slot='home-header' aria-busy={loading ? 'true' : undefined}>
      <div className='odc-home-header-lead'>
        {isCollapse && (
          <IconButton icon={MenuIcon} label={t('MENU', 'Menu')} onClick={onShowMenu} />
        )}
        <h1 className='odc-home-title'>{getGreeting(t, user?.name)}</h1>
      </div>
      <div className='odc-home-meta'>
        {/* redesign home C1 (decision 13): the date by the project format, never ISO */}
        <p className='odc-home-date'>{parseDate(new Date(), { dateOnly: true })}</p>
        {loading && <span className='odc-home-badge-skeleton'><Skeleton size='100%' block='var(--od-x-badge-height)' /></span>}
        {/* redesign home R1 (Q-11, PA-2): a status without a label (neither active nor past due) paints no badge: `main` painted an empty pill, a dot without text is worse */}
        {!loading && currentStatus && statusLabel && (
          <ProjectStatusBadge
            currentStatus={currentStatus}
            trialSubscription={projectStatus?.trialSubscription}
            statusLabel={statusLabel}
          />
        )}
      </div>
      {/* redesign home R1 (Q-02): while the status loads the row of the action is already there. The ghost is the button itself, hidden, so its width and height
          are the real ones in any language; a skeleton lies over it */}
      {loading && Number(user?.level) !== 2 && (
        <div className='odc-home-header-action' data-loading='' aria-hidden='true'>
          <Button iconEnd={ExternalLink} disabled tabIndex={-1} aria-hidden='true'>
            {t('VISIT_MY_WEBSITE_LINK', 'Visit my website')}
          </Button>
          <Skeleton className='odc-home-header-action-ghost' size='100%' block='100%' />
        </div>
      )}
      {!loading && currentStatus && Number(user?.level) !== 2 && (
        <div className='odc-home-header-action'>
          <Button iconEnd={ExternalLink} disabled={!projectStatus?.websiteProduct} onClick={onVisitWebsite}>
            {t('VISIT_MY_WEBSITE_LINK', 'Visit my website')}
          </Button>
        </div>
      )}
      {pastDue && (
        <div className='odc-home-header-notice'>
          <InlineNotice tone='warning'>{notice}</InlineNotice>
        </div>
      )}
    </header>
  )
}
