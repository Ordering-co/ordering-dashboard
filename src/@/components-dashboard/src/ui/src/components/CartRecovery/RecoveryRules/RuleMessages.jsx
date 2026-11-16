import React, { useId } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Plus, TriangleAlert } from '../../Shared/Icon'
import { AsyncSwitch, Button, InlineNotice, Skeleton } from '../../Shared/Product'
import { channelLabel } from './channelLabel'
import { MessagePreview } from './MessagePreview'
import './recovery-rule-panel.css'

// redesign RA-B3 (decision 3, decision 5; M-RA8, M-RA16, M-RA17): the Messages section of a rule: one card per message (the API may hold
// two of the same channel), each with its name, its switch (it saves at once and says why when it cannot), «Edit» and the facsimile.
// Presentational: RulePanel connects it to K/RecoveryNotificationList.

// The first text of an API error (a string, `{ message }`, or a list of either); undefined when there is none
export const firstMessage = (error) => (Array.isArray(error) ? error.flat(Infinity) : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const MessagesSkeleton = ({ label }) => (
  <div className='odc-ra-messages-skeleton' role='status' aria-busy='true' aria-label={label}>
    {[0, 1].map(index => (
      <div key={index} className='odc-ra-message odc-ra-message-skeleton'>
        <Skeleton size='30%' />
        <Skeleton block='var(--od-x-control-height)' />
      </div>
    ))}
  </div>
)

/**
 * The Messages of a rule. Props:
 *  - `rule`: the rule (only its id goes to the DOM, as `data-rule-id`);
 *  - `channelsState`: `{ loading, notifications, error }`, what K/RecoveryNotificationList holds (`notifications` is the list in the order of
 *    the API, duplicates included; `error` is the API's error of the load);
 *  - `onRetry()`: the «Retry» of a failed load;
 *  - `onToggle(message, next)` -> `{ ok, error }` | Promise: the switch of a message; a refusal puts the switch back and says why;
 *  - `onEdit(message)` and `onAdd()`: the host opens the dialog of a message (RuleMessageDialog);
 *  - `sectionRef`: a ref for the `<section>`, so the host can scroll to it (`?tab=notifications`).
 */
export const RuleMessages = ({ rule, channelsState, onRetry, onToggle, onEdit, onAdd, sectionRef }) => {
  const [, t] = useLanguage()
  const titleId = useId()
  const { loading = false, notifications, error } = channelsState ?? {}
  const messages = Array.isArray(notifications) ? notifications : []
  const failed = !loading && hasError(error)
  const empty = !loading && !failed && messages.length === 0

  const addButton = (
    <Button size='sm' icon={Plus} onClick={() => onAdd?.()}>
      {t('RECOVERY_RULES_ADD_MESSAGE', 'Add message')}
    </Button>
  )

  return (
    <section ref={sectionRef} className='odc-root odc-ra-messages' aria-labelledby={titleId} data-rule-id={rule?.id}>
      <div className='odc-ra-messages-head'>
        <h3 id={titleId} className='odc-ra-section-title'>{t('RECOVERY_RULES_MESSAGES', 'Messages')}</h3>
        {!empty && addButton}
      </div>

      {failed && (
        <InlineNotice
          tone='danger'
          icon={TriangleAlert}
          role='alert'
          action={onRetry && <Button variant='link' onClick={() => onRetry()}>{t('RETRY', 'Retry')}</Button>}
        >
          {translateApiMessage(t, firstMessage(error), t('RECOVERY_RULES_MESSAGES_LOAD_ERROR', "We couldn't load the messages of this rule."))}
        </InlineNotice>
      )}

      {loading && <MessagesSkeleton label={t('LOADING', 'Loading')} />}

      {/* redesign R2-F2 (R1-05): a rule that is ON and has no message sends nothing; the empty state alone does not say it matters */}
      {empty && rule?.enabled && (
        <InlineNotice tone='warning' icon={TriangleAlert}>
          {t('RECOVERY_RULES_ON_NO_MESSAGES', 'This rule is on and has no message yet.')}
        </InlineNotice>
      )}

      {empty && (
        <div className='odc-ra-messages-empty'>
          <p className='odc-ra-muted'>{t('RECOVERY_RULES_MESSAGES_EMPTY', 'This rule has no messages yet.')}</p>
          {addButton}
        </div>
      )}

      {!loading && messages.length > 0 && (
        <ul className='odc-ra-message-list'>
          {messages.map((message, index) => {
            const name = String(channelLabel(t, message.channel) ?? '')
            // redesign R2-F2 (R1-10): «Edit SMS message»: the channel as channelLabel gives it, the same as the dialog title (no lowercasing)
            const editLabel = t('RECOVERY_RULES_EDIT_MESSAGE', 'Edit _channel_ message').replace('_channel_', () => name)
            return (
              <li key={message.id ?? index} className='odc-ra-message'>
                <div className='odc-ra-message-head'>
                  <h4 className='odc-ra-message-name'>{name}</h4>
                  <AsyncSwitch
                    label={name}
                    checked={Boolean(message.enabled)}
                    onToggle={(next) => onToggle?.(message, next)}
                    failureText={t('RECOVERY_RULES_CHANNEL_TOGGLE_FAILED', "We couldn't change this message. Try again.")}
                  />
                  <span className='odc-ra-message-edit'>
                    <Button size='sm' aria-label={editLabel} onClick={() => onEdit?.(message)}>{t('EDIT', 'Edit')}</Button>
                  </span>
                </div>
                <MessagePreview channel={message.channel} title={message.title} body={message.body} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
