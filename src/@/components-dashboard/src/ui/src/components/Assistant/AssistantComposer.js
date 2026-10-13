import React, { useEffect, useRef } from 'react'
import { ArrowUp, Lock, StopFill } from 'react-bootstrap-icons'
import { useLanguage, useAssistant } from '../../../../index'
import { Callout, Composer, InputBox, Refs, SendButton, UsageStrip } from './styles'
import { formatRetryAt } from './format'

const MAX_LENGTH = 4000

/**
 * Where the user writes: the page context they send, the usage warnings and
 * the send / stop button
 */
export const AssistantComposer = (props) => {
  const { page, value, onChange, onSend, refs = [], inputRef } = props
  const [languageState, t] = useLanguage()
  const { streaming, stopMessage, status } = useAssistant()
  const localRef = useRef(null)
  const textareaRef = inputRef || localRef

  const limited = status.usage?.limited
  const canSend = !streaming && !limited && value.trim().length > 0

  // Grow with the text up to the CSS max-height
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (canSend) onSend()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  const refLabels = {
    business: t('ASSISTANT_REF_BUSINESS', 'Store #_id_'),
    category: t('ASSISTANT_REF_CATEGORY', 'Category #_id_'),
    product: t('ASSISTANT_REF_PRODUCT', 'Product #_id_'),
    order: t('ASSISTANT_REF_ORDER', 'Order #_id_'),
    franchise: t('ASSISTANT_REF_BRAND', 'Brand #_id_'),
    user: t('ASSISTANT_REF_USER', 'User #_id_')
  }

  if (limited) {
    return (
      <Composer page={page}>
        <Callout tone='neutral' role='status'>
          <div className='title'>
            <Lock size={15} aria-hidden />
            {t('ASSISTANT_LIMIT_TITLE', 'The assistant reached its usage limit')}
          </div>
          <div>
            {formatRetryAt(status.usage?.retry_at, t, languageState?.language?.code)}
            {' '}
            {t('ASSISTANT_LIMIT_PENDING', 'Changes waiting for you can still be confirmed.')}
          </div>
        </Callout>
      </Composer>
    )
  }

  return (
    <Composer page={page}>
      {status.usage?.near_limit && (
        <UsageStrip role='status'>{t('ASSISTANT_NEAR_LIMIT', 'There is little assistant use left.')}</UsageStrip>
      )}
      {refs.length > 0 && (
        <Refs>
          <span>{t('ASSISTANT_CONTEXT', 'Context:')}</span>
          {refs.map(ref => (
            <span key={`${ref.type}-${ref.id}`} className='ref'>{ref.name || refLabels[ref.type].replace('_id_', ref.id)}</span>
          ))}
        </Refs>
      )}
      <InputBox onSubmit={handleSubmit} disabled={streaming}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          aria-label={t('ASSISTANT_INPUT_LABEL', 'Message to the assistant')}
          placeholder={streaming ? t('ASSISTANT_INPUT_WAITING', 'Waiting for the answer…') : t('ASSISTANT_INPUT_PLACEHOLDER', 'Ask or request a change…')}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {streaming
          ? (
            <SendButton type='button' stop onClick={stopMessage}>
              <StopFill size={12} aria-hidden />
              {t('ASSISTANT_STOP', 'Stop')}
            </SendButton>
            )
          : (
            <SendButton type='submit' disabled={!canSend} aria-label={t('ASSISTANT_SEND', 'Send')}>
              <ArrowUp size={16} aria-hidden />
            </SendButton>
            )}
      </InputBox>
    </Composer>
  )
}
