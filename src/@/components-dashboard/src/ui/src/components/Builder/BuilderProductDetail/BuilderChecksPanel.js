import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { ChevronDown, ChevronUp, CircleCheck, TriangleAlert } from '../../Shared/Icon'
import { Button, StatusBadge } from '../../Shared/Product'
import { PlatformIcon } from '../BuilderShared'
import { getCheckProblems, getPlatformLabel } from '../utils'
import '../BuilderAppSettings/builder-app-edit.css'

// redesign B2: on Product pieces (Button link, StatusBadge for the owner) and --od-* tokens. Same states, texts and
// disclosure as main: the header stays a native button with aria-expanded and aria-controls, as main's.

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
      <section className='odc-be-checks' aria-live='polite'>
        <div className='odc-be-checks-head'>
          <TriangleAlert className='odc-icon' aria-hidden='true' />
          <span className='odc-be-checks-text'>
            <strong>{t('BUILDER_CHECKS_ERROR', 'We couldn’t check what the next build needs')}</strong>
          </span>
          <Button variant='link' onClick={reloadChecks}>{t('BUILDER_RETRY', 'Try again')}</Button>
        </div>
      </section>
    )
  }

  if (!checks) {
    return loading
      ? (
        <section className='odc-be-checks' data-tone='clean' aria-busy='true'>
          <div className='odc-be-checks-head'>
            <span className='odc-be-checks-text'><small>{t('BUILDER_CHECKS_LOADING', 'Checking what the next build needs…')}</small></span>
          </div>
        </section>
        )
      : null
  }

  const problems = getCheckProblems(checks, t)
  const toComplete = problems.filter(problem => problem.owner === 'customer').length
  const forOrdering = problems.filter(problem => problem.owner === 'ordering').length

  if (!problems.length) {
    return (
      <section className='odc-be-checks' data-tone='clean' aria-live='polite'>
        <div className='odc-be-checks-head'>
          <CircleCheck className='odc-icon' aria-hidden='true' />
          <span className='odc-be-checks-text'>
            <strong>{t('BUILDER_CHECKS_CLEAN', 'Nothing is missing for the next build')}</strong>
          </span>
        </div>
      </section>
    )
  }

  const platforms = [...new Set(problems.map(problem => problem.platform))]
  const summary = [
    toComplete && t('BUILDER_CHECKS_TO_COMPLETE', '_count_ for you to complete').replace('_count_', toComplete),
    forOrdering && t('BUILDER_CHECKS_FOR_ORDERING_REVIEW', '_count_ for Ordering to review').replace('_count_', forOrdering)
  ].filter(Boolean).join(' · ')

  return (
    <section className='odc-be-checks' aria-labelledby='builder-checks-title' aria-live='polite'>
      <button
        type='button'
        className='odc-be-checks-head'
        aria-expanded={open ? 'true' : 'false'}
        aria-controls='builder-checks-body'
        onClick={() => setOpen(!open)}
      >
        <TriangleAlert className='odc-icon' aria-hidden='true' />
        <span className='odc-be-checks-text'>
          <strong id='builder-checks-title'>{t('BUILDER_CHECKS_TITLE', 'Before the next build')}</strong>
          <small>{summary}</small>
        </span>
        <span className='odc-be-checks-toggle'>
          {open ? t('BUILDER_HIDE', 'Hide') : t('BUILDER_SHOW', 'Show')}
          {open ? <ChevronUp className='odc-icon' aria-hidden='true' /> : <ChevronDown className='odc-icon' aria-hidden='true' />}
        </span>
      </button>
      {open && (
        <div id='builder-checks-body' className='odc-be-checks-grid'>
          {platforms.map(platform => (
            <div key={platform} className='odc-be-checks-card'>
              <strong>
                <PlatformIcon platform={platform} />
                {getPlatformLabel(platform)}
              </strong>
              <ul>
                {problems.filter(problem => problem.platform === platform).map(problem => (
                  <li key={problem.key}>
                    <StatusBadge
                      family={problem.owner === 'ordering' ? 'review' : 'pending'}
                      label={problem.owner === 'ordering' ? 'Ordering' : t('BUILDER_TO_DO', 'To do')}
                    />
                    <span>{problem.text}</span>
                    {problem.tab && (
                      <Button variant='link' size='sm' onClick={() => onGoToTab(problem.tab, problem.group)}>
                        {t('BUILDER_FIX', 'Fix')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
