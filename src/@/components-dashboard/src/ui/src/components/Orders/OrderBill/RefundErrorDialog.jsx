import React, { useId, useRef } from 'react'
import { useLanguage } from '../../../../../index'
import { Button, Dialog } from '../../Shared/Product'
import { translateApiMessage } from '../../../../../utils/translateApiMessage' // redesign W0-2d (T0-7)
import '../../Shared/Product/alert-dialog.css'

// Plain lines of text out of what the API left as the error: a text or a list of texts.
const getMessages = (error) => {
  if (typeof error === 'string') return error ? [error] : []
  if (!Array.isArray(error)) return []
  return error.flat().filter(item => typeof item === 'string' && item)
}

/**
 * redesign F6i-3 (A3-03): the one surface of a failed refund (an alert dialog of the product, C8, with the same close as the others).
 * It says what happened and what to do, by how far the request got (`kind`):
 *   - 'network': the request got no answer, so it was not sent: «No money moved. Try again.»;
 *   - 'api': the API answered with an error: its message, translated as every API message is;
 *   - 'unreadable': it answered but the answer cannot be used, so the refund may have been sent: check the order, no retry here.
 * The focus starts on «Try again» (or on OK where there is no retry). The text stays while the dialog fades out.
 */
export const RefundErrorDialog = ({ open, kind, error, canRetry, onClose, onRetry }) => {
  const [, t] = useLanguage()
  const messagesId = useId() // redesign tramo A (W0-Q2-05)
  const okRef = useRef(null)
  const retryRef = useRef(null)
  const last = useRef({ kind, error, canRetry })
  if (open) last.current = { kind, error, canRetry }
  const view = open ? { kind, error, canRetry } : last.current

  const messages = view.kind === 'api'
    ? getMessages(view.error).map(message => translateApiMessage(t, message, ''))
    : []
  const lines = view.kind === 'unreadable'
    ? [t('REFUND_ANSWER_UNREADABLE', 'The answer could not be read, so the refund may have been sent. Check the payment of this order before you try again.')]
    : view.kind === 'api'
      ? (messages.length > 0 ? messages : [t('REFUND_NOT_SENT_TRY_AGAIN', 'The refund was not sent. Try again.')])
      : [t('REFUND_NOT_SENT_NO_MONEY_MOVED', 'The refund was not sent. No money moved. Try again.')]
  const retry = !!view.canRetry && view.kind !== 'unreadable'

  return (
    <Dialog
      open={!!open}
      role='alertdialog'
      aria-describedby={messagesId} // redesign tramo A (W0-Q2-05): described by its messages, as the AlertDialog (W0-Q1-10)
      onOpenChange={(next) => { if (!next) onClose() }}
      size='sm'
      initialFocus={retry ? retryRef : okRef}
      title={t('REFUND_NOT_SENT', 'Refund not sent')}
      closeLabel={t('CLOSE', 'Close')}
      footer={(
        <>
          <Button ref={okRef} onClick={() => onClose()}>{t('OK', 'OK')}</Button>
          {retry && <Button ref={retryRef} variant='primary' onClick={() => onRetry()}>{t('TRY_AGAIN', 'Try again')}</Button>}
        </>
      )}
    >
      <div id={messagesId} className='odc-alert-messages'>
        {lines.map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </Dialog>
  )
}
