import React, { useId, useRef, useState } from 'react'
// the context by file, not the components-dashboard index (as AlertDialog, redesign W0-7 T0-29)
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TextArea } from './Field'

// redesign deliveries F2-B2 (decision 3), promoted in deliveries-followups P3: the comment a project can require before a
// driver is assigned (configs.manual_driver_assignment_comment_enabled). One piece for the order panel and the /deliveries board, which
// had a copy each. The comment is required, and spaces only count as empty. `onSubmit(text)` gets the comment as typed.

const CommentForm = ({ formId, fieldRef, onSubmit }) => {
  const [, t] = useLanguage()
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!value.trim()) {
      setFailed(true)
      // review r1 R-2: back to the field with its error, as the panel's react-hook-form form did (shouldFocusError)
      fieldRef.current?.focus()
      return
    }
    onSubmit(value)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <TextArea
        ref={fieldRef}
        name='manual_driver_assignment_comment'
        label={t('MANUAL_DRIVER_ASSIGMENT_COMMENT', 'Manual driver assigment comment')}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        error={failed && !value.trim() ? t('FIELD_REQUIRED', 'This field is required') : undefined}
        value={value}
        onChange={(next) => { setValue(next); if (next.trim()) setFailed(false) }}
      />
    </form>
  )
}

// redesign bugs-d row 58 (R-3): OPT-IN `returnFocus` (element, ref or function) for an opener that is gone on close (a listbox option of the
// driver selector); without it nothing changes.
export const AssignCommentDialog = ({ open, onSubmit, onCancel, returnFocus }) => {
  const [, t] = useLanguage()
  const formId = useId()
  const fieldRef = useRef(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onCancel() }}
      size='sm'
      initialFocus={fieldRef}
      returnFocus={returnFocus}
      title={t('ASSIGNMENT_COMMENT', 'Assignment comment')}
      closeLabel={t('CLOSE', 'Close')}
      footer={(
        <>
          <Button onClick={onCancel}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' type='submit' form={formId}>{t('ASSIGN_DRIVER', 'Assign driver')}</Button>
        </>
      )}
    >
      <CommentForm formId={formId} fieldRef={fieldRef} onSubmit={onSubmit} />
    </Dialog>
  )
}
