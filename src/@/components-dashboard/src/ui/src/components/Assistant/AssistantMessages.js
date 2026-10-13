import React from 'react'
import { CheckLg, ExclamationCircle } from 'react-bootstrap-icons'
import { useLanguage, useAssistant } from '../../../../index'
import { AssistantMarkdown } from './AssistantMarkdown'
import { AssistantActionCard } from './AssistantActionCard'
import { AssistantDestinations } from './AssistantDestinations'
import { getActionDisplayStatus } from './format'
import { ActionButton, AssistantText, Callout, Messages, Note, Spinner, ToolLine, UserBubble } from './styles'

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

const ToolGroup = ({ tools }) => {
  const [, t] = useLanguage()
  const running = tools.find(tool => tool.status === 'running')
  if (running) {
    return (
      <ToolLine role='status'>
        <Spinner aria-hidden />
        {running.label || t('ASSISTANT_TOOL_RUNNING', 'Looking up data…')}
      </ToolLine>
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
    <ToolLine>
      {failed
        ? <ExclamationCircle size={13} aria-hidden />
        : <CheckLg size={13} color='#0E9B55' aria-hidden />}
      {text}
    </ToolLine>
  )
}

export const AssistantMessages = ({ onProposeAgain }) => {
  const [, t] = useLanguage()
  const { items, actions, streaming, confirmActions, cancelActions } = useAssistant()

  return (
    <Messages aria-live='polite'>
      {groupItems(items).map(item => {
        switch (item.kind) {
          case 'user':
            return <UserBubble key={item.key}>{item.text}</UserBubble>

          case 'assistant':
            return (
              <div key={item.key}>
                {item.text && (
                  <AssistantText streaming={item.streaming}>
                    <AssistantMarkdown text={item.text} />
                  </AssistantText>
                )}
                {item.aborted && <Note>{t('ASSISTANT_ANSWER_STOPPED', 'Answer stopped')}</Note>}
              </div>
            )

          case 'tools':
            return <ToolGroup key={item.key} tools={item.tools} />

          case 'destinations':
            return <AssistantDestinations key={item.key} result={item} />

          case 'actions': {
            const waiting = item.actionIds.filter(id => getActionDisplayStatus(actions[id]) === 'proposed' && !actions[id]?.busy)
            return (
              <React.Fragment key={item.key}>
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
                  <ActionButton type='button' primary onClick={() => confirmActions(waiting)}>
                    {t('ASSISTANT_CONFIRM_ALL', 'Confirm all (_count_)').replace('_count_', waiting.length)}
                  </ActionButton>
                )}
              </React.Fragment>
            )
          }

          case 'error':
            return (
              <Callout key={item.key} tone='danger' role='alert'>
                {errorText(item.code, t)}
              </Callout>
            )

          default:
            return null
        }
      })}
    </Messages>
  )
}
