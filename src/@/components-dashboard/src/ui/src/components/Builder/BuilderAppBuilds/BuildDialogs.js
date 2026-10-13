import React, { useEffect, useId, useRef, useState } from 'react'
import { ExclamationTriangle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Modal } from '../../Shared'
import { GuideLink } from '../BuilderShared'
import {
  BUILD_MODE_OPTIONS,
  getBuildActionError,
  getBuildFailureText,
  getBuildModeLabel,
  getBuildStatusLabel,
  getBuildKind,
  getCheckProblems,
  getDefaultBuildOption,
  getPlatformLabel,
  isBuildRunning,
  toPlatformChecks
} from '../utils'
import {
  BlockedPanel,
  DialogBody,
  DialogFooter,
  DialogTitle,
  ErrorBanner,
  LinkButton,
  LogBox,
  ModeOption,
  MutedText,
  Notice,
  OwnerPill,
  Pill,
  ProblemList
} from '../styles'

const DIALOG_WIDTH = 'min(560px, calc(100vw - 32px))'

/** A problem of the checks, with the way to the tab that fixes it. */
export const ProblemItem = ({ problem, onFix }) => {
  const [, t] = useLanguage()
  return (
    <li>
      <OwnerPill owner={problem.owner}>
        {problem.owner === 'ordering' ? 'Ordering' : t('BUILDER_TO_DO', 'To do')}
      </OwnerPill>
      <span>{problem.text}</span>
      {problem.tab && onFix && (
        <LinkButton type='button' onClick={() => onFix(problem.tab, problem.group)}>
          {t('BUILDER_FIX', 'Fix')}
        </LinkButton>
      )}
    </li>
  )
}

/**
 * Picks the mode of a build and asks for it. Shows what the checks already
 * say is missing (Build stays off) and, when the API refuses with
 * `build.blocked`, its list for the chosen mode instead.
 */
export const BuildDialog = (props) => {
  const { platform, latest, productStatus, version, checkProblems, guides, onSubmit, onClose, onGoToTab } = props
  const [, t] = useLanguage()
  const options = BUILD_MODE_OPTIONS[platform] || []
  const [value, setValue] = useState(() => getDefaultBuildOption(platform, latest, productStatus))
  const [submitting, setSubmitting] = useState(false)
  const [refused, setRefused] = useState(null)
  const [error, setError] = useState(null)
  const titleId = useId()

  const mine = (checkProblems || []).filter(problem => problem.platform === platform)
  const toDo = refused ?? mine.filter(problem => problem.owner === 'customer')
  const forOrdering = mine.filter(problem => problem.owner === 'ordering').length
  const platformLabel = getPlatformLabel(platform)

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
    <Modal
      open
      width={DIALOG_WIDTH}
      padding='24px'
      onClose={onClose}
    >
      <DialogBody as='form' role='dialog' aria-labelledby={titleId} onSubmit={submit} noValidate>
        <DialogTitle id={titleId}>{t('BUILDER_BUILD_FOR', 'Build for _platform_').replace('_platform_', platformLabel)}</DialogTitle>
        {version && (
          <MutedText>{t('BUILDER_BUILD_VERSION_FROM_GENERAL', 'Version _version_ · from the General tab').replace('_version_', version)}</MutedText>
        )}
        <fieldset>
          <legend>{t('BUILDER_BUILD_WHAT_FOR', 'What do you need?')}</legend>
          {options.map(option => (
            <ModeOption key={option.value} selected={value === option.value}>
              <input
                type='radio'
                name={`builder-build-mode-${platform}`}
                value={option.value}
                checked={value === option.value}
                onChange={() => choose(option.value)}
              />
              <span>
                <strong>{option.label(t)}</strong>
                <small>{option.description(t)}</small>
                <GuideLink href={option.guide && guides?.[option.guide]}>{t('BUILDER_GUIDE_HOW_IT_WORKS', 'How it works')}</GuideLink>
              </span>
            </ModeOption>
          ))}
        </fieldset>

        {toDo.length > 0 && (
          <BlockedPanel role={refused ? 'alert' : undefined}>
            <strong>
              <ExclamationTriangle aria-hidden='true' color='#7A5000' />
              {t('BUILDER_BUILD_BLOCKED', 'Complete these before building for _platform_:').replace('_platform_', platformLabel)}
            </strong>
            <ProblemList>
              {toDo.map(problem => <ProblemItem key={problem.key} problem={problem} onFix={fix} />)}
            </ProblemList>
          </BlockedPanel>
        )}

        {forOrdering > 0 && (
          <Notice>
            <OwnerPill owner='ordering'>Ordering</OwnerPill>
            <span>
              {t('BUILDER_BUILD_ORDERING_REVIEW', 'Ordering is reviewing _count_ issue(s) in the base. They don’t stop this build.').replace('_count_', forOrdering)}
            </span>
          </Notice>
        )}

        {error && <ErrorBanner role='alert'>{error}</ErrorBanner>}

        <MutedText small>{t('BUILDER_BUILD_LEAVE_PAGE', 'You can leave this page. The build’s status updates here.')}</MutedText>

        <DialogFooter>
          <Button type='button' color='secundary' borderRadius='8px' onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
          <Button type='submit' color='primary' borderRadius='8px' disabled={submitting || toDo.length > 0}>
            {submitting ? t('BUILDER_BUILD_REQUESTING', 'Requesting…') : t('BUILDER_BUILD', 'Build')}
          </Button>
        </DialogFooter>
      </DialogBody>
    </Modal>
  )
}

/** The Jenkins log of an attempt, with why it failed. */
export const BuildLogDialog = (props) => {
  const { attempt, getBuildLog, formatDate, onClose } = props
  const [, t] = useLanguage()
  const [logState, setLogState] = useState({ loading: true, log: null, error: null })
  const [copied, setCopied] = useState(false)
  const boxRef = useRef(null)
  const titleId = useId()

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logState.log || '')
      setCopied(true)
    } catch (err) {
      setCopied(false)
    }
  }

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
    <Modal open width='min(840px, calc(100vw - 32px))' padding='24px' onClose={onClose}>
      <DialogBody role='dialog' aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <MutedText small>
          <Pill kind={getBuildKind(attempt.status)}>{getBuildStatusLabel(attempt.status, t)}</Pill>
          {' '}
          {formatDate(attempt.created_at, 'MMM D, YYYY h:mm A')}
        </MutedText>
        {attempt.status === 'failed' && <Notice tone='error' role='status'>{getBuildFailureText(attempt, t)}</Notice>}
        {logState.error && <ErrorBanner role='alert'>{logState.error}</ErrorBanner>}
        {!logState.error && (
          <LogBox ref={boxRef} tabIndex={0} aria-label={t('BUILDER_BUILD_LOG', 'Build log')} aria-busy={logState.loading ? 'true' : 'false'}>
            {logState.loading && logState.log === null ? t('BUILDER_LOG_LOADING', 'Loading the log…') : logState.log}
          </LogBox>
        )}
        <DialogFooter>
          {logState.log !== null && (
            <>
              <Button type='button' color='secundary' borderRadius='8px' onClick={copy}>
                {copied ? t('BUILDER_COPIED', 'Copied') : t('BUILDER_COPY', 'Copy')}
              </Button>
              <Button type='button' color='secundary' borderRadius='8px' onClick={download}>{t('BUILDER_DOWNLOAD_TXT', 'Download .txt')}</Button>
            </>
          )}
          {(isBuildRunning(attempt) || logState.error) && (
            <Button type='button' color='secundary' borderRadius='8px' disabled={logState.loading} onClick={load}>
              {logState.error ? t('BUILDER_RETRY', 'Try again') : t('BUILDER_REFRESH', 'Refresh')}
            </Button>
          )}
          <Button type='button' color='primary' borderRadius='8px' onClick={onClose}>{t('CLOSE', 'Close')}</Button>
        </DialogFooter>
      </DialogBody>
    </Modal>
  )
}

/** Retrying uses the attempt's settings; a new build uses the current ones. */
export const RetryDialog = (props) => {
  const { attempt, busy, formatDate, onRetry, onBuildNew, onClose } = props
  const [, t] = useLanguage()
  const titleId = useId()
  const summary = [
    getPlatformLabel(attempt.platform),
    getBuildModeLabel(attempt, t),
    attempt.app_version && `v${attempt.app_version}`,
    `${getBuildStatusLabel(attempt.status, t)} ${formatDate(attempt.updated_at, 'MMM D, YYYY h:mm A')}`
  ].filter(Boolean).join(' · ')
  return (
    <Modal open width={DIALOG_WIDTH} padding='24px' onClose={onClose}>
      <DialogBody role='dialog' aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{t('BUILDER_RETRY_TITLE', 'Retry this build?')}</DialogTitle>
        <p>{t('BUILDER_RETRY_HELP', 'It uses the settings of this attempt. Changes you made after it aren’t included: start a new build to use them.')}</p>
        <MutedText small>{summary}</MutedText>
        <DialogFooter>
          <Button type='button' color='secundary' borderRadius='8px' disabled={busy} onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
          <Button type='button' color='primary' outline borderRadius='8px' disabled={busy} onClick={onBuildNew}>
            {t('BUILDER_BUILD_WITH_CURRENT', 'Build with current settings')}
          </Button>
          <Button type='button' color='primary' borderRadius='8px' disabled={busy} onClick={onRetry}>{t('BUILDER_RETRY_BUILD', 'Retry')}</Button>
        </DialogFooter>
      </DialogBody>
    </Modal>
  )
}
