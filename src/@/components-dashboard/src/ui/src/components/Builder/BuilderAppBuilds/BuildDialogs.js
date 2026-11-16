import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { CircleAlert, TriangleAlert } from '../../Shared/Icon'
import { Button, CopyButton, Dialog, InlineNotice, RadioGroup, StatusBadge } from '../../Shared/Product'
import { GuideLink } from '../BuilderShared'
import {
  BUILD_MODE_OPTIONS,
  getBuildActionError,
  getBuildFailureText,
  getBuildModeLabel,
  getBuildStatusLabel,
  getCheckProblems,
  getDefaultBuildOption,
  getPlatformLabel,
  isBuildRunning,
  toPlatformChecks
} from '../utils'
import { BuildPill, DATE_TIME } from './BuildsCard'
import './builder-builds.css'

// redesign B2: the build, log and retry dialogs on P/Dialog, the modes on P/RadioGroup and Copy on P/CopyButton. Same
// requests, rules, texts and closing as main's Modal.

/** A problem of the checks, with the way to the tab that fixes it. */
export const ProblemItem = ({ problem, onFix }) => {
  const [, t] = useLanguage()
  return (
    <li className='odc-bb-problem'>
      {/* the same owner badge as the checks panel (review of #433) */}
      <StatusBadge
        family={problem.owner === 'ordering' ? 'review' : 'pending'}
        label={problem.owner === 'ordering' ? 'Ordering' : t('BUILDER_TO_DO', 'To do')}
      />
      <span>{problem.text}</span>
      {problem.tab && onFix && (
        <Button variant='link' size='sm' onClick={() => onFix(problem.tab, problem.group)}>
          {t('BUILDER_FIX', 'Fix')}
        </Button>
      )}
    </li>
  )
}

/**
 * Picks the mode of a build and asks for it. Shows what the checks already
 * say is missing (Build stays off) and, when the API refuses with
 * `build.blocked`, its list for the chosen mode instead. It opens on
 * `initial`, the file type of the tab the Build button was pressed on, which
 * can be changed like any other; `options` are the section's by default (My
 * Products gives its own, with the debug files).
 */
export const BuildDialog = (props) => {
  const { platform, latest, productStatus, version, checkProblems, guides, initial, onSubmit, onClose, onGoToTab } = props
  const [, t] = useLanguage()
  const options = props.options || BUILD_MODE_OPTIONS[platform] || []
  const [value, setValue] = useState(() => getDefaultBuildOption(platform, latest, productStatus, { options, initial }))
  const [submitting, setSubmitting] = useState(false)
  const [refused, setRefused] = useState(null)
  const [error, setError] = useState(null)
  const formId = useId()

  const mine = (checkProblems || []).filter(problem => problem.platform === platform)
  const toDo = refused ?? mine.filter(problem => problem.owner === 'customer')
  const forOrdering = mine.filter(problem => problem.owner === 'ordering').length
  const platformLabel = getPlatformLabel(platform)
  const guided = options.filter(option => option.guide && guides?.[option.guide])

  const choose = (next) => {
    setValue(next)
    setRefused(null)
    setError(null)
  }

  const fix = (tab, group) => {
    onClose()
    onGoToTab(tab, group)
  }

  const submit = async (e) => {
    e.preventDefault()
    const option = options.find(item => item.value === value)
    if (!option || submitting) return
    setSubmitting(true)
    setError(null)
    const answer = await onSubmit(platform, { mode: option.mode, type: option.type })
    setSubmitting(false)
    if (answer.ok) return
    if (answer.errorCodes.includes('build.blocked')) {
      const problems = getCheckProblems(toPlatformChecks(answer.checks, platform), t)
        .filter(problem => problem.owner === 'customer')
      setRefused(problems)
      if (problems.length) return
    }
    setError(getBuildActionError('build', answer.errorCodes, { platform }, t))
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title={t('BUILDER_BUILD_FOR', 'Build for _platform_').replace('_platform_', platformLabel)}
      closeLabel={t('CLOSE', 'Close')}
      footer={(
        <>
          <Button onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
          <Button type='submit' form={formId} variant='primary' disabled={submitting || toDo.length > 0}>
            {submitting ? t('BUILDER_BUILD_REQUESTING', 'Requesting…') : t('BUILDER_BUILD', 'Build')}
          </Button>
        </>
      )}
    >
      <form id={formId} className='odc-bb-dialog' onSubmit={submit} noValidate>
        {version && (
          <p className='odc-bb-muted'>{t('BUILDER_BUILD_VERSION_FROM_GENERAL', 'Version _version_ · from the General tab').replace('_version_', version)}</p>
        )}
        <RadioGroup
          label={t('BUILDER_BUILD_WHAT_FOR', 'What do you need?')}
          value={value}
          onValueChange={choose}
          options={options.map(option => ({ value: option.value, label: option.label(t), description: option.description(t) }))}
        />
        {/* redesign B2: a link can't live inside a radio (a button), so each mode's «How it works» follows the options,
            named by its mode; one click each, as in main */}
        {guided.length > 0 && (
          <p className='odc-bb-guides'>
            <span>{t('BUILDER_GUIDE_HOW_IT_WORKS', 'How it works')}</span>
            {guided.map(option => <GuideLink key={option.value} href={guides[option.guide]}>{option.label(t)}</GuideLink>)}
          </p>
        )}

        {toDo.length > 0 && (
          <div className='odc-bb-blocked' role={refused ? 'alert' : undefined}>
            <strong>
              <TriangleAlert className='odc-icon' />
              {t('BUILDER_BUILD_BLOCKED', 'Complete these before building for _platform_:').replace('_platform_', platformLabel)}
            </strong>
            <ul className='odc-bb-problems'>
              {toDo.map(problem => <ProblemItem key={problem.key} problem={problem} onFix={fix} />)}
            </ul>
          </div>
        )}

        {forOrdering > 0 && (
          <InlineNotice tone='warning' live={false} icon={null} className='odc-bb-notice'>
            <StatusBadge family='review' label='Ordering' />
            {' '}
            {t('BUILDER_BUILD_ORDERING_REVIEW', 'Ordering is reviewing _count_ issue(s) in the base. They don’t stop this build.').replace('_count_', forOrdering)}
          </InlineNotice>
        )}

        {error && <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bb-notice'>{error}</InlineNotice>}

        <p className='odc-bb-muted'>{t('BUILDER_BUILD_LEAVE_PAGE', 'You can leave this page. The build’s status updates here.')}</p>
      </form>
    </Dialog>
  )
}

/** The Jenkins log of an attempt, with why it failed. */
export const BuildLogDialog = (props) => {
  const { attempt, getBuildLog, formatDate, onClose } = props
  const [, t] = useLanguage()
  const [logState, setLogState] = useState({ loading: true, log: null, error: null })
  const boxRef = useRef(null)

  const load = async () => {
    setLogState(prev => ({ ...prev, loading: true, error: null }))
    const answer = await getBuildLog(attempt.id)
    if (answer.ok) {
      setLogState({ loading: false, log: answer.result?.log ?? '', error: null })
      return
    }
    setLogState({ loading: false, log: null, error: getBuildActionError('log', answer.errorCodes, { platform: attempt.platform }, t) })
  }

  useEffect(() => {
    load()
  }, [attempt.id])

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight
  }, [logState.log])

  const download = () => {
    const url = URL.createObjectURL(new Blob([logState.log || ''], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${attempt.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const title = [
    t('BUILDER_BUILD_LOG', 'Build log'),
    getPlatformLabel(attempt.platform),
    getBuildModeLabel(attempt, t),
    attempt.app_version && `v${attempt.app_version}`
  ].filter(Boolean).join(' · ')

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title={title}
      closeLabel={t('CLOSE', 'Close')}
      size='lg'
      className='odc-bb-log-dialog'
      footer={(
        <>
          {logState.log !== null && (
            <>
              {/* redesign B2: P/CopyButton («Copied» for two seconds; a failed copy says so) */}
              <CopyButton
                text={logState.log}
                label={t('BUILDER_COPY', 'Copy')}
                copyLabel={t('BUILDER_COPY', 'Copy')}
                copiedLabel={t('BUILDER_COPIED', 'Copied')}
                failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
              />
              <Button onClick={download}>{t('BUILDER_DOWNLOAD_TXT', 'Download .txt')}</Button>
            </>
          )}
          {(isBuildRunning(attempt) || logState.error) && (
            <Button disabled={logState.loading} onClick={load}>
              {logState.error ? t('BUILDER_RETRY', 'Try again') : t('BUILDER_REFRESH', 'Refresh')}
            </Button>
          )}
          <Button variant='primary' onClick={onClose}>{t('CLOSE', 'Close')}</Button>
        </>
      )}
    >
      <div className='odc-bb-dialog'>
        <p className='odc-bb-muted'>
          <BuildPill status={attempt.status} />
          {' '}
          {formatDate(attempt.created_at, DATE_TIME)}
        </p>
        {attempt.status === 'failed' && (
          <InlineNotice tone='danger' icon={CircleAlert} className='odc-bb-notice'>{getBuildFailureText(attempt, t)}</InlineNotice>
        )}
        {logState.error && <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bb-notice'>{logState.error}</InlineNotice>}
        {!logState.error && (
          <pre ref={boxRef} className='odc-bb-log' tabIndex={0} aria-label={t('BUILDER_BUILD_LOG', 'Build log')} aria-busy={logState.loading ? 'true' : 'false'}>
            {logState.loading && logState.log === null ? t('BUILDER_LOG_LOADING', 'Loading the log…') : logState.log}
          </pre>
        )}
      </div>
    </Dialog>
  )
}

/** Retrying uses the attempt's settings; a new build uses the current ones. */
export const RetryDialog = (props) => {
  const { attempt, busy, formatDate, onRetry, onBuildNew, onClose } = props
  const [, t] = useLanguage()
  const summary = [
    getPlatformLabel(attempt.platform),
    getBuildModeLabel(attempt, t),
    attempt.app_version && `v${attempt.app_version}`,
    `${getBuildStatusLabel(attempt.status, t)} ${formatDate(attempt.updated_at, DATE_TIME)}`
  ].filter(Boolean).join(' · ')
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title={t('BUILDER_RETRY_TITLE', 'Retry this build?')}
      closeLabel={t('CLOSE', 'Close')}
      footer={(
        <>
          <Button disabled={busy} onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
          <Button disabled={busy} onClick={onBuildNew}>{t('BUILDER_BUILD_WITH_CURRENT', 'Build with current settings')}</Button>
          <Button variant='primary' disabled={busy} onClick={onRetry}>{t('BUILDER_RETRY_BUILD', 'Retry')}</Button>
        </>
      )}
    >
      <div className='odc-bb-dialog'>
        <p>{t('BUILDER_RETRY_HELP', 'It uses the settings of this attempt. Changes you made after it aren’t included: start a new build to use them.')}</p>
        <p className='odc-bb-muted'>{summary}</p>
      </div>
    </Dialog>
  )
}
