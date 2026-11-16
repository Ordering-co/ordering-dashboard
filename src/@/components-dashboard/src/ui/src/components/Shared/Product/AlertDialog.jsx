import React, { useId, useRef } from 'react'
// redesign W0-7 (T0-29): the context by file, not the components-dashboard index (which loads the whole legacy tree and bootstrap.css)
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { getApiMessageDefault, translateApiMessage } from '../../../../../utils/translateApiMessage'
import './alert-dialog.css'

// Plain lines of text out of what the API (or a form) left as an alert's content: a string,
// a list of strings, or a list of lists of strings. Anything else says nothing, as the legacy Alert did.
const getMessages = (content) => {
  if (typeof content === 'string') return content ? [content] : []
  if (!Array.isArray(content)) return []
  return content.flat().filter(item => typeof item === 'string' && item)
}

/**
 * The alert of the order detail dialogs (redesign 5.4-B): a Product Dialog `sm` with the same text the
 * legacy Alert showed and one OK. Same props shape as the legacy call sites keep in their state
 * (`open`, `content`); `title` names the dialog (it was «Ordering»). The text stays while the dialog
 * fades out, so a caller can clear its state as soon as it closes.
 *
 * redesign W0-2e (T0-8): a Product wrapper, so no text of its own. `title`, `closeLabel` (the close button's
 * name) and `confirmLabel` (the OK button) are required, as in Dialog and ConfirmDialog. `useLanguage` stays
 * only for the API messages below (they go through `translateApiMessage`, W0-2d).
 *
 * redesign W0-2 r2: a label that is missing throws, an empty one (a project's empty translation) paints empty
 * (W0-Q1-01). The dialog is an `alertdialog` described by its messages (W0-Q1-10). `returnFocus` (an element, a
 * ref or a function that gives the element) is where the focus goes on close when the control that had it on open
 * is gone (W0-Q1-06): the status select of the order foot is rebuilt when its change fails, and a Product dialog
 * would hand the focus to <body>. While that control is still in the page, it gets the focus back as always.
 */
export const AlertDialog = ({ open, title, content, closeLabel, confirmLabel, returnFocus, onClose }) => {
  for (const [name, value] of Object.entries({ title, closeLabel, confirmLabel })) {
    if (value == null) throw new Error(`AlertDialog needs a ${name}`) // redesign W0-2 r2 (W0-Q1-01)
  }
  const [, t] = useLanguage()
  const messagesId = useId()
  const okRef = useRef(null)
  const lastContent = useRef(content)
  if (open) lastContent.current = content

  // The same translation the legacy Alert applied to the messages the API sends as keys.
  // redesign W0-2d (T0-7): the shared helper; `getMessages` already left only non-empty strings.
  // redesign W0-2 r2 (W0-P1-05): the two report messages have a text by default, as in main.
  const translateMessage = (message) => translateApiMessage(t, message, message, getApiMessageDefault(message))
  const messages = getMessages(open ? content : lastContent.current)

  return (
    <Dialog
      open={!!open}
      onOpenChange={(next) => { if (!next) onClose() }}
      size='sm'
      initialFocus={okRef}
      title={title}
      closeLabel={closeLabel}
      footer={<Button ref={okRef} variant='primary' onClick={() => onClose()}>{confirmLabel}</Button>}
      role='alertdialog' // redesign W0-2 r2 (W0-Q1-10)
      aria-describedby={messages.length ? messagesId : undefined}
      returnFocus={returnFocus} // redesign W0-2 r2 (W0-Q1-06): Dialog sends the focus there when the opener left the page
    >
      <div id={messagesId} className='odc-alert-messages'>
        {messages.map((message, index) => (
          <p key={index}>{translateMessage(message)}</p>
        ))}
      </div>
    </Dialog>
  )
}
