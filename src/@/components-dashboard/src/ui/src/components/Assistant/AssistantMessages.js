import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useAssistant } from '../../../../index'
import { Button, InlineNotice } from '../Shared/Product'
import { Check, CircleAlert, LoaderCircle } from '../Shared/Icon'
import { AssistantMarkdown } from './AssistantMarkdown'
import { AssistantActionCard } from './AssistantActionCard'
import { AssistantDestinations } from './AssistantDestinations'
import { getActionDisplayStatus, getRecordName } from './format'
import './assistant-card.css'

/**
 * Consecutive tool calls read as one line: what is running now, or how many
 * reads finished. Labels are null for most operations today.
 */
export const groupItems = (items) => {
  const groups = []
  items.forEach(item => {
    if (item.kind === 'tool' && ['search_dashboard_destinations', 'present_dashboard_navigation'].includes(item.name)) return
    const last = groups[groups.length - 1]
    if (item.kind === 'tool' && last?.kind === 'tools') {
      last.tools.push(item)
    } else if (item.kind === 'tool') {
      groups.push({ kind: 'tools', key: item.key, tools: [item] })
    } else {
      groups.push(item)
    }
  })
  return groups
}

const errorText = (code, t) => {
  switch (code) {
    case 'mcp_unavailable':
      return t('ASSISTANT_ERROR_MCP_UNAVAILABLE', 'Ordering couldn\'t connect right now. No change was made.')
    case 'no_permission':
      return t('ASSISTANT_ERROR_NO_PERMISSION', 'You don\'t have permission to do this.')
    case 'busy':
      return t('ASSISTANT_ERROR_BUSY', 'I\'m still answering in this conversation. Wait a moment and send it again.')
    case 'not_found':
      return t('ASSISTANT_ERROR_NOT_FOUND', 'This conversation no longer exists. Send your message again to start a new one.')
    case 'usage_limit':
      return t('ASSISTANT_ERROR_USAGE_LIMIT', 'The assistant reached its usage limit.')
    case 'notice_required':
      return t('ASSISTANT_ERROR_NOTICE_REQUIRED', 'Accept the data notice to keep using the assistant.')
    default:
      return t('ASSISTANT_ERROR_GENERIC', 'Something went wrong while answering. No change was made.')
  }
}

// redesign AS-A (D1): the tool line, icons by token and the spinner of Product
const ToolGroup = ({ tools }) => {
  const [, t] = useLanguage()
  const running = tools.find(tool => tool.status === 'running')
  if (running) {
    return (
      <div className='odc-as-tool' role='status' data-state='running'>
        <LoaderCircle className='odc-icon odc-spin' />
        {running.label || t('ASSISTANT_TOOL_RUNNING', 'Looking up data…')}
      </div>
    )
  }
  const failed = tools.every(tool => tool.status === 'error')
  const labels = [...new Set(tools.map(tool => tool.label).filter(Boolean))]
  const text = labels.length > 0
    ? labels.join(' · ')
    : tools.length > 1
      ? t('ASSISTANT_TOOLS_DONE', 'Looked up data (_count_)').replace('_count_', tools.length)
      : t('ASSISTANT_TOOL_DONE', 'Looked up data')
  return (
    <div className='odc-as-tool' data-state={failed ? 'error' : 'done'}>
      {failed
        ? <CircleAlert className='odc-icon' />
        : <Check className='odc-icon' />}
      {text}
    </div>
  )
}

/**
 * The proposals of one turn, and when more than one waits, one row to confirm them all.
 * redesign AS-A (M-AS2): the row goes away as the changes get applied, so a focus on its
 * button goes to the first card of the group, which carries it to its result.
 */
const ActionGroup = ({ item, onProposeAgain }) => {
  const [, t] = useLanguage()
  const { actions, streaming, confirmActions, cancelActions } = useAssistant()
  const groupRef = useRef(null)

  // redesign R1-1: the row follows the clock like the cards (they re-render each second while they wait), so
  // «Confirm all» never offers, nor sends, a proposal its card already shows as expired
  const anyProposed = item.actionIds.some(id => actions[id]?.status === 'proposed')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!anyProposed) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [anyProposed])

  const waiting = item.actionIds.filter(id => getActionDisplayStatus(actions[id], now) === 'proposed' && !actions[id]?.busy)

  const confirmAll = (event) => {
    if (document.activeElement === event.currentTarget) {
      const card = Array.from(groupRef.current?.querySelectorAll('[data-action-id]') || []).find(node => node.dataset.actionId === waiting[0])
      card?.querySelector('[data-as-confirm]')?.focus({ preventScroll: true })
    }
    confirmActions(waiting)
  }

  return (
    <div className='odc-as-actions-group' ref={groupRef}>
      {item.actionIds.map(id => (
        <AssistantActionCard
          key={id}
          action={actions[id]}
          onConfirm={confirmActions}
          onCancel={cancelActions}
          onProposeAgain={streaming ? null : onProposeAgain}
        />
      ))}
      {waiting.length > 1 && (
        <div className='odc-as-group'>
          <p className='odc-as-group-text'>
            {t('ASSISTANT_CHANGES_WAITING_NAMED', 'Waiting for you: _names_')
              .replace('_names_', waiting.map(id => getRecordName(actions[id], t)).join(', '))}
          </p>
          <Button variant='secondary' size='md' onClick={confirmAll}>
            {/* decision 11: no figures in buttons */}
            {t('ASSISTANT_CONFIRM_ALL', 'Confirm all (_count_)').replace('_count_', waiting.length)}
          </Button>
        </div>
      )}
    </div>
  )
}

export const AssistantMessages = ({ onProposeAgain }) => {
  const [, t] = useLanguage()
  const { items, streaming } = useAssistant()

  return (
    // redesign AS-A (M-AS13): busy while the answer streams, so it is announced whole at the end
    <div className='odc-as-messages' aria-live='polite' aria-busy={streaming}>
      {groupItems(items).map(item => {
        switch (item.kind) {
          case 'user':
            return <div className='odc-as-user' key={item.key}>{item.text}</div>

          case 'assistant':
            return (
              <div key={item.key}>
                {item.text && (
                  <div className='odc-as-text' data-streaming={item.streaming ? 'true' : undefined}>
                    <AssistantMarkdown text={item.text} />
                  </div>
                )}
                {item.aborted && <div className='odc-as-note'>{t('ASSISTANT_ANSWER_STOPPED', 'Answer stopped')}</div>}
              </div>
            )

          case 'tools':
            return <ToolGroup key={item.key} tools={item.tools} />

          case 'destinations':
            return <AssistantDestinations key={item.key} result={item} />

          case 'actions':
            return <ActionGroup key={item.key} item={item} onProposeAgain={onProposeAgain} />

          case 'error':
            return (
              <InlineNotice key={item.key} tone='danger' icon={CircleAlert} role='alert' className='odc-as-notice'>
                {errorText(item.code, t)}
              </InlineNotice>
            )

          default:
            return null
        }
      })}
    </div>
  )
}
