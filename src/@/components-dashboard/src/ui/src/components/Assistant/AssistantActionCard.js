import React, { useEffect, useState } from 'react'
import { CheckLg, Clock, ExclamationTriangle, XCircle } from 'react-bootstrap-icons'
import { useLanguage, useUtils } from '../../../../index'
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
import {
  ActionButton,
  Callout,
  Card,
  CardActions,
  CardHeader,
  CardTitle,
  ChangeList,
  ChangeRow,
  Countdown
} from './styles'

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
 * One proposed change: the preview with confirm / cancel while it waits, and
 * what happened to it afterwards. An `unknown` outcome is never shown as done.
 */
export const AssistantActionCard = (props) => {
  const { action, onConfirm, onCancel, onProposeAgain } = props
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()

  const waiting = action?.status === 'proposed'
  const now = useNow(waiting)
  if (!action) return null

  const status = getActionDisplayStatus(action, now)
  const changes = Array.isArray(action.changes) ? action.changes : []
  const typeLabel = getRecordTypeLabel(action.operation_id, t)
  const name = getRecordName(action, t)
  const recordId = getRecordId(action.operation_id, action.path_params)
  const helpers = { t, parsePrice, parseDate, changes }
  const format = (field, value) => formatFieldValue(field, value, helpers)

  if (status === 'proposed' || status === 'confirmed') {
    const secondsLeft = getSecondsLeft(action.expires_at, now)
    const applying = action.busy || status === 'confirmed'
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <small>{typeLabel}</small>
            <strong>{action.record_name || (recordId ? `#${recordId}` : t('ASSISTANT_UNNAMED_RECORD', 'Unnamed'))}</strong>
          </CardTitle>
          {status === 'proposed' && secondsLeft !== null && (
            <Countdown aria-label={t('ASSISTANT_EXPIRES_IN', 'Expires in _time_').replace('_time_', formatCountdown(secondsLeft))}>
              <Clock size={12} aria-hidden />
              {t('ASSISTANT_EXPIRES_IN', 'Expires in _time_').replace('_time_', formatCountdown(secondsLeft))}
            </Countdown>
          )}
        </CardHeader>
        {action.context_mismatch && (
          // api-ai flags a write aimed at another record than the one open on the page
          <Callout tone='warning' role='alert' style={{ margin: '12px 14px 0' }}>
            <div className='title'>
              <ExclamationTriangle size={15} aria-hidden />
              {t('ASSISTANT_CONTEXT_MISMATCH', 'This change is for _name_, not for what you have open on this page. Check it before confirming.').replace('_name_', name)}
            </div>
          </Callout>
        )}
        <ChangeList>
          {changes.map(change => (
            <ChangeRow key={change.field}>
              <dt>{getFieldLabel(change.field, t)}</dt>
              <dd>
                {change.before_known && <span className='before'>{format(change.field, change.before)}</span>}
                <span aria-hidden>→</span>
                <span className='after'>{format(change.field, change.after)}</span>
                {!change.before_known && <span className='unknown'>{t('ASSISTANT_BEFORE_UNKNOWN', '(current value not available)')}</span>}
              </dd>
            </ChangeRow>
          ))}
        </ChangeList>
        {action.requestError && (
          <Callout tone='danger' role='alert' style={{ margin: '0 14px 12px' }}>
            {requestErrorText(action.requestError, t)}
          </Callout>
        )}
        <CardActions>
          <ActionButton type='button' disabled={applying} onClick={() => onCancel([action.id])}>
            {t('CANCEL', 'Cancel')}
          </ActionButton>
          <ActionButton type='button' primary disabled={applying} onClick={() => onConfirm([action.id])}>
            {applying ? t('ASSISTANT_APPLYING', 'Applying…') : t('ASSISTANT_CONFIRM', 'Confirm')}
          </ActionButton>
        </CardActions>
      </Card>
    )
  }

  const changeLines = (values) => changes.map(change => {
    const after = values && change.field in values ? values[change.field] : change.after
    const label = getFieldLabel(change.field, t)
    return change.before_known
      ? `${label}: ${format(change.field, change.before)} → ${format(change.field, after)}`
      : `${label}: ${format(change.field, after)}`
  }).join('\n')

  if (status === 'executed') {
    return (
      <Callout tone='success' role='status'>
        <div className='title'>
          <CheckLg size={16} aria-hidden />
          {t('ASSISTANT_RESULT_UPDATED', '_type_ updated: _name_').replace('_type_', typeLabel).replace('_name_', name)}
        </div>
        <div className='values'>{changeLines(action.after)}</div>
      </Callout>
    )
  }

  if (status === 'failed') {
    const state = action.error?.state
    const reason = state === 'no_permission'
      ? t('ASSISTANT_RESULT_NO_PERMISSION', 'You don\'t have permission to change this.')
      : state === 'mcp_unavailable'
        ? t('ASSISTANT_RESULT_MCP_UNAVAILABLE', 'Ordering couldn\'t connect right now.')
        : t('ASSISTANT_RESULT_REJECTED', 'Ordering didn\'t accept the change.')
    return (
      <Callout tone='danger' role='status'>
        <div className='title'>
          <XCircle size={16} aria-hidden />
          {t('ASSISTANT_RESULT_FAILED', 'Couldn\'t change _name_').replace('_name_', name)}
        </div>
        <div>{reason} {t('ASSISTANT_NO_CHANGE_MADE', 'No change was made.')}</div>
      </Callout>
    )
  }

  if (status === 'unknown') {
    const observed = action.observed
    const text = observed === 'applied'
      ? t('ASSISTANT_UNKNOWN_APPLIED', 'It looks applied. This is what _name_ has now:').replace('_name_', name)
      : observed === 'not_applied'
        ? t('ASSISTANT_UNKNOWN_NOT_APPLIED', 'It doesn\'t look applied. You can ask for it again.')
        : t('ASSISTANT_UNKNOWN_UNREADABLE', 'We couldn\'t read how it ended up either. Check it before trying again.')
    return (
      <Callout tone='warning' role='status'>
        <div className='title'>
          <ExclamationTriangle size={16} aria-hidden />
          {t('ASSISTANT_UNKNOWN_TITLE', 'We couldn\'t confirm the change to _name_').replace('_name_', name)}
        </div>
        <div>{text}</div>
        {observed !== 'unreadable' && action.after && <div className='values'>{changeLines(action.after)}</div>}
      </Callout>
    )
  }

  if (status === 'expired') {
    return (
      <Callout tone='neutral' role='status'>
        <div className='title'>
          <Clock size={16} aria-hidden />
          {t('ASSISTANT_EXPIRED_TITLE', 'This proposal expired')}
        </div>
        <div>{t('ASSISTANT_EXPIRED_TEXT', 'No change was made to _name_.').replace('_name_', name)}</div>
        {onProposeAgain && (
          <ActionButton type='button' small onClick={onProposeAgain}>
            {t('ASSISTANT_PROPOSE_AGAIN', 'Propose again')}
          </ActionButton>
        )}
      </Callout>
    )
  }

  if (status === 'cancelled') {
    return (
      <Callout tone='neutral' role='status'>
        <div className='title'>{t('ASSISTANT_CANCELLED_TITLE', 'You cancelled this change')}</div>
        <div>{t('ASSISTANT_CANCELLED_TEXT', '_name_ stays as it was.').replace('_name_', name)}</div>
      </Callout>
    )
  }

  return null
}
