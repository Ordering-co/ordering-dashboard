import React, { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, ExclamationTriangle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { PlatformIcon } from '../BuilderShared'
import { getCheckProblems, getPlatformLabel } from '../utils'
import {
  ChecksCard,
  ChecksGrid,
  ChecksHeader,
  ChecksPanel,
  ChecksToggleLabel,
  LinkButton,
  OwnerPill
} from '../styles'

/**
 * What the next build of the app would get wrong. Always on screen for
 * a draft or active app and collapsible. Problems for the customer link to the
 * tab that fixes them; those of the base are Ordering's and don't stop a build.
 */
export const BuilderChecksPanel = (props) => {
  const { checksState, reloadChecks, onGoToTab } = props
  const [, t] = useLanguage()
  const [open, setOpen] = useState(true)

  const { loading, checks, error } = checksState

  if (error) {
    return (
      <ChecksPanel aria-live='polite'>
        <ChecksHeader as='div'>
          <ExclamationTriangle aria-hidden='true' color='#7A5000' size={18} />
          <span>
            <strong>{t('BUILDER_CHECKS_ERROR', 'We couldn’t check what the next build needs')}</strong>
          </span>
          <LinkButton type='button' onClick={reloadChecks}>{t('BUILDER_RETRY', 'Try again')}</LinkButton>
        </ChecksHeader>
      </ChecksPanel>
    )
  }

  if (!checks) {
    return loading
      ? (
        <ChecksPanel clean aria-busy='true'>
          <ChecksHeader as='div'>
            <span><small>{t('BUILDER_CHECKS_LOADING', 'Checking what the next build needs…')}</small></span>
          </ChecksHeader>
        </ChecksPanel>
        )
      : null
  }

  const problems = getCheckProblems(checks, t)
  const toComplete = problems.filter(problem => problem.owner === 'customer').length
  const forOrdering = problems.filter(problem => problem.owner === 'ordering').length

  if (!problems.length) {
    return (
      <ChecksPanel clean aria-live='polite'>
        <ChecksHeader as='div'>
          <CheckCircle aria-hidden='true' color='#0B6B42' size={18} />
          <span>
            <strong>{t('BUILDER_CHECKS_CLEAN', 'Nothing is missing for the next build')}</strong>
          </span>
        </ChecksHeader>
      </ChecksPanel>
    )
  }

  const platforms = [...new Set(problems.map(problem => problem.platform))]
  const summary = [
    toComplete && t('BUILDER_CHECKS_TO_COMPLETE', '_count_ for you to complete').replace('_count_', toComplete),
    forOrdering && t('BUILDER_CHECKS_FOR_ORDERING_REVIEW', '_count_ for Ordering to review').replace('_count_', forOrdering)
  ].filter(Boolean).join(' · ')

  return (
    <ChecksPanel aria-labelledby='builder-checks-title' aria-live='polite'>
      <ChecksHeader
        type='button'
        aria-expanded={open ? 'true' : 'false'}
        aria-controls='builder-checks-body'
        onClick={() => setOpen(!open)}
      >
        <ExclamationTriangle aria-hidden='true' color='#7A5000' size={18} />
        <span>
          <strong id='builder-checks-title'>{t('BUILDER_CHECKS_TITLE', 'Before the next build')}</strong>
          <small>{summary}</small>
        </span>
        <ChecksToggleLabel>
          {open ? t('BUILDER_HIDE', 'Hide') : t('BUILDER_SHOW', 'Show')}
          {open ? <ChevronUp aria-hidden='true' /> : <ChevronDown aria-hidden='true' />}
        </ChecksToggleLabel>
      </ChecksHeader>
      {open && (
        <ChecksGrid id='builder-checks-body'>
          {platforms.map(platform => (
            <ChecksCard key={platform}>
              <strong>
                <PlatformIcon platform={platform} />
                {getPlatformLabel(platform)}
              </strong>
              <ul>
                {problems.filter(problem => problem.platform === platform).map(problem => (
                  <li key={problem.key}>
                    <OwnerPill owner={problem.owner}>
                      {problem.owner === 'ordering' ? 'Ordering' : t('BUILDER_TO_DO', 'To do')}
                    </OwnerPill>
                    <span>{problem.text}</span>
                    {problem.tab && (
                      <LinkButton type='button' onClick={() => onGoToTab(problem.tab, problem.group)}>
                        {t('BUILDER_FIX', 'Fix')}
                      </LinkButton>
                    )}
                  </li>
                ))}
              </ul>
            </ChecksCard>
          ))}
        </ChecksGrid>
      )}
    </ChecksPanel>
  )
}
