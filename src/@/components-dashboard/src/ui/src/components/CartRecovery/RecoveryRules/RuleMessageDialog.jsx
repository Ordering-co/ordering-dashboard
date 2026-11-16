import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, ConfirmDialog, Dialog, InlineNotice, SegmentedControl, TextArea, TextField } from '../../Shared/Product'
import { RichHtmlEditor } from '../../Shared/RichHtmlEditor'
import { channelLabel } from './channelLabel'
import { MessagePreview } from './MessagePreview'
import './recovery-message-dialog.css'

// redesign RA-B4 (decision 5; M-RA7, M-RA9): the dialog of ONE message (channel) of a recovery rule, to add it or to edit and delete it.
// It replaces the 700px × 80vh modal of main, whose footer left the viewport (the email editor does not fit in 80vh): this is a Product
// Dialog (`lg`), so the body scrolls and the footer never leaves it. The page mounts it once and feeds it the rule's channel handlers.
//
// Props:
//   open, onOpenChange(open)   whether it is shown, and the way out (Cancel, the close button, Escape). Nothing leaves while a request runs.
//   mode: 'add' | 'edit'       'add' lets the user choose among Email, SMS and Push notification (the three, always; a rule may have
//                              two emails). 'edit' fixes the channel and offers «Delete message».
//   channel                    the channel of the rule being edited ({ id, channel, title, body, … }); only read in 'edit'.
//   rule                       the rule it belongs to. Accepted for the page; the dialog paints nothing from it.
//   pending                    { channel, title, body, error } of an add whose rule was created and whose message failed (decision 6):
//                              it opens as an 'add' with those values and `error` (text or list of texts) already shown.
//   onSave({ channel, title, body }) → Promise<{ ok, error }>   `channel` is the type ('email', 'sms', 'notification'); in 'edit' the
//                              page knows which channel it opened the dialog on. `title` is trimmed.
//   onDelete(channel) → Promise<{ ok, error }>   called with the very `channel` object the dialog was given.
//   returnFocus() → HTMLElement | null   (redesign R2-F2, R1-04, R1-05) where the focus goes when the dialog closes (save, delete, Cancel,
//                              Escape) and it was left on <body> or on a node that left the page (the «Edit» of a message just deleted, or no
//                              opener at all after a failed first message). A control that opened it and still exists keeps its own return.
//                              Without the prop nothing changes.
// No channel is chosen when adding: a message goes out as soon as its rule is on, so a wrong default would be a message nobody asked for.

const EMPTY_FORM = { channel: '', title: '', body: '' }

const initialForm = ({ mode, channel, pending }) => {
  if (pending) return { channel: pending.channel ?? '', title: pending.title ?? '', body: pending.body ?? '' }
  if (mode === 'edit') return { channel: channel?.channel ?? '', title: channel?.title ?? '', body: channel?.body ?? '' }
  return EMPTY_FORM
}

// redesign R2-I4: how long the closed dialog watches for a lost focus (frames, about half a second)
const RETURN_FOCUS_FRAMES = 30

// An HTML message is empty when it has no text and no media: the editor emits '' when empty (Summernote used «<p><br></p>»).
const hasContent = (html) => {
  if (typeof html !== 'string') return false
  if (/<(img|video|iframe|table|hr)\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() !== ''
}

const toMessages = (error) => (Array.isArray(error) ? error : [error]).filter(message => typeof message === 'string' && message.trim() !== '')

const errorText = (t, error, fallback) => {
  const messages = toMessages(error)
  return messages.length ? messages.map(message => translateApiMessage(t, message, fallback)).join(' ') : fallback
}

export const RuleMessageDialog = ({ open = false, mode = 'add', channel, pending, onSave, onDelete, onOpenChange, returnFocus }) => {
  const [, t] = useLanguage()
  const ids = useId()
  const effectiveMode = pending ? 'add' : mode
  const editing = effectiveMode === 'edit'

  const [form, setForm] = useState(() => initialForm({ mode, channel, pending }))
  const [submitted, setSubmitted] = useState(false)
  const [notice, setNotice] = useState(() => (pending && toMessages(pending.error).length ? errorText(t, pending.error, '') : null))
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const channelRef = useRef(null)
  const titleRef = useRef(null)
  const messageRef = useRef(null)
  const returnFocusRef = useRef(returnFocus)
  returnFocusRef.current = returnFocus
  const shownRef = useRef(false)

  // redesign R2-F2 (R1-04, R1-05): after it closes, a focus left on <body> or on a node that left the page goes to `returnFocus()`, one frame later.
  // Two ways, both needed: the Product Dialog's own `returnFocus` (below) places it when the exit transition ends, while the focus is still inside
  // the popup; this frame check catches what is left behind when that does not happen (the opener removed by the same update that closed it).
  useEffect(() => {
    if (open) {
      shownRef.current = true
      return undefined
    }
    if (!shownRef.current) return undefined
    shownRef.current = false
    // redesign R2-I4 (live check of R1-04): one frame was not enough: after a delete the confirmation closes later and its own hand-back
    // (to a button that is gone) leaves <body> again. Watch a few frames, as listFocus does, and stop once a real control holds the focus.
    // It watches the whole window (a late hand-back can come after the focus already looked settled) and only acts on a lost focus:
    // a control the person reached is never taken away.
    let frame = 0
    let frames = 0
    const step = () => {
      frames++
      const active = document.activeElement
      if (!active || active === document.body || !active.isConnected) returnFocusRef.current?.()?.focus?.()
      if (frames < RETURN_FOCUS_FRAMES) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [open])

  // Every opening starts from the values it was given, in the same render, so the editor mounts with the right body.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(initialForm({ mode, channel, pending }))
      setSubmitted(false)
      setNotice(pending && toMessages(pending.error).length ? errorText(t, pending.error, '') : null)
      setSaving(false)
      setConfirming(false)
      setDeleting(false)
    }
  }

  const busy = saving || deleting
  const isEmail = form.channel === 'email'
  const label = channelLabel(t, editing ? channel?.channel : form.channel)

  const validate = (values) => {
    const required = t('FIELD_REQUIRED', 'This field is required')
    const errors = {}
    if (!editing && !values.channel) errors.channel = t('RECOVERY_RULES_CHANNEL_REQUIRED', 'Choose a channel')
    if (!values.title.trim()) errors.title = required
    const emptyMessage = values.channel === 'email' ? !hasContent(values.body) : !String(values.body ?? '').trim()
    if (emptyMessage) errors.body = required
    return errors
  }
  const errors = submitted ? validate(form) : {}

  const update = (changes) => setForm(current => ({ ...current, ...changes }))

  const focusFirst = (found) => {
    const target = found.channel
      ? channelRef.current?.querySelector('button, select')
      : found.title
        ? titleRef.current
        : messageRef.current?.matches?.('textarea') ? messageRef.current : messageRef.current?.querySelector('[role="textbox"], textarea')
    target?.focus?.()
  }

  const handleOpenChange = (next) => {
    if (busy) return
    onOpenChange?.(next)
  }

  const handleSave = async () => {
    if (busy) return
    const found = validate(form)
    setSubmitted(true)
    if (Object.keys(found).length > 0) {
      focusFirst(found)
      return
    }
    setSaving(true)
    setNotice(null)
    const fallback = t('RECOVERY_RULES_MESSAGE_SAVE_FAILED', "We couldn't save this message. Try again.")
    let result
    try {
      result = await onSave?.({ channel: form.channel, title: form.title.trim(), body: form.body })
    } catch (err) {
      result = { ok: false }
    }
    setSaving(false)
    if (result?.ok) {
      onOpenChange?.(false)
      return
    }
    setNotice(errorText(t, result?.error, fallback))
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    const fallback = t('RECOVERY_RULES_MESSAGE_DELETE_FAILED', "We couldn't delete this message. Try again.")
    let result
    try {
      result = await onDelete?.(channel)
    } catch (err) {
      result = { ok: false }
    }
    setDeleting(false)
    setConfirming(false)
    if (result?.ok) {
      onOpenChange?.(false)
      return
    }
    setNotice(errorText(t, result?.error, fallback))
  }

  const requiredLabel = t('REQUIRED', 'Required')
  const messageLabel = t('MESSAGE', 'Message')
  const title = editing
    ? t('RECOVERY_RULES_EDIT_MESSAGE', 'Edit _channel_ message').replace('_channel_', () => label)
    : t('RECOVERY_RULES_ADD_MESSAGE', 'Add message')
  const saveLabel = editing ? t('RECOVERY_RULES_SAVE_MESSAGE', 'Save message') : t('RECOVERY_RULES_ADD_MESSAGE', 'Add message')

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        dismissible={!busy}
        returnFocus={returnFocus ? () => returnFocusRef.current?.() : undefined}
        className='odc-ra-msg-dialog'
        footer={(
          <>
            {notice && (
              <InlineNotice tone='danger' role='alert' className='odc-ra-msg-notice'>{notice}</InlineNotice>
            )}
            {editing && (
              <Button variant='danger' className='odc-ra-msg-delete' disabled={busy} onClick={() => setConfirming(true)}>
                {t('RECOVERY_RULES_DELETE_MESSAGE', 'Delete message')}
              </Button>
            )}
            <Button disabled={busy} onClick={() => handleOpenChange(false)}>{t('CANCEL', 'Cancel')}</Button>
            <Button variant='primary' busy={saving} onClick={handleSave}>{saveLabel}</Button>
          </>
        )}
      >
        <div className='odc-root odc-ra-msg'>
          {!editing && (
            <div className='odc-ra-msg-group' ref={channelRef}>
              <span className='odc-ra-msg-label' aria-hidden='true'>{t('CHANNEL', 'Channel')}</span>
              <SegmentedControl
                label={t('CHANNEL', 'Channel')}
                value={form.channel}
                // redesign R2-F2 (R1-03): a new channel starts with an empty message (an email's HTML must not reach an SMS), as main and the create form do
                onValueChange={next => setForm(current => (next === current.channel ? current : { ...current, channel: next, body: '' }))}
                options={['email', 'sms', 'notification'].map(value => ({ value, label: channelLabel(t, value) }))}
              />
              {errors.channel && <p className='odc-ra-msg-error' role='alert'>{errors.channel}</p>}
            </div>
          )}
          <TextField
            ref={titleRef}
            label={t('TITLE', 'Title')}
            required
            requiredLabel={requiredLabel}
            value={form.title}
            onChange={next => update({ title: next })}
            error={errors.title}
            autoComplete='off'
          />
          {isEmail
            ? (
              <div className='odc-ra-msg-group' role='group' aria-labelledby={`${ids}-message`} ref={messageRef}>
                {/* The editor builds its own editable, so there is no field to point `for` at: the group is named by this label */}
                <span id={`${ids}-message`} className='odc-ra-msg-label'>
                  {messageLabel}
                  {' '}
                  <span className='odc-ra-msg-required' aria-hidden='true'>*</span>
                  <span className='odc-sr-only'>{requiredLabel}</span>
                </span>
                <RichHtmlEditor
                  label={messageLabel}
                  value={form.body}
                  onChange={next => update({ body: next })}
                  invalid={Boolean(errors.body)}
                  describedBy={errors.body ? `${ids}-body-error` : undefined}
                />
                {errors.body && <p id={`${ids}-body-error`} className='odc-ra-msg-error' role='alert'>{errors.body}</p>}
              </div>
              )
            : (
              <TextArea
                ref={messageRef}
                label={messageLabel}
                required
                requiredLabel={requiredLabel}
                rows={5}
                value={form.body}
                onChange={next => update({ body: next })}
                error={errors.body}
              />
              )}
          {form.channel && (
            <div className='odc-ra-msg-group odc-ra-msg-preview'>
              <span className='odc-ra-msg-label' aria-hidden='true'>{t('PREVIEW', 'Preview')}</span>
              <MessagePreview channel={form.channel} title={form.title} body={form.body} />
            </div>
          )}
        </div>
      </Dialog>
      {editing && (
        <ConfirmDialog
          open={open && confirming}
          title={t('RECOVERY_RULES_DELETE_MESSAGE_TITLE', 'Delete the _channel_ message?').replace('_channel_', () => label)}
          confirmLabel={t('RECOVERY_RULES_DELETE_MESSAGE', 'Delete message')}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          tone='danger'
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        >
          {t('RECOVERY_RULES_DELETE_MESSAGE_BODY', 'Customers stop getting this message from the rule.')}
        </ConfirmDialog>
      )}
    </>
  )
}
