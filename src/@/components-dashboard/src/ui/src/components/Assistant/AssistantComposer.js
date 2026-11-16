import React, { useEffect, useRef } from 'react'
import { useLanguage, useAssistant, useUtils } from '../../../../index'
import { Button, IconButton, InlineNotice } from '../Shared/Product'
import { ArrowUp, LockKeyhole, Square } from '../Shared/Icon'
import { formatRetryAt } from './format'
import './assistant.css'

const MAX_LENGTH = 4000

/**
 * Where the user writes: the page context they send, the usage warnings and
 * the send / stop button
 */
export const AssistantComposer = (props) => {
  const { page, value, onChange, onSend, refs = [], inputRef } = props
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
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

  // redesign AS-B (D3, M-AS7): the box, the send / stop buttons and the notices are Product's
  const dataPage = page ? '' : undefined

  if (limited) {
    return (
      <div className='odc-root odc-as-composer' data-page={dataPage}>
        <InlineNotice tone='warning' icon={LockKeyhole}>
          <span className='odc-as-limit'>
            <strong>{t('ASSISTANT_LIMIT_TITLE', 'The assistant reached its usage limit')}</strong>
            <span>
              {formatRetryAt(status.usage?.retry_at, t, parseDate)}
              {' '}
              {t('ASSISTANT_LIMIT_PENDING', 'Changes waiting for you can still be confirmed.')}
            </span>
          </span>
        </InlineNotice>
      </div>
    )
  }

  return (
    <div className='odc-root odc-as-composer' data-page={dataPage}>
      {status.usage?.near_limit && (
        <InlineNotice tone='info'>{t('ASSISTANT_NEAR_LIMIT', 'There is little assistant use left.')}</InlineNotice>
      )}
      {refs.length > 0 && (
        <div className='odc-as-refs'>
          <span>{t('ASSISTANT_CONTEXT', 'Context:')}</span>
          {refs.map(ref => (
            <span key={`${ref.type}-${ref.id}`} className='odc-as-ref'>{ref.name || refLabels[ref.type].replace('_id_', ref.id)}</span>
          ))}
        </div>
      )}
      <form className='odc-as-input' onSubmit={handleSubmit} data-streaming={streaming ? '' : undefined}>
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
          ? <Button size='sm' icon={Square} onClick={stopMessage}>{t('ASSISTANT_STOP', 'Stop')}</Button>
          : <IconButton type='submit' variant='primary' icon={ArrowUp} label={t('ASSISTANT_SEND', 'Send')} disabled={!canSend} />}
      </form>
    </div>
  )
}
