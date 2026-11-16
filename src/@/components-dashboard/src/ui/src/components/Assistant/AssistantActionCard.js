import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage, useUtils } from '../../../../index'
import { Button, InlineNotice } from '../Shared/Product'
import { Ban, CircleCheck, CircleX, Clock, TriangleAlert } from '../Shared/Icon'
import {
  formatCountdown,
  formatFieldValue,
  getActionDisplayStatus,
  getFieldLabel,
  getRecordId,
  getRecordName,
  getRecordTypeLabel,
  getSecondsLeft
} from './format'
import './assistant-card.css'

// redesign AS-A (D1, D2): one anatomy for every state of a proposal (header, changes, result footer)

/** Money, numbers and dates are figures (decision 11) */
const FIGURE_FIELDS = [
  'price', 'offer_price', 'minimum', 'max_discount', 'rate', 'rank', 'prepared_in',
  'min', 'max', 'limit', 'limit_per_user', 'snooze_until', 'start', 'end'
]

/** Re-render every second while a proposal can still be confirmed */
const useNow = (active) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

const requestErrorText = (code, t) => {
  if (code === 'mcp_unavailable') return t('ASSISTANT_ERROR_MCP_UNAVAILABLE', 'Ordering couldn\'t connect right now. No change was made.')
  if (code === 'no_permission') return t('ASSISTANT_ERROR_NO_PERMISSION_CHANGE', 'You don\'t have permission to make this change. No change was made.')
  return t('ASSISTANT_ERROR_ACTION_REQUEST', 'The change could not be sent. No change was made.')
}

/**
 * A translated text with a placeholder (`_time_`, `_count_`) whose value is set in a figure.
 * A translation without the placeholder keeps its text and puts the figure after it.
 */
export const textWithFigure = (text, token, value) => {
  const [before, ...rest] = String(text).split(token)
  const figure = <span className='odc-figure'>{value}</span>
  if (rest.length === 0) return <>{before} {figure}</>
  return (
    <>
      {before}
      {figure}
      {rest.join(token)}
    </>
  )
}

const PENDING = ['proposed', 'confirmed']

/**
 * One proposed change: the preview with confirm / cancel while it waits, and
 * what happened to it afterwards. An `unknown` outcome is never shown as done.
 */
export const AssistantActionCard = (props) => {
  const { action, onConfirm, onCancel, onProposeAgain } = props
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const titleId = useId()
  const cardRef = useRef(null)
  const resultRef = useRef(null)
  const lastStatus = useRef(null)
  const focusWasInside = useRef(false)

  const waiting = action?.status === 'proposed'
  const now = useNow(waiting)
  const status = action ? getActionDisplayStatus(action, now) : null

  // redesign AS-A (M-AS2): read where the focus is while the buttons of the proposal still exist
  // (an unmounted button leaves no event behind in every browser)
  focusWasInside.current = Boolean(cardRef.current?.contains(document.activeElement))

  useEffect(() => {
    const previous = lastStatus.current
    lastStatus.current = status
    if (previous && PENDING.includes(previous) && !PENDING.includes(status) && focusWasInside.current) {
      resultRef.current?.focus({ preventScroll: true })
    }
  }, [status])

  if (!action) return null

  const changes = Array.isArray(action.changes) ? action.changes : []
  const typeLabel = getRecordTypeLabel(action.operation_id, t)
  const name = getRecordName(action, t)
  const recordId = getRecordId(action.operation_id, action.path_params)
  const title = action.record_name || (recordId ? `#${recordId}` : t('ASSISTANT_UNNAMED_RECORD', 'Unnamed'))
  const helpers = { t, parsePrice, parseDate, changes }
  const format = (field, value) => formatFieldValue(field, value, helpers)
  const figure = (field) => (FIGURE_FIELDS.includes(field) ? 'odc-figure' : undefined)
  const cls = (...names) => names.filter(Boolean).join(' ')

  const pending = PENDING.includes(status)
  const applying = Boolean(action.busy) || status === 'confirmed'
  const secondsLeft = getSecondsLeft(action.expires_at, now)

  /** The values the card shows for each state: never as applied what was not applied */
  const renderChanges = () => {
    if (changes.length === 0) return null

    if (status === 'unknown') {
      // What the record has now, as far as it could be read: no strike, no arrow, not the proposal
      if (action.observed === 'unreadable' || !action.after) return null
      const read = changes.filter(change => change.field in action.after)
      if (read.length === 0) return null
      return (
        <dl className='odc-as-changes'>
          {read.map(change => (
            <div className='odc-as-change' key={change.field}>
              <dt>{getFieldLabel(change.field, t)}</dt>
              <dd><span className={cls('odc-as-now', figure(change.field))}>{format(change.field, action.after[change.field])}</span></dd>
            </div>
          ))}
        </dl>
      )
    }

    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      // The proposal, dimmed: it was not applied
      return (
        <>
          <p className='odc-as-label' id={`${titleId}-proposed`}>{t('ASSISTANT_PROPOSED', 'Proposed')}</p>
          <dl className='odc-as-changes' aria-labelledby={`${titleId}-proposed`}>
            {changes.map(change => (
              <div className='odc-as-change' key={change.field}>
                <dt>{getFieldLabel(change.field, t)}</dt>
                <dd>
                  {change.before_known && (
                    <>
                      <span className={cls('odc-as-dim', figure(change.field))}>{format(change.field, change.before)}</span>
                      <span aria-hidden>→</span>
                    </>
                  )}
                  <span className={cls('odc-as-dim', figure(change.field))}>{format(change.field, change.after)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )
    }

    // proposed, confirmed, executed
    const executed = status === 'executed'
    return (
      <dl className='odc-as-changes'>
        {changes.map(change => {
          const after = executed && action.after && change.field in action.after ? action.after[change.field] : change.after
          return (
            <div className='odc-as-change' key={change.field}>
              <dt>{getFieldLabel(change.field, t)}</dt>
              <dd>
                {change.before_known && <del className={cls('odc-as-before', figure(change.field))}>{format(change.field, change.before)}</del>}
                {(change.before_known || !executed) && <span aria-hidden>→</span>}
                <ins className={cls('odc-as-after', figure(change.field))}>{format(change.field, after)}</ins>
                {!change.before_known && !executed && <span className='odc-as-unknown'>{t('ASSISTANT_BEFORE_UNKNOWN', '(current value not available)')}</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }

  /** icon, title, text and (for a few states) the values or an action */
  const renderResult = () => {
    if (status === 'executed') {
      return {
        Icon: CircleCheck,
        title: t('ASSISTANT_RESULT_UPDATED', '_type_ updated: _name_').replace('_type_', typeLabel).replace('_name_', name)
      }
    }
    if (status === 'failed') {
      const state = action.error?.state
      const reason = state === 'no_permission'
        ? t('ASSISTANT_RESULT_NO_PERMISSION', 'You don\'t have permission to change this.')
        : state === 'mcp_unavailable'
          ? t('ASSISTANT_RESULT_MCP_UNAVAILABLE', 'Ordering couldn\'t connect right now.')
          : t('ASSISTANT_RESULT_REJECTED', 'Ordering didn\'t accept the change.')
      return {
        Icon: CircleX,
        title: t('ASSISTANT_RESULT_FAILED', 'Couldn\'t change _name_').replace('_name_', name),
        text: `${reason} ${t('ASSISTANT_NO_CHANGE_MADE', 'No change was made.')}`
      }
    }
    if (status === 'unknown') {
      const observed = action.observed
      return {
        Icon: TriangleAlert,
        title: t('ASSISTANT_UNKNOWN_TITLE', 'We couldn\'t confirm the change to _name_').replace('_name_', name),
        text: observed === 'applied'
          ? t('ASSISTANT_UNKNOWN_APPLIED', 'It looks applied. This is what _name_ has now:').replace('_name_', name)
          : observed === 'not_applied'
            ? t('ASSISTANT_UNKNOWN_NOT_APPLIED', 'It doesn\'t look applied. You can ask for it again.')
            : t('ASSISTANT_UNKNOWN_UNREADABLE', 'We couldn\'t read how it ended up either. Check it before trying again.'),
        values: true
      }
    }
    if (status === 'expired') {
      return {
        Icon: Clock,
        title: t('ASSISTANT_EXPIRED_TITLE', 'This proposal expired'),
        text: t('ASSISTANT_EXPIRED_TEXT', 'No change was made to _name_.').replace('_name_', name),
        again: Boolean(onProposeAgain)
      }
    }
    if (status === 'cancelled') {
      return {
        Icon: Ban,
        title: t('ASSISTANT_CANCELLED_TITLE', 'You cancelled this change'),
        text: t('ASSISTANT_CANCELLED_TEXT', '_name_ stays as it was.').replace('_name_', name)
      }
    }
    return null
  }

  const result = pending ? null : renderResult()
  if (!pending && !result) return null

  const countdown = t('ASSISTANT_EXPIRES_IN', 'Expires in _time_')

  return (
    <article ref={cardRef} className='odc-root odc-as-card' data-status={status} data-action-id={action.id} aria-labelledby={titleId}>
      <header className='odc-as-card-head'>
        <div className='odc-as-card-title'>
          <span className='odc-as-type'>{typeLabel}</span>
          <strong className='odc-as-name' id={titleId}>{title}</strong>
        </div>
        {status === 'proposed' && secondsLeft !== null && (
          // redesign AS-A (M-AS13): the visible text says it; the live region stays quiet each second
          <span className='odc-as-countdown' aria-live='off'>
            <Clock className='odc-icon' />
            {textWithFigure(countdown, '_time_', formatCountdown(secondsLeft))}
          </span>
        )}
      </header>

      {pending && action.context_mismatch && (
        // api-ai flags a write aimed at another record than the one open on the page
        <InlineNotice tone='warning' icon={TriangleAlert} role='alert' className='odc-as-notice'>
          {t('ASSISTANT_CONTEXT_MISMATCH', 'This change is for _name_, not for what you have open on this page. Check it before confirming.').replace('_name_', name)}
        </InlineNotice>
      )}

      {status !== 'unknown' && renderChanges()}

      {pending && action.requestError && (
        <InlineNotice tone='danger' role='alert' className='odc-as-notice'>
          {requestErrorText(action.requestError, t)}
        </InlineNotice>
      )}

      {pending && (
        <footer className='odc-as-actions'>
          <Button variant='ghost' size='md' focusableWhenDisabled disabled={applying} onClick={() => onCancel([action.id])}>
            {t('CANCEL', 'Cancel')}
          </Button>
          <Button
            variant='primary'
            size='md' // redesign R1-4 (D1): 32px, like the rest of Product's actions
            data-as-confirm=''
            busy={applying}
            focusableWhenDisabled
            disabled={applying}
            onClick={() => onConfirm([action.id])}
          >
            {applying ? t('ASSISTANT_APPLYING', 'Applying…') : t('ASSISTANT_CONFIRM_CHANGE', 'Confirm change')}
          </Button>
        </footer>
      )}

      {result && (
        <div className='odc-as-result' role='status' tabIndex={-1} ref={resultRef} data-as-result=''>
          <result.Icon className='odc-icon odc-as-result-icon' />
          <div className='odc-as-result-body'>
            <p className='odc-as-result-title'>{result.title}</p>
            {result.text && <p className='odc-as-result-text'>{result.text}</p>}
            {result.values && renderChanges()}
            {result.again && (
              <Button variant='secondary' size='sm' onClick={onProposeAgain}>
                {t('ASSISTANT_PROPOSE_AGAIN', 'Propose again')}
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
